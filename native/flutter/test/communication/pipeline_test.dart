import 'package:feedin/src/features/communication/core/encryption/encryption_codec.dart';
import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/data/message_store.dart';
import 'package:feedin/src/features/communication/data/outbox.dart';
import 'package:feedin/src/features/communication/data/sync_cursor_store.dart';
import 'package:feedin/src/features/communication/domain/content_block.dart';
import 'package:feedin/src/features/communication/domain/delivery_state.dart';
import 'package:feedin/src/features/communication/domain/hybrid_clock.dart';
import 'package:feedin/src/features/communication/domain/message_envelope.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:feedin/src/features/communication/pipeline/delivery_transport.dart';
import 'package:feedin/src/features/communication/pipeline/message_pipeline.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  late CommunicationDatabase db;
  late MessageStore store;
  late Outbox outbox;
  late SyncCursorStore cursors;
  late _FakeTransport transport;
  late MessagePipeline pipeline;
  var now = 1000;

  setUp(() async {
    now = 1000;
    db = await CommunicationDatabase.open(
      databaseFactoryFfi,
      inMemoryDatabasePath,
    );
    store = MessageStore(db);
    outbox = Outbox(db);
    cursors = SyncCursorStore(db);
    transport = _FakeTransport();
    pipeline = MessagePipeline(
      store: store,
      outbox: outbox,
      cursors: cursors,
      transport: transport,
      codec: const IdentityEncryptionCodec(),
      nowMillis: () => now,
    );
  });

  tearDown(() async {
    await pipeline.dispose();
    await db.close();
  });

  MessageEnvelope make(String id, {String text = 'hello', int millis = 1}) =>
      MessageEnvelope(
        id: id,
        conversationId: 'c1',
        senderId: 'me',
        sentAt: HybridTimestamp(millis: millis, counter: 0, nodeId: 'dev1'),
        content: TextBlock(text),
      );

  group('send', () {
    test('invalid message is rejected: nothing stored, nothing queued', () async {
      final result = await pipeline.send(make('bad', text: '   '));
      expect(result.isErr, isTrue);
      expect(result.errorOrNull!.kind, CommErrorKind.validation);
      expect(await store.getById('bad'), isNull);
      expect(await outbox.pendingCount(), 0);
    });

    test('happy path: optimistic queued -> drained -> sent with server revision', () async {
      final updates = <MessageEnvelope>[];
      final sub = pipeline.updates.listen(updates.add);

      final sent = await pipeline.send(make('m1'));
      expect(sent.isOk, isTrue);
      expect(sent.valueOrNull!.deliveryState, DeliveryState.queued);

      // send() triggers an async drain; settle it.
      await pipeline.drain();
      final stored = await store.getById('m1');
      expect(stored!.deliveryState, DeliveryState.sent);
      expect(stored.revision, 1); // server-assigned
      expect(await outbox.pendingCount(), 0);
      expect(transport.delivered.single.$2.alg, 'none'); // through the codec

      await sub.cancel();
      expect(
        updates.map((u) => u.deliveryState),
        contains(DeliveryState.queued),
      );
      expect(updates.map((u) => u.deliveryState), contains(DeliveryState.sent));
    });

    test('offline: message survives, backs off, delivers on recovery (never lost)', () async {
      transport.failWith = CommError.network('offline');
      await pipeline.send(make('m1'));
      await pipeline.drain();

      // Still pending, not dead, not delivered.
      expect(await outbox.pendingCount(), 1);
      expect((await store.getById('m1'))!.deliveryState, DeliveryState.queued);

      // Not due before backoff elapses.
      transport.failWith = null;
      expect(await pipeline.drain(), 0);

      // After the backoff window it delivers.
      now += 10000;
      expect(await pipeline.drain(), 1);
      expect((await store.getById('m1'))!.deliveryState, DeliveryState.sent);
      expect(await outbox.pendingCount(), 0);
    });

    test('permanent error dead-letters + marks failed; retryFailed revives', () async {
      transport.failWith = CommError.validation('rejected by server');
      await pipeline.send(make('m1'));
      await pipeline.drain();

      expect((await store.getById('m1'))!.deliveryState, DeliveryState.failed);
      expect((await outbox.deadLetters()).single.messageId, 'm1');
      expect(await outbox.pendingCount(), 0);

      transport.failWith = null;
      await pipeline.retryFailed('m1');
      await pipeline.drain();
      expect((await store.getById('m1'))!.deliveryState, DeliveryState.sent);
      expect(await outbox.deadLetters(), isEmpty);
    });

    test('duplicate send of the same id converges to one row, one delivery', () async {
      await pipeline.send(make('m1'));
      await pipeline.drain(); // settle: m1 acknowledged (sent, revision 1)

      // Re-sending the same id (e.g. a retried UI action or second device echo)
      // must be a no-op: the acknowledged copy wins and nothing is re-enqueued.
      final again = await pipeline.send(make('m1'));
      await pipeline.drain();

      expect(again.valueOrNull!.deliveryState, DeliveryState.sent);
      expect(await store.countForConversation('c1'), 1);
      expect(transport.delivered.length, 1);
      expect(await outbox.pendingCount(), 0);
    });
  });

  group('receive', () {
    test('applyRemote merges without regressing (stale echo ignored)', () async {
      await pipeline.applyRemote(
        make('r1').copyWith(revision: 5, deliveryState: DeliveryState.read),
      );
      final after = await pipeline.applyRemote(
        make('r1').copyWith(revision: 2, deliveryState: DeliveryState.sent),
      );
      expect(after.revision, 5);
      expect(after.deliveryState, DeliveryState.read);
    });

    test('reconcile pages all changes, applies them, persists the cursor', () async {
      transport.pages = [
        SyncPage(
          envelopes: [make('a', millis: 1), make('b', millis: 2)],
          nextCursor: 'cur-1',
          hasMore: true,
        ),
        SyncPage(
          envelopes: [make('c', millis: 3)],
          nextCursor: 'cur-2',
          hasMore: false, // caught up
        ),
      ];
      final result = await pipeline.reconcile();
      expect(result.valueOrNull, 3);
      expect(await store.countForConversation('c1'), 3);
      // Cursor covers the FINAL page too, so it is never refetched.
      expect(await cursors.read(MessagePipeline.messagesCursorScope), 'cur-2');
      // The second fetch resumed from the first page's cursor.
      expect(transport.fetchCursors, [null, 'cur-1']);
    });

    test('reconcile resumes from the persisted cursor after a failure', () async {
      transport.pages = [
        SyncPage(envelopes: [make('a', millis: 1)], nextCursor: 'cur-1', hasMore: true),
      ];
      transport.failFetchAfterPages = 1; // page 2 fails
      final first = await pipeline.reconcile();
      expect(first.isErr, isTrue);
      // Progress up to the failure was kept.
      expect(await store.getById('a'), isNotNull);
      expect(await cursors.read(MessagePipeline.messagesCursorScope), 'cur-1');

      // Recovery: next reconcile resumes from cur-1, not from scratch.
      transport.failFetchAfterPages = null;
      transport.pages = [
        SyncPage(envelopes: [make('b', millis: 2)], nextCursor: 'cur-2', hasMore: false),
      ];
      transport.fetchCursors.clear();
      final second = await pipeline.reconcile();
      expect(second.valueOrNull, 1);
      expect(transport.fetchCursors.single, 'cur-1');
    });
  });
}

