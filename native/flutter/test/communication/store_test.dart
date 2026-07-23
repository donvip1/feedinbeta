import 'dart:math';

import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/data/message_store.dart';
import 'package:feedin/src/features/communication/data/outbox.dart';
import 'package:feedin/src/features/communication/data/sync_cursor_store.dart';
import 'package:feedin/src/features/communication/domain/content_block.dart';
import 'package:feedin/src/features/communication/domain/delivery_state.dart';
import 'package:feedin/src/features/communication/domain/hybrid_clock.dart';
import 'package:feedin/src/features/communication/domain/message_envelope.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  Future<CommunicationDatabase> openDb() =>
      CommunicationDatabase.open(databaseFactoryFfi, inMemoryDatabasePath);

  MessageEnvelope makeMessage({
    required String id,
    String conversationId = 'c1',
    int millis = 1000,
    int counter = 0,
    int revision = 0,
    DeliveryState state = DeliveryState.persisted,
  }) {
    return MessageEnvelope(
      id: id,
      conversationId: conversationId,
      senderId: 'u1',
      sentAt: HybridTimestamp(millis: millis, counter: counter, nodeId: 'n'),
      content: TextBlock('msg $id'),
      revision: revision,
      deliveryState: state,
    );
  }

  group('MessageStore', () {
    late CommunicationDatabase db;
    late MessageStore store;

    setUp(() async {
      db = await openDb();
      store = MessageStore(db);
    });

    tearDown(() => db.close());

    test('upsert + getById round-trips the full envelope', () async {
      final m = makeMessage(id: 'm1', revision: 2);
      await store.upsert(m);
      final loaded = await store.getById('m1');
      expect(loaded, isNotNull);
      expect(loaded!.revision, 2);
      expect((loaded.content as TextBlock).text, 'msg m1');
    });

    test('upsert is an idempotent merge: higher revision wins, echoes converge', () async {
      await store.upsert(makeMessage(id: 'm1', revision: 3, state: DeliveryState.read));
      // A stale realtime echo with lower revision must NOT clobber.
      final stored = await store.upsert(
        makeMessage(id: 'm1', revision: 1, state: DeliveryState.sent),
      );
      expect(stored.revision, 3);
      expect((await store.getById('m1'))!.deliveryState, DeliveryState.read);
      expect(await store.countForConversation('c1'), 1); // still one row
    });

    test('keyset pagination: newest-first, no gaps/overlaps, correct hasMore', () async {
      // 120 messages with strictly increasing HLC.
      for (var i = 0; i < 120; i++) {
        await store.upsert(makeMessage(id: 'm$i', millis: 1000 + i));
      }
      final p1 = await store.pageForConversation('c1', limit: 50);
      expect(p1.messages.length, 50);
      expect(p1.hasMore, isTrue);
      expect(p1.messages.first.id, 'm119'); // newest first

      final p2 = await store.pageForConversation(
        'c1',
        limit: 50,
        before: p1.messages.last,
      );
      expect(p2.messages.length, 50);
      expect(p2.hasMore, isTrue);

      final p3 = await store.pageForConversation(
        'c1',
        limit: 50,
        before: p2.messages.last,
      );
      expect(p3.messages.length, 20);
      expect(p3.hasMore, isFalse);

      // No overlaps, full coverage.
      final all = [...p1.messages, ...p2.messages, ...p3.messages];
      expect(all.map((m) => m.id).toSet().length, 120);
      // Strictly descending order across the pages.
      for (var i = 1; i < all.length; i++) {
        expect(all[i - 1].sentAt.compareTo(all[i].sentAt) > 0, isTrue);
      }
    });

    test('same-millis messages tie-break by counter in pages', () async {
      for (var i = 0; i < 5; i++) {
        await store.upsert(makeMessage(id: 't$i', millis: 5000, counter: i));
      }
      final page = await store.pageForConversation('c1', limit: 10);
      expect(page.messages.map((m) => m.id).toList(), [
        't4', 't3', 't2', 't1', 't0',
      ]);
    });

    test('conversations are isolated', () async {
      await store.upsert(makeMessage(id: 'a1', conversationId: 'cA'));
      await store.upsert(makeMessage(id: 'b1', conversationId: 'cB'));
      final page = await store.pageForConversation('cA', limit: 10);
      expect(page.messages.single.id, 'a1');
      expect(await store.countForConversation('cB'), 1);
    });

    test('setDeliveryState fast-path updates state', () async {
      await store.upsert(makeMessage(id: 'm1', state: DeliveryState.queued));
      await store.setDeliveryState('m1', DeliveryState.sent);
      expect((await store.getById('m1'))!.deliveryState, DeliveryState.sent);
    });

    test('scale sanity: 2000 messages, a page read stays fast', () async {
      final sw = Stopwatch()..start();
      await db.db.transaction((txn) async {
        for (var i = 0; i < 2000; i++) {
          final m = makeMessage(id: 'x$i', millis: i);
          await txn.insert('comm_messages', {
            'id': m.id,
            'conversation_id': m.conversationId,
            'sender_id': m.senderId,
            'sent_millis': m.sentAt.millis,
            'sent_counter': m.sentAt.counter,
            'revision': m.revision,
            'delivery_state': m.deliveryState.name,
            'deleted': 0,
            'envelope': '{"id":"${m.id}","conversationId":"c1","senderId":"u1",'
                '"sentAt":"${m.sentAt.encode()}","revision":0,'
                '"content":{"kind":"text","text":"x"},"deliveryState":"persisted",'
                '"encryption":{"alg":"none"}}',
          });
        }
      });
      final insertMs = sw.elapsedMilliseconds;
      sw.reset();
      final page = await store.pageForConversation('c1', limit: 50);
      final readMs = sw.elapsedMilliseconds;
      expect(page.messages.length, 50);
      // Index-backed page must be dramatically cheaper than a full scan;
      // generous bound to avoid CI flakiness.
      expect(readMs, lessThan(200));
      // ignore: avoid_print
      print('scale: 2000 inserts=${insertMs}ms, one page read=${readMs}ms');
    });
  });

  group('Outbox', () {
    late CommunicationDatabase db;
    late Outbox outbox;

    setUp(() async {
      db = await openDb();
      outbox = Outbox(db, random: Random(42));
    });

    tearDown(() => db.close());

    Future<void> enqueue(String id, {int now = 1000}) => outbox.enqueue(
      messageId: id,
      conversationId: 'c1',
      nowMillis: now,
    );

    test('enqueue is idempotent and immediately due', () async {
      await enqueue('m1');
      await enqueue('m1'); // duplicate ignored
      final due = await outbox.claimDue(nowMillis: 1000);
      expect(due.length, 1);
      expect(due.single.messageId, 'm1');
      expect(await outbox.pendingCount(), 1);
    });

    test('transient failure backs off exponentially and is not due early', () async {
      await enqueue('m1');
      await outbox.markFailed(
        messageId: 'm1',
        error: CommError.network('offline'),
        nowMillis: 1000,
      );
      // Not due immediately after failure.
      expect(await outbox.claimDue(nowMillis: 1001), isEmpty);
      // Attempt 1 backoff = base(2s) * 2^0 = 2000ms (+ ≤25% jitter).
      expect(await outbox.claimDue(nowMillis: 1000 + 2500 + 1), isNotEmpty);

      // Second failure doubles the wait.
      await outbox.markFailed(
        messageId: 'm1',
        error: CommError.network('offline'),
        nowMillis: 10000,
      );
      expect(await outbox.claimDue(nowMillis: 10000 + 3999), isEmpty);
      expect(await outbox.claimDue(nowMillis: 10000 + 5001), isNotEmpty);
    });

    test('permanent error dead-letters immediately', () async {
      await enqueue('m1');
      await outbox.markFailed(
        messageId: 'm1',
        error: CommError.validation('bad payload'),
        nowMillis: 1000,
      );
      expect(await outbox.claimDue(nowMillis: 999999999), isEmpty);
      final dead = await outbox.deadLetters();
      expect(dead.single.messageId, 'm1');
      expect(dead.single.lastError, contains('validation'));
      expect(await outbox.pendingCount(), 0);
    });

    test('attempt ceiling dead-letters after maxAttempts (never retries forever)', () async {
      final capped = Outbox(db, maxAttempts: 3, random: Random(1));
      await capped.enqueue(messageId: 'm1', conversationId: 'c1', nowMillis: 0);
      for (var i = 0; i < 3; i++) {
        await capped.markFailed(
          messageId: 'm1',
          error: CommError.network('flaky'),
          nowMillis: i * 100000,
        );
      }
      expect(await capped.claimDue(nowMillis: 999999999), isEmpty);
      expect((await capped.deadLetters()).single.attempts, 3);
    });

    test('backoff caps at maxBackoff', () async {
      final capped = Outbox(
        db,
        maxAttempts: 50,
        maxBackoff: const Duration(seconds: 10),
        random: Random(7),
      );
      await capped.enqueue(messageId: 'm1', conversationId: 'c1', nowMillis: 0);
      // Drive attempts high enough that uncapped backoff would be huge.
      for (var i = 0; i < 10; i++) {
        await capped.markFailed(
          messageId: 'm1',
          error: CommError.network('flaky'),
          nowMillis: 0,
        );
      }
      // Cap 10s + max 25% jitter = 12.5s worst case.
      expect(await capped.claimDue(nowMillis: 12501), isNotEmpty);
    });

    test('markSent removes; dead letter can be revived by the user', () async {
      await enqueue('m1');
      await enqueue('m2');
      await outbox.markSent('m1');
      expect(await outbox.pendingCount(), 1);

      await outbox.markFailed(
        messageId: 'm2',
        error: CommError.permission('blocked'),
        nowMillis: 1000,
      );
      expect((await outbox.deadLetters()).length, 1);
      await outbox.retryDeadLetter('m2', nowMillis: 2000);
      final due = await outbox.claimDue(nowMillis: 2000);
      expect(due.single.messageId, 'm2');
      expect(due.single.attempts, 0); // fresh window
    });

    test('claimDue returns oldest due first', () async {
      await enqueue('late', now: 5000);
      await enqueue('early', now: 1000);
      final due = await outbox.claimDue(nowMillis: 10000);
      expect(due.first.messageId, 'early');
    });
  });

  group('SyncCursorStore', () {
    late CommunicationDatabase db;
    late SyncCursorStore cursors;

    setUp(() async {
      db = await openDb();
      cursors = SyncCursorStore(db);
    });

    tearDown(() => db.close());

    test('read/write/replace/clear per scope', () async {
      expect(await cursors.read('messages'), isNull);
      await cursors.write('messages', '1000:abc', nowMillis: 1);
      await cursors.write('receipts', '55', nowMillis: 1);
      expect(await cursors.read('messages'), '1000:abc');

      await cursors.write('messages', '2000:def', nowMillis: 2); // replace
      expect(await cursors.read('messages'), '2000:def');
      expect(await cursors.read('receipts'), '55'); // scopes isolated

      await cursors.clear('messages');
      expect(await cursors.read('messages'), isNull);
      expect(await cursors.read('receipts'), '55');
    });
  });
}
