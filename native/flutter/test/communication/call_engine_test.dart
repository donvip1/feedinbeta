import 'dart:async';

import 'package:feedin/src/features/communication/domain/call_session.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:feedin/src/features/communication/services/call/call_engine.dart';
import 'package:feedin/src/features/communication/services/call/call_signaling.dart';
import 'package:feedin/src/features/communication/services/call/call_transport.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late _FakeSignaling signaling;
  late _FakeTransport transport;
  late CallEngine engine;
  var now = 100000;

  setUp(() {
    now = 100000;
    signaling = _FakeSignaling();
    transport = _FakeTransport();
    engine = CallEngine(
      signaling: signaling,
      transport: transport,
      selfUserId: 'me',
      ringTimeout: const Duration(milliseconds: 60),
      nowMillis: () => now,
    );
  });

  tearDown(() async {
    await engine.dispose();
  });

  CallSession draft({
    String id = 'call-1',
    CallMode mode = CallMode.voice,
  }) => CallSession(
    id: id,
    conversationId: 'c1',
    mode: mode,
    callerId: 'me',
  );

  CallSession incomingCall({String id = 'call-9'}) => CallSession(
    id: id,
    conversationId: 'c1',
    mode: CallMode.voice,
    callerId: 'peer',
    state: CallLifecycleState.ringing,
  );

  Future<void> pump() => Future<void>.delayed(Duration.zero);

  group('outgoing', () {
    test('happy path: invite -> ringing -> accepted -> media -> connected', () async {
      final result = await engine.startCall(draft());
      expect(result.valueOrNull!.state, CallLifecycleState.ringing);
      expect(signaling.invited.single.id, 'call-1');
      expect(transport.connectCalls, 0); // media NOT joined while ringing

      signaling.push(CallSignalKind.accepted, draft());
      await pump();
      expect(transport.connectCalls, 1);

      transport.setState(CallTransportState.connected);
      await pump();
      expect(engine.active!.state, CallLifecycleState.connected);

      now += 12000;
      expect(engine.elapsedSeconds, 12);
    });

    test('ring timeout marks missed on both sides', () async {
      await engine.startCall(draft());
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(engine.active!.state, CallLifecycleState.missed);
      expect(signaling.missed, contains('call-1'));
      expect(transport.connectCalls, 0);
    });

    test('caller hangUp while ringing cancels (missed, not ended)', () async {
      await engine.startCall(draft());
      await engine.hangUp();
      expect(signaling.cancelled, contains('call-1'));
      expect(engine.active!.state, CallLifecycleState.missed);
    });

    test('no duplicate calls: startCall while active is refused', () async {
      await engine.startCall(draft());
      final second = await engine.startCall(draft(id: 'call-2'));
      expect(second.isErr, isTrue);
      expect(second.errorOrNull!.kind, CommErrorKind.conflict);
      expect(signaling.invited.length, 1);
    });

    test('far-side reject terminates and tears down', () async {
      await engine.startCall(draft());
      signaling.push(CallSignalKind.rejected, draft());
      await pump();
      expect(engine.active!.state, CallLifecycleState.rejected);
    });
  });

  group('incoming', () {
    test('incoming rings; accept joins media and connects', () async {
      signaling.push(CallSignalKind.incoming, incomingCall());
      await pump();
      expect(engine.incoming!.state, CallLifecycleState.ringing);

      await engine.acceptIncoming();
      expect(signaling.accepted, contains('call-9'));
      expect(engine.active!.state, CallLifecycleState.connecting);

      transport.setState(CallTransportState.connected);
      await pump();
      expect(engine.active!.state, CallLifecycleState.connected);
      expect(engine.incoming, isNull);
    });

    test('decline rejects and clears', () async {
      signaling.push(CallSignalKind.incoming, incomingCall());
      await pump();
      await engine.declineIncoming();
      expect(signaling.rejected, contains('call-9'));
      expect(engine.incoming, isNull);
      expect(engine.hasActiveCall, isFalse);
    });

    test('second incoming while busy is auto-signalled busy', () async {
      await engine.startCall(draft());
      signaling.push(CallSignalKind.incoming, incomingCall(id: 'call-2'));
      await pump();
      expect(signaling.busySignalled, contains('call-2'));
      expect(engine.incoming, isNull); // never surfaced
    });

    test('caller cancelled while we ring -> incoming dismissed as missed', () async {
      signaling.push(CallSignalKind.incoming, incomingCall());
      await pump();
      signaling.push(CallSignalKind.cancelled, incomingCall());
      await pump();
      expect(engine.incoming, isNull);
    });

    test('unanswered incoming auto-dismisses and records the miss', () async {
      signaling.push(CallSignalKind.incoming, incomingCall());
      await pump();
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(engine.incoming, isNull);
      expect(signaling.missed, contains('call-9'));
    });

    test('acceptById (killed-app CallKit path) fetches and connects', () async {
      signaling.fetchable['call-77'] = incomingCall(id: 'call-77');
      final result = await engine.acceptById('call-77');
      expect(result.isOk, isTrue);
      expect(signaling.accepted, contains('call-77'));
      transport.setState(CallTransportState.connected);
      await pump();
      expect(engine.active!.state, CallLifecycleState.connected);
    });

    test('acceptById on a dead call returns notFound', () async {
      final result = await engine.acceptById('gone');
      expect(result.errorOrNull!.kind, CommErrorKind.notFound);
    });
  });

  group('live call resilience', () {
    Future<void> goLive() async {
      await engine.startCall(draft());
      signaling.push(CallSignalKind.accepted, draft());
      await pump();
      transport.setState(CallTransportState.connected);
      await pump();
    }

    test('media blip: connected -> reconnecting -> connected; clock survives', () async {
      await goLive();
      now += 10000; // 10s of talk
      transport.setState(CallTransportState.reconnecting);
      await pump();
      expect(engine.active!.state, CallLifecycleState.reconnecting);
      expect(engine.elapsedSeconds, 10); // frozen during the blip

      now += 5000; // blip lasts 5s (not counted)
      transport.setState(CallTransportState.connected);
      await pump();
      expect(engine.active!.state, CallLifecycleState.connected);
      now += 3000;
      expect(engine.elapsedSeconds, 13); // 10 + 3, blip excluded
    });

    test('media failure keeps the call alive with a retry affordance', () async {
      await goLive();
      transport.setState(CallTransportState.failed);
      await pump();
      expect(engine.connectionFailed, isTrue);
      expect(engine.active!.state.isTerminal, isFalse); // call NOT dropped

      transport.failNextConnect = false;
      await engine.retryConnection();
      transport.setState(CallTransportState.connected);
      await pump();
      expect(engine.connectionFailed, isFalse);
      expect(engine.active!.state, CallLifecycleState.connected);
    });

    test('remote hangup ends the call and disconnects media', () async {
      await goLive();
      now += 8000;
      signaling.push(CallSignalKind.ended, draft());
      await pump();
      expect(engine.active!.state, CallLifecycleState.ended);
      expect(transport.disconnectCalls, greaterThan(0));
    });

    test('local hangUp reports duration to signaling', () async {
      await goLive();
      now += 42000;
      await engine.hangUp();
      expect(signaling.endedDurations['call-1'], 42);
      expect(engine.active!.state, CallLifecycleState.ended);
    });

    test('recoverActiveCall rejoins a live session after process death', () async {
      signaling.fetchable['call-55'] = CallSession(
        id: 'call-55',
        conversationId: 'c1',
        mode: CallMode.video,
        callerId: 'peer',
        state: CallLifecycleState.connected,
      );
      final result = await engine.recoverActiveCall('call-55', videoEnabled: true);
      expect(result.isOk, isTrue);
      expect(transport.connectCalls, 1);
      transport.setState(CallTransportState.connected);
      await pump();
      expect(engine.active!.state, CallLifecycleState.connected);
    });
  });

  group('group mode (same spine)', () {
    test('roster updates via participant events for a groupVideo call', () async {
      await engine.startCall(draft(id: 'g1', mode: CallMode.groupVideo));
      signaling.push(
        CallSignalKind.accepted,
        draft(id: 'g1', mode: CallMode.groupVideo),
      );
      await pump();
      transport.setState(CallTransportState.connected);
      await pump();

      transport.pushParticipant(
        CallParticipantEventKind.joined,
        const CallParticipant(userId: 'ada', displayName: 'Ada'),
      );
      transport.pushParticipant(
        CallParticipantEventKind.joined,
        const CallParticipant(userId: 'bo', displayName: 'Bo'),
      );
      transport.pushParticipant(
        CallParticipantEventKind.updated,
        const CallParticipant(userId: 'ada', displayName: 'Ada', isMuted: true),
      );
      await pump();
      expect(engine.active!.participants.length, 2);
      expect(
        engine.active!.participants.firstWhere((p) => p.userId == 'ada').isMuted,
        isTrue,
      );

      transport.pushParticipant(
        CallParticipantEventKind.left,
        const CallParticipant(userId: 'bo'),
      );
      await pump();
      expect(engine.active!.participants.single.userId, 'ada');
      expect(engine.active!.isGroup, isTrue);
    });
  });
}