/// Fake [DeliveryTransport]: acknowledges with incrementing revisions, can be
/// forced to fail, and serves scripted reconcile pages.
class _FakeTransport implements DeliveryTransport {
  CommError? failWith;
  int _nextRevision = 1;
  final Map<String, int> _acceptedRevisions = {};
  final List<(MessageEnvelope, EncryptedPayload)> delivered = [];

  List<SyncPage> _pages = const [];
  int _pageIndex = 0;
  int? failFetchAfterPages;
  final List<String?> fetchCursors = [];

  /// Reassigning the scripted pages restarts the paging sequence.
  set pages(List<SyncPage> value) {
    _pages = value;
    _pageIndex = 0;
  }

  @override
  Future<Result<int>> deliver(
    MessageEnvelope envelope,
    EncryptedPayload payload,
  ) async {
    final error = failWith;
    if (error != null) return Err(error);
    // Idempotent on id: a redelivery returns the original revision.
    final revision = _acceptedRevisions.putIfAbsent(
      envelope.id,
      () => _nextRevision++,
    );
    delivered.add((envelope, payload));
    return Ok(revision);
  }

  @override
  Future<Result<SyncPage>> fetchChanges({String? cursor, int limit = 100}) async {
    fetchCursors.add(cursor);
    final failAfter = failFetchAfterPages;
    if (failAfter != null && _pageIndex >= failAfter) {
      return Err(CommError.network('fetch failed'));
    }
    if (_pageIndex >= _pages.length) {
      return const Ok(SyncPage(envelopes: [], nextCursor: null));
    }
    return Ok(_pages[_pageIndex++]);
  }
}
