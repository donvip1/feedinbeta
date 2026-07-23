import 'dart:async';

import 'package:feedin/src/features/communication/core/encryption/encryption_codec.dart';
import 'package:feedin/src/features/communication/core/realtime/realtime_multiplexer.dart';
import 'package:feedin/src/features/communication/domain/call_session.dart';
import 'package:feedin/src/features/communication/domain/content_block.dart';
import 'package:feedin/src/features/communication/domain/conversation.dart';
import 'package:feedin/src/features/communication/domain/delivery_state.dart';
import 'package:feedin/src/features/communication/domain/hybrid_clock.dart';
import 'package:feedin/src/features/communication/domain/message_envelope.dart';
import 'package:feedin/src/features/communication/domain/presence.dart';
import 'package:feedin/src/features/communication/domain/receipt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('HybridClock / HybridTimestamp', () {
    test('issueLocal is strictly increasing even when wall clock is frozen', () {
      var t = 1000;
      final clock = HybridClock('nodeA', nowMillis: () => t);
      final a = clock.issueLocal();
      final b = clock.issueLocal(); // same wall time -> counter bumps
      t = 1005;
      final c = clock.issueLocal();
      expect(a < b, isTrue);
      expect(b < c, isTrue);
      expect(a.counter, 0);
      expect(b.counter, 1);
      expect(c.millis, 1005);
      expect(c.counter, 0);
    });

    test('observe advances past a remote timestamp (causality)', () {
      var t = 1000;
      final clock = HybridClock('nodeA', nowMillis: () => t);
      final remote = const HybridTimestamp(millis: 5000, counter: 3, nodeId: 'nodeB');
      final merged = clock.observe(remote);
      expect(merged > remote, isTrue);
      // A subsequent local event sorts after the merged one.
      final next = clock.issueLocal();
      expect(next > merged, isTrue);
    });

    test('encode/decode round-trips and nodeId may contain colons', () {
      const ts = HybridTimestamp(millis: 42, counter: 7, nodeId: 'a:b:c');
      final decoded = HybridTimestamp.tryDecode(ts.encode());
      expect(decoded, ts);
      expect(HybridTimestamp.tryDecode('garbage'), isNull);
    });
  });

  group('DeliveryState', () {
    test('classification helpers', () {
      expect(DeliveryState.queued.isInFlight, isTrue);
      expect(DeliveryState.read.isAcknowledged, isTrue);
      expect(DeliveryState.failed.canRetry, isTrue);
      expect(DeliveryState.read.reached(DeliveryState.sent), isTrue);
      expect(DeliveryState.sent.reached(DeliveryState.read), isFalse);
    });
  });

  group('ContentBlock validation + json', () {
    test('text validation', () {
      expect(const TextBlock('hi').validate().isOk, isTrue);
      expect(const TextBlock('   ').validate().isErr, isTrue);
    });

    test('poll requires >=2 options', () {
      expect(
        const PollBlock(question: 'Q', options: ['a']).validate().isErr,
        isTrue,
      );
      expect(
        const PollBlock(question: 'Q', options: ['a', 'b']).validate().isOk,
        isTrue,
      );
    });

    test('voice note requires duration and media', () {
      expect(
        const VoiceNoteBlock(MediaRef(localPath: '/x.m4a'), durationMs: 0)
            .validate()
            .isErr,
        isTrue,
      );
      expect(
        const VoiceNoteBlock(MediaRef(localPath: '/x.m4a'), durationMs: 500)
            .validate()
            .isOk,
        isTrue,
      );
    });

    test('fromJson round-trips known kinds and falls back for unknown', () {
      final blocks = <ContentBlock>[
        const TextBlock('hello'),
        const StickerBlock('s1'),
        const ImageBlock(MediaRef(remoteUrl: 'https://x/y.jpg', sizeBytes: 10)),
        const PollBlock(question: 'Q', options: ['a', 'b'], multiple: true),
        const CallEventBlock(callId: 'c1', outcome: 'ended', durationSeconds: 12),
      ];
      for (final b in blocks) {
        final round = ContentBlock.fromJson(b.toJson());
        expect(round.kind, b.kind);
      }
      final unknown = ContentBlock.fromJson({'kind': 'hologram', 'x': 1});
      expect(unknown.kind, ContentBlockKind.unsupported);
      expect(unknown.validate().isOk, isTrue); // never crashes an old client
    });
  });

  group('MessageEnvelope', () {
    MessageEnvelope make({
      int revision = 0,
      DeliveryState state = DeliveryState.persisted,
      ContentBlock? content,
    }) {
      return MessageEnvelope(
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u1',
        sentAt: const HybridTimestamp(millis: 100, counter: 0, nodeId: 'n'),
        content: content ?? const TextBlock('hi'),
        revision: revision,
        deliveryState: state,
      );
    }

    test('validate delegates to content + checks ids', () {
      expect(make().validate().isOk, isTrue);
      expect(make(content: const TextBlock('')).validate().isErr, isTrue);
    });

    test('mergedWith: higher revision wins', () {
      final a = make(revision: 1);
      final b = make(revision: 2, state: DeliveryState.read);
      expect(a.mergedWith(b).revision, 2);
      expect(b.mergedWith(a).revision, 2);
    });

    test('mergedWith: equal revision breaks by furthest delivery state', () {
      final a = make(revision: 1, state: DeliveryState.sent);
      final b = make(revision: 1, state: DeliveryState.read);
      expect(a.mergedWith(b).deliveryState, DeliveryState.read);
    });

    test('json round-trip preserves identity + content + encryption', () {
      final env = make(revision: 3).copyWith(
        deliveryState: DeliveryState.delivered,
      );
      final round = MessageEnvelope.fromJson(env.toJson());
      expect(round.id, env.id);
      expect(round.revision, 3);
      expect(round.content.kind, ContentBlockKind.text);
      expect(round.encryption.alg, 'none');
      expect(round.deliveryState, DeliveryState.delivered);
    });
  });

  group('Conversation policy', () {
    test('DM: both members can post and call', () {
      final c = Conversation(
        id: 'c',
        type: ConversationType.dm,
        memberIds: const ['u1', 'u2'],
      );
      expect(c.canPost('u1'), isTrue);
      expect(c.canStartCall('u2'), isTrue);
      expect(c.dmPeer('u1'), 'u2');
      expect(c.canPost('stranger'), isFalse);
    });

    test('broadcast: only privileged roles post', () {
      final c = Conversation(
        id: 'b',
        type: ConversationType.broadcast,
        memberIds: const ['owner', 'sub'],
        roles: const {'owner': MemberRole.owner, 'sub': MemberRole.subscriber},
        policy: ConversationPolicy.broadcastDefault,
      );
      expect(c.canPost('owner'), isTrue);
      expect(c.canPost('sub'), isFalse);
      expect(c.canStartCall('sub'), isFalse);
      expect(c.canStartCall('owner'), isTrue);
    });

    test('group: members can invite when policy allows', () {
      final c = Conversation(
        id: 'g',
        type: ConversationType.group,
        memberIds: const ['u1'],
        policy: ConversationPolicy.groupDefault,
      );
      expect(c.canInvite('u1'), isTrue);
    });
  });

  group('CallSession lifecycle', () {
    test('legal + illegal transitions', () {
      expect(CallLifecycleState.idle.canTransitionTo(CallLifecycleState.ringing), isTrue);
      expect(CallLifecycleState.connecting.canTransitionTo(CallLifecycleState.connected), isTrue);
      expect(CallLifecycleState.connected.canTransitionTo(CallLifecycleState.reconnecting), isTrue);
      expect(CallLifecycleState.ended.canTransitionTo(CallLifecycleState.connected), isFalse);
      expect(CallLifecycleState.idle.canTransitionTo(CallLifecycleState.connected), isFalse);
    });

    test('transition() rejects illegal jumps and applies legal ones', () {
      const s = CallSession(
        id: 'call1',
        conversationId: 'c1',
        mode: CallMode.groupVideo,
        callerId: 'u1',
        state: CallLifecycleState.idle,
      );
      expect(s.transition(CallLifecycleState.connected).state, CallLifecycleState.idle);
      final ringing = s.transition(CallLifecycleState.ringing);
      expect(ringing.state, CallLifecycleState.ringing);
      expect(s.isGroup, isTrue);
      expect(s.isVideo, isTrue);
    });

    test('mode classification', () {
      expect(CallMode.voice.isGroup, isFalse);
      expect(CallMode.space.isGroup, isTrue);
      expect(CallMode.groupVoice.isVideo, isFalse);
      expect(CallMode.stage.isVideo, isTrue);
    });
  });

  group('Presence', () {
    test('transient activity clears to online after TTL; connection to offline', () {
      const typing = Presence(
        userId: 'u',
        state: PresenceState.typing,
        updatedAtMillis: 0,
      );
      expect(typing.effective(10000, ttlSeconds: 6), PresenceState.online);
      const online = Presence(
        userId: 'u',
        state: PresenceState.online,
        updatedAtMillis: 0,
      );
      expect(online.effective(200000, ttlSeconds: 90), PresenceState.offline);
      expect(online.effective(1000, ttlSeconds: 90), PresenceState.online);
    });
  });

  group('Receipt', () {
    test('merge keeps earliest delivered/read; summary aggregates', () {
      const a = Receipt(messageId: 'm', userId: 'u', deliveredAtMillis: 100);
      const b = Receipt(messageId: 'm', userId: 'u', deliveredAtMillis: 50, readAtMillis: 200);
      final merged = a.mergedWith(b);
      expect(merged.deliveredAtMillis, 50);
      expect(merged.readAtMillis, 200);

      const summary = ReceiptSummary(
        [
          Receipt(messageId: 'm', userId: 'x', deliveredAtMillis: 1, readAtMillis: 2),
          Receipt(messageId: 'm', userId: 'y', deliveredAtMillis: 1),
        ],
        recipientCount: 2,
      );
      expect(summary.deliveredToAny, isTrue);
      expect(summary.readByAny, isTrue);
      expect(summary.readByAll, isFalse);
      expect(summary.readCount, 1);
    });
  });

  group('EncryptionCodec (identity seam)', () {
    test('encrypt/decrypt round-trips and stamps alg none', () {
      const codec = IdentityEncryptionCodec();
      final plain = {'kind': 'text', 'text': 'secret'};
      final enc = codec.encrypt('c1', plain);
      expect(enc.alg, 'none');
      expect(codec.decrypt('c1', enc), plain);
      expect(codec.info.isEncrypted, isFalse);
    });
  });

  group('RealtimeMultiplexer', () {
    test('N subscribers to one topic => one physical join; fan-out; ref-counted leave', () async {
      final fake = _FakeTransport();
      final mux = RealtimeMultiplexer(fake);
      await mux.start();
      expect(fake.connected, isTrue);

      final aEvents = <RealtimeEvent>[];
      final bEvents = <RealtimeEvent>[];
      final subA = mux.subscribe('topic:1', aEvents.add);
      final subB = mux.subscribe('topic:1', bEvents.add);

      expect(fake.joinCounts['topic:1'], 1); // single physical join
      expect(mux.subscriberCount('topic:1'), 2);

      fake.emit('topic:1', {'n': 1});
      await Future<void>.delayed(Duration.zero);
      expect(aEvents.length, 1);
      expect(bEvents.length, 1);
      expect(aEvents.single.payload['n'], 1);

      await subA.cancel();
      expect(fake.leftTopics, isEmpty); // B still listening
      expect(mux.subscriberCount('topic:1'), 1);

      await subB.cancel();
      expect(fake.leftTopics, contains('topic:1')); // last one out -> physical leave
      expect(mux.activeTopicCount, 0);

      await mux.stop();
      expect(fake.connected, isFalse);
    });

    test('distinct topics get distinct physical subscriptions', () async {
      final fake = _FakeTransport();
      final mux = RealtimeMultiplexer(fake);
      await mux.start();
      mux.subscribe('a', (_) {});
      mux.subscribe('b', (_) {});
      expect(mux.activeTopicCount, 2);
      expect(fake.joinCounts['a'], 1);
      expect(fake.joinCounts['b'], 1);
      await mux.stop();
    });
  });
}