// ---- fakes ------------------------------------------------------------------

class _FakeSignaling implements CallSignaling {
  final _signals = StreamController<CallSignal>.broadcast();
  final List<CallSession> invited = [];
  final List<String> accepted = [];
  final List<String> rejected = [];
  final List<String> busySignalled = [];
  final List<String> cancelled = [];
  final List<String> missed = [];
  final Map<String, int> endedDurations = {};
  final Map<String, CallSession> fetchable = {};

  void push(CallSignalKind kind, CallSession session) =>
      _signals.add(CallSignal(kind, session));

  @override
  Stream<CallSignal> get signals => _signals.stream;

  @override
  Future<Result<CallSession>> invite(CallSession session) async {
    invited.add(session);
    return Ok(session);
  }

  @override
  Future<Result<void>> accept(String callId) async {
    accepted.add(callId);
    return const Ok(null);
  }

  @override
  Future<Result<void>> reject(String callId) async {
    rejected.add(callId);
    return const Ok(null);
  }

  @override
  Future<Result<void>> busy(String callId) async {
    busySignalled.add(callId);
    return const Ok(null);
  }

  @override
  Future<Result<void>> cancel(String callId) async {
    cancelled.add(callId);
    return const Ok(null);
  }

  @override
  Future<Result<void>> end(String callId, {required int durationSeconds}) async {
    endedDurations[callId] = durationSeconds;
    return const Ok(null);
  }

