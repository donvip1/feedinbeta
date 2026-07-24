import 'dart:async';

import 'package:feedin/src/features/communication/core/realtime/realtime_multiplexer.dart';
import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/domain/presence.dart';
import 'package:feedin/src/features/communication/domain/receipt.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:feedin/src/features/communication/services/presence_engine.dart';
import 'package:feedin/src/features/communication/services/receipt_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  group('ReceiptService', () {
    late CommunicationDatabase db;
    late _FakeReceiptTransport transport;
    late ReceiptService receipts;
    var now = 1000;

    setUp(() async {
      now = 1000;
      db = await CommunicationDatabase.open(
        databaseFactoryFfi,
        inMemoryDatabasePath,
      );
      transport = _FakeReceiptTransport();
      receipts = ReceiptService(
        database: db,
        transport: transport,
        nowMillis: () => now,
      );
    });

    tearDown(() async {
      await receipts.dispose();
      await db.close();
    });

    test('markDelivered then markRead builds one monotonic receipt', () async {
      await receipts.markDelivered(
        messageId: 'm1', conversationId: 'c1', userId: 'peer');
      now = 5000;
      await receipts.markRead(
        messageId: 'm1', conversationId: 'c1', userId: 'peer');

      final r = (await receipts.receiptFor('m1', 'peer'))!;
      expect(r.deliveredAtMillis, 1000); // earliest kept
      expect(r.readAtMillis, 5000);
      expect(r.isRead, isTrue);
    });

    test('remote apply merges idempotently and never regresses read', () async {
      await receipts.applyRemote(
        const Receipt(messageId: 'm1', userId: 'peer', deliveredAtMillis: 100, readAtMillis: 200),
        conversationId: 'c1',
      );
      // A stale delivered-only echo arrives later — read must survive.
      await receipts.applyRemote(
        const Receipt(messageId: 'm1', userId: 'peer', deliveredAtMillis: 150),
        conversationId: 'c1',
      );
      final r = (await receipts.receiptFor('m1', 'peer'))!;
      expect(r.readAtMillis, 200);
      expect(r.deliveredAtMillis, 100);
    });

    test('flush publishes pending batch once; failure keeps rows pending', () async {
      await receipts.markRead(messageId: 'm1', conversationId: 'c1', userId: 'me');
      await receipts.markRead(messageId: 'm2', conversationId: 'c1', userId: 'me');
      expect(await receipts.pendingCount(), 2);

      transport.failWith = CommError.network('offline');
      await receipts.flush();
      expect(await receipts.pendingCount(), 2); // still pending
      expect(transport.published, isEmpty);

      transport.failWith = null;
      await receipts.flush();
      expect(await receipts.pendingCount(), 0);
      expect(transport.published.single.length, 2);

      await receipts.flush(); // nothing left -> no extra publish
      expect(transport.published.length, 1);
    });

    test('remote applies are NOT re-published, local marks are', () async {
      await receipts.applyRemote(
        const Receipt(messageId: 'm1', userId: 'peer', readAtMillis: 100),
        conversationId: 'c1',
      );
      expect(await receipts.pendingCount(), 0);

      await receipts.markRead(messageId: 'm1', conversationId: 'c1', userId: 'me');
      expect(await receipts.pendingCount(), 1);
    });

    test('markManyRead is one transaction; summary answers the tick question', () async {
      await receipts.markManyRead(
        messageIds: ['m1', 'm2', 'm3'],
        conversationId: 'c1',
        userId: 'peerA',
      );
      await receipts.applyRemote(
        const Receipt(messageId: 'm1', userId: 'peerB', deliveredAtMillis: 10),
        conversationId: 'c1',
      );

      final s1 = await receipts.summaryFor('m1', recipientCount: 2, excludeUserId: 'sender');
      expect(s1.deliveredToAny, isTrue);
      expect(s1.readByAny, isTrue);
      expect(s1.readByAll, isFalse); // B delivered but not read

      await receipts.applyRemote(
        const Receipt(messageId: 'm1', userId: 'peerB', readAtMillis: 20),
        conversationId: 'c1',
      );
      final s2 = await receipts.summaryFor('m1', recipientCount: 2, excludeUserId: 'sender');
      expect(s2.readByAll, isTrue);
      expect(s2.readCount, 2);
    });

    test('sender is excluded from their own summary', () async {
      await receipts.markRead(messageId: 'm1', conversationId: 'c1', userId: 'sender');
      final s = await receipts.summaryFor('m1', recipientCount: 1, excludeUserId: 'sender');
      expect(s.readByAny, isFalse);
    });
  });

  group('PresenceEngine', () {
    late _FakePresenceTransport transport;
    late _FakeTransportMux mux;
    late RealtimeMultiplexer multiplexer;
    late PresenceEngine presence;
    var now = 100000;

    setUp(() {
      now = 100000;
      transport = _FakePresenceTransport();
      mux = _FakeTransportMux();
      multiplexer = RealtimeMultiplexer(mux);
      presence = PresenceEngine(
        transport: transport,
        multiplexer: multiplexer,
        selfUserId: 'me',
        nowMillis: () => now,
      );
    });

    tearDown(() async {
      await presence.dispose();
      await multiplexer.stop();
    });

    test('typing is debounced: many keystrokes, few publishes', () async {
      // 30 keystrokes in one second: leading edge only (refresh = 1.5s).
      for (var i = 0; i < 30; i++) {
        now += 33;
        presence.typing('c1');
      }
      final typingPublishes =
          transport.states.where((s) => s == PresenceState.typing).length;
      expect(typingPublishes, 1); // legacy stack: one RPC per toggle

      // After the refresh window another keystroke re-publishes.
      now += 2000;
      presence.typing('c1');
      expect(
        transport.states.where((s) => s == PresenceState.typing).length,
        2,
      );
    });

    test('switching conversations re-publishes immediately; stopTyping publishes online', () {
      presence.typing('c1');
      presence.typing('c2'); // conversation change bypasses throttle
      expect(
        transport.states.where((s) => s == PresenceState.typing).length,
        2,
      );
      presence.stopTyping('c2');
      expect(transport.states.last, PresenceState.online);
    });

    test('goOnline publishes and goOffline is definitive', () async {
      await presence.goOnline();
      expect(transport.states.first, PresenceState.online);
      await presence.goOffline();
      expect(transport.states.last, PresenceState.offline);
    });

    test('watch applies TTL: stale typing degrades to online, stale online to offline', () async {
      final seen = <PresenceState>[];
      final sub = presence.watch('peer', (p) => seen.add(p.state));

      // Fresh typing arrives -> typing.
      mux.emit('presence:peer', {
        'state': 'typing',
        'updatedAtMillis': now,
        'conversationId': 'c1',
      });
      // Stale typing (7s old > 6s activity TTL) -> online.
      mux.emit('presence:peer', {
        'state': 'typing',
        'updatedAtMillis': now - 7000,
      });
      // Stale online (2min old > 90s TTL) -> offline.
      mux.emit('presence:peer', {
        'state': 'online',
        'updatedAtMillis': now - 120000,
      });
      await Future<void>.delayed(Duration.zero);

      expect(seen, [
        PresenceState.typing,
        PresenceState.online,
        PresenceState.offline,
      ]);
      await sub.cancel();
    });

    test('peer watching rides the shared multiplexer (one join per user)', () async {
      final subA = presence.watch('peer', (_) {});
      final subB = presence.watch('peer', (_) {});
      expect(mux.joinCounts['presence:peer'], 1);
      await subA.cancel();
      await subB.cancel();
      expect(mux.leftTopics, contains('presence:peer'));
    });
  });
}

// ---- fakes ---------------------------------------------------------------------

class _FakeReceiptTransport implements ReceiptTransport {
  final List<List<Receipt>> published = [];
  CommError? failWith;

  @override
  Future<Result<void>> publish(List<Receipt> receipts) async {
    final error = failWith;
    if (error != null) return Err(error);
    published.add(List.of(receipts));
    return const Ok(null);
  }
}

class _FakePresenceTransport implements PresenceTransport {
  final List<PresenceState> states = [];

  @override
  Future<Result<void>> publish(Presence presence) async {
    states.add(presence.state);
    return const Ok(null);
  }
}

class _FakeTransportMux implements RealtimeTransport {
  final Map<String, StreamController<RealtimeEvent>> _topics = {};
  final Map<String, int> joinCounts = {};
  final List<String> leftTopics = [];
  final _conn = StreamController<RealtimeConnectionState>.broadcast();

  @override
  Stream<RealtimeConnectionState> get connectionStates => _conn.stream;

  @override
  Future<void> connect() async {}

  @override
  Future<void> disconnect() async {}

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