/// A fake [RealtimeTransport] for tests: records joins/leaves and lets the test
/// emit events per topic.
class _FakeTransport implements RealtimeTransport {
  final _connState = StreamController<RealtimeConnectionState>.broadcast();
  final Map<String, StreamController<RealtimeEvent>> _topics = {};
  final Map<String, int> joinCounts = {};
  final List<String> leftTopics = [];
  bool connected = false;

  @override
  Stream<RealtimeConnectionState> get connectionStates => _connState.stream;

  @override
  Future<void> connect() async {
    connected = true;
    _connState.add(RealtimeConnectionState.connected);
  }

  @override
  Future<void> disconnect() async {
    connected = false;
    _connState.add(RealtimeConnectionState.disconnected);
  }

  @override
  Stream<RealtimeEvent> join(String topic) {
    joinCounts[topic] = (joinCounts[topic] ?? 0) + 1;
    final controller = StreamController<RealtimeEvent>.broadcast();
    _topics[topic] = controller;
    return controller.stream;
  }

  @override
  Future<void> leave(String topic) async {
    leftTopics.add(topic);
    await _topics.remove(topic)?.close();
  }

  void emit(String topic, Map<String, Object?> payload) {
    _topics[topic]?.add(RealtimeEvent(topic, payload));
  }
}