  @override
  Future<Result<void>> markMissed(String callId) async {
    missed.add(callId);
    return const Ok(null);
  }

  @override
  Future<CallSession?> fetchCall(String callId) async => fetchable[callId];
}

class _FakeTransport implements CallTransport {
  final _states = StreamController<CallTransportState>.broadcast();
  final _participants = StreamController<CallParticipantEvent>.broadcast();
  CallTransportState _state = CallTransportState.idle;
  int connectCalls = 0;
  int disconnectCalls = 0;
  bool failNextConnect = false;

  void setState(CallTransportState next) {
    _state = next;
    _states.add(next);
  }

  void pushParticipant(CallParticipantEventKind kind, CallParticipant p) =>
      _participants.add(CallParticipantEvent(kind, p));

  @override
  Stream<CallTransportState> get states => _states.stream;

  @override
  CallTransportState get state => _state;

  @override
  Stream<CallParticipantEvent> get participantEvents => _participants.stream;

  @override
  Future<Result<void>> connect(
    CallSession session, {
    required bool videoEnabled,
  }) async {
    connectCalls += 1;
    if (failNextConnect) return Err(CommError.network('join failed'));
    return const Ok(null);
  }

  @override
  Future<void> setMuted(bool muted) async {}

  @override
  Future<void> setVideoEnabled(bool enabled) async {}

  @override
  Future<void> setSpeakerOn(bool speakerOn) async {}

  @override
  Future<void> flipCamera() async {}

  @override
  Future<void> setScreenShareEnabled(bool enabled) async {}

  @override
  Future<void> disconnect() async {
    disconnectCalls += 1;
  }
}
