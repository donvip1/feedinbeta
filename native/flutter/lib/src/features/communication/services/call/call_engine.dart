import 'dart:async';

import '../../domain/call_session.dart';
import '../../domain/result.dart';
import 'call_signaling.dart';
import 'call_transport.dart';

/// The permanent call lifecycle controller — one engine for every [CallMode]
/// (1:1 voice/video today; group/space/broadcast/webinar/stage are the same
/// spine with a different mode + policy).
///
/// Drives the LEGAL state machine ([CallLifecycleState.canTransitionTo]) over
/// two planes:
///  * control plane ([CallSignaling]) — invite/accept/reject/busy/cancel/end;
///  * media plane ([CallTransport]) — join once accepted, reconnect on blips.
///
/// Reliability rules:
///  * **Ring timeout** — an unanswered invite auto-marks missed on BOTH sides.
///  * **Busy** — a second incoming call while active is auto-signalled busy
///    (the caller stops ringing instead of timing out); duplicate call rows
///    are structurally impossible client-side.
///  * **Reconnect** — a media blip drives `connected -> reconnecting ->
///    connected` without touching the control plane; a media FAILURE keeps the
///    call alive with [connectionFailed] + [retryConnection] (never a silent
///    drop). Elapsed time survives reconnects.
///  * **Session recovery** — [recoverActiveCall] rejoins a still-live session
///    after process death (cold start with an active row).
class CallEngine {
  CallEngine({
    required CallSignaling signaling,
    required CallTransport transport,
    required this.selfUserId,
    this.ringTimeout = const Duration(seconds: 45),
    int Function()? nowMillis,
  }) : _signaling = signaling,
       _transport = transport,
       _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch) {
    _signalSub = _signaling.signals.listen(_onSignal);
    _mediaSub = _transport.states.listen(_onMediaState);
    _participantSub = _transport.participantEvents.listen(_onParticipantEvent);
  }

  final CallSignaling _signaling;
  final CallTransport _transport;
  final String selfUserId;
  final Duration ringTimeout;
  final int Function() _now;

  late final StreamSubscription<CallSignal> _signalSub;
  late final StreamSubscription<CallTransportState> _mediaSub;
  late final StreamSubscription<CallParticipantEvent> _participantSub;

  final _changes = StreamController<CallSession>.broadcast();

  /// Every state change of the active or incoming session (drives the UI).
  Stream<CallSession> get changes => _changes.stream;

  CallSession? _active;
  CallSession? get active => _active;

  CallSession? _incoming;
  CallSession? get incoming => _incoming;

  bool _connectFailed = false;
  bool get connectionFailed => _connectFailed;

  int _connectedAtMillis = 0;
  int _elapsedBeforeReconnect = 0;

  Timer? _ringTimer;
  bool _disposed = false;

  bool get hasActiveCall => _active != null && !_active!.state.isTerminal;

  /// Elapsed connected seconds (survives reconnects).
  int get elapsedSeconds {
    if (_active?.state != CallLifecycleState.connected || _connectedAtMillis == 0) {
      return _elapsedBeforeReconnect ~/ 1000;
    }
    return (_elapsedBeforeReconnect + (_now() - _connectedAtMillis)) ~/ 1000;
  }

  // -- Outgoing ------------------------------------------------------------------

  /// Place a call. Refuses while another call is active (no duplicate calls).
  Future<Result<CallSession>> startCall(CallSession draft) async {
    if (_disposed) return Err(CommError.unknown('engine disposed'));
    if (hasActiveCall) {
      return Err(CommError.conflict('Already in a call'));
    }
    _connectFailed = false;
    _elapsedBeforeReconnect = 0;
    _connectedAtMillis = 0;

    final inviting = draft.transition(CallLifecycleState.inviting);
    final created = await _signaling.invite(inviting);
    if (created.isErr) return Err(created.errorOrNull!);

    _setActive(created.valueOrNull!.transition(CallLifecycleState.ringing));
    _startRingTimer(onExpire: () async {
      final current = _active;
      if (current == null || current.state != CallLifecycleState.ringing) return;
      await _signaling.markMissed(current.id);
      _finish(current, CallLifecycleState.missed);
    });
    return Ok(_active!);
  }

  // -- Incoming ------------------------------------------------------------------

  Future<void> acceptIncoming({bool videoEnabled = false}) async {
    final call = _incoming;
    if (call == null) return;
    _incoming = null;
    _cancelRingTimer();
    _connectFailed = false;
    _elapsedBeforeReconnect = 0;
    _connectedAtMillis = 0;

    await _signaling.accept(call.id);
    _setActive(call.transition(CallLifecycleState.connecting));
    await _joinMedia(videoEnabled: videoEnabled);
  }

  /// Accept by id (killed-app CallKit path — no in-memory incoming session).
  Future<Result<CallSession>> acceptById(
    String callId, {
    bool videoEnabled = false,
  }) async {
    if (_incoming?.id == callId) {
      await acceptIncoming(videoEnabled: videoEnabled);
      return Ok(_active!);
    }
    if (hasActiveCall) return Err(CommError.conflict('Already in a call'));
    final call = await _signaling.fetchCall(callId);
    if (call == null || call.state.isTerminal) {
      return Err(CommError.notFound('Call no longer available'));
    }
    _incoming = call;
    await acceptIncoming(videoEnabled: videoEnabled);
    return Ok(_active!);
  }

  Future<void> declineIncoming() async {
    final call = _incoming;
    if (call == null) return;
    _incoming = null;
    _cancelRingTimer();
    await _signaling.reject(call.id);
    _emit(call.transition(CallLifecycleState.rejected));
  }

  // -- In-call --------------------------------------------------------------------

  /// Hang up: cancel while ringing, end while live. Always tears down media.
  Future<void> hangUp() async {
    final call = _active;
    if (call == null) return;
    _cancelRingTimer();
    final seconds = elapsedSeconds;

    if (call.state == CallLifecycleState.ringing ||
        call.state == CallLifecycleState.inviting) {
      await _signaling.cancel(call.id);
      _finish(call, CallLifecycleState.missed);
    } else {
      await _signaling.end(call.id, durationSeconds: seconds);
      _finish(call, CallLifecycleState.ended);
    }
    await _transport.disconnect();
  }

  /// Retry the media plane after [connectionFailed] without touching the
  /// control plane (the call row stays live).
  Future<void> retryConnection({bool videoEnabled = false}) async {
    final call = _active;
    if (call == null || call.state.isTerminal) return;
    _connectFailed = false;
    _setActive(call.transition(CallLifecycleState.connecting));
    await _joinMedia(videoEnabled: videoEnabled);
  }

  /// Rejoin a still-live session after process death (cold start).
  Future<Result<CallSession>> recoverActiveCall(
    String callId, {
    bool videoEnabled = false,
  }) async {
    if (hasActiveCall) return Ok(_active!);
    final call = await _signaling.fetchCall(callId);
    if (call == null || call.state.isTerminal) {
      return Err(CommError.notFound('No live session to recover'));
    }
    _setActive(call.copyWith(state: CallLifecycleState.connecting));
    await _joinMedia(videoEnabled: videoEnabled);
    return Ok(_active!);
  }

  /// Clear a finished call (ended screen dismissed).
  void reset() {
    if (_active?.state.isTerminal ?? true) {
      _active = null;
      _connectFailed = false;
      _elapsedBeforeReconnect = 0;
      _connectedAtMillis = 0;
    }
  }

  // -- Control-plane signals --------------------------------------------------------

  Future<void> _onSignal(CallSignal signal) async {
    switch (signal.kind) {
      case CallSignalKind.incoming:
        await _onIncoming(signal.session);
      case CallSignalKind.accepted:
        final call = _active;
        if (call != null &&
            call.id == signal.session.id &&
            call.state == CallLifecycleState.ringing) {
          _cancelRingTimer();
          _setActive(call.transition(CallLifecycleState.connecting));
          await _joinMedia(videoEnabled: call.mode.isVideo);
        }
      case CallSignalKind.rejected:
      case CallSignalKind.busy:
        _remoteFinish(signal.session.id, CallLifecycleState.rejected);
      case CallSignalKind.cancelled:
        // Caller cancelled while we were ringing.
        if (_incoming?.id == signal.session.id) {
          final ringing = _incoming!;
          _incoming = null;
          _cancelRingTimer();
          _emit(ringing.transition(CallLifecycleState.missed));
        } else {
          _remoteFinish(signal.session.id, CallLifecycleState.missed);
        }
      case CallSignalKind.ended:
        _remoteFinish(signal.session.id, CallLifecycleState.ended);
      case CallSignalKind.timeout:
        _remoteFinish(signal.session.id, CallLifecycleState.missed);
    }
  }

  Future<void> _onIncoming(CallSession call) async {
    // Busy: already in a call or another one is ringing — signal busy so the
    // caller stops ringing instead of waiting out the timeout.
    if (hasActiveCall || _incoming != null) {
      await _signaling.busy(call.id);
      return;
    }
    _incoming = call.copyWith(state: CallLifecycleState.ringing);
    _emit(_incoming!);
    _startRingTimer(onExpire: () async {
      final ringing = _incoming;
      if (ringing == null || ringing.id != call.id) return;
      _incoming = null;
      await _signaling.markMissed(ringing.id);
      _emit(ringing.transition(CallLifecycleState.missed));
    });
  }

  // -- Media plane --------------------------------------------------------------------

  Future<void> _joinMedia({required bool videoEnabled}) async {
    final call = _active;
    if (call == null) return;
    final joined = await _transport.connect(call, videoEnabled: videoEnabled);
    if (joined.isErr && _active?.id == call.id) {
      _connectFailed = true;
      _emit(_active!); // state unchanged; failure flag drives the retry UI
    }
  }

  void _onMediaState(CallTransportState state) {
    final call = _active;
    if (call == null || call.state.isTerminal) return;
    switch (state) {
      case CallTransportState.connected:
        _connectFailed = false;
        _connectedAtMillis = _now();
        _setActive(call.transition(CallLifecycleState.connected));
      case CallTransportState.reconnecting:
        if (call.state == CallLifecycleState.connected) {
          _elapsedBeforeReconnect += _now() - _connectedAtMillis;
          _connectedAtMillis = 0;
          _setActive(call.transition(CallLifecycleState.reconnecting));
        }
      case CallTransportState.failed:
        _connectFailed = true;
        _emit(call);
      case CallTransportState.idle:
      case CallTransportState.connecting:
      case CallTransportState.disconnected:
        break;
    }
  }

  void _onParticipantEvent(CallParticipantEvent event) {
    final call = _active;
    if (call == null) return;
    final roster = List<CallParticipant>.of(call.participants);
    roster.removeWhere((p) => p.userId == event.participant.userId);
    if (event.kind != CallParticipantEventKind.left) {
      roster.add(event.participant);
    }
    _setActive(call.copyWith(participants: roster));
  }

  // -- Internals -------------------------------------------------------------------------

  void _remoteFinish(String callId, CallLifecycleState terminal) {
    final call = _active;
    if (call == null || call.id != callId || call.state.isTerminal) return;
    if (call.state == CallLifecycleState.connected ||
        call.state == CallLifecycleState.reconnecting) {
      _elapsedBeforeReconnect = elapsedSeconds * 1000;
    }
    _finish(call, terminal);
    unawaited(_transport.disconnect());
  }

  void _finish(CallSession call, CallLifecycleState terminal) {
    _cancelRingTimer();
    _setActive(call.transition(terminal).copyWith(endedAtMillis: _now()));
  }

  void _setActive(CallSession session) {
    _active = session;
    _emit(session);
  }

  void _emit(CallSession session) {
    if (!_changes.isClosed) _changes.add(session);
  }

  void _startRingTimer({required Future<void> Function() onExpire}) {
    _cancelRingTimer();
    _ringTimer = Timer(ringTimeout, () => unawaited(onExpire()));
  }

  void _cancelRingTimer() {
    _ringTimer?.cancel();
    _ringTimer = null;
  }

  Future<void> dispose() async {
    _disposed = true;
    _cancelRingTimer();
    await _signalSub.cancel();
    await _mediaSub.cancel();
    await _participantSub.cancel();
    await _transport.disconnect();
    await _changes.close();
  }
}
