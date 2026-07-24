import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:feedin/src/features/communication/core/encryption/encryption_codec.dart';
import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/data/conversation_store.dart';
import 'package:feedin/src/features/communication/data/message_store.dart';
import 'package:feedin/src/features/communication/data/outbox.dart';
import 'package:feedin/src/features/communication/data/sync_cursor_store.dart';
import 'package:feedin/src/features/communication/domain/content_block.dart';
import 'package:feedin/src/features/communication/domain/conversation.dart';
import 'package:feedin/src/features/communication/domain/delivery_state.dart';
import 'package:feedin/src/features/communication/domain/hybrid_clock.dart';
import 'package:feedin/src/features/communication/domain/message_envelope.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:feedin/src/features/communication/media/media_message_coordinator.dart';
import 'package:feedin/src/features/communication/media/resumable_storage_transport.dart';
import 'package:feedin/src/features/communication/media/upload_byte_source.dart';
import 'package:feedin/src/features/communication/media/upload_manager.dart';
import 'package:feedin/src/features/communication/media/upload_task_store.dart';
import 'package:feedin/src/features/communication/pipeline/delivery_transport.dart';
import 'package:feedin/src/features/communication/pipeline/message_pipeline.dart';
import 'package:feedin/src/features/communication/services/conversation_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  late CommunicationDatabase db;
  late ConversationStore conversations;
  late MessageStore messageStore;
  late _FakeDelivery delivery;
  late MessagePipeline pipeline;
  late UploadManager uploads;
  late MediaMessageCoordinator media;
  late ConversationService service;
  var now = 1000;
  var nextId = 0;

  setUp(() async {
    now = 1000;
    nextId = 0;
    db = await CommunicationDatabase.open(
      databaseFactoryFfi,
      inMemoryDatabasePath,
    );
    conversations = ConversationStore(db);
    messageStore = MessageStore(db);
    delivery = _FakeDelivery();
    pipeline = MessagePipeline(
      store: messageStore,
      outbox: Outbox(db, random: Random(5)),
      cursors: SyncCursorStore(db),
      transport: delivery,
      codec: const IdentityEncryptionCodec(),
      nowMillis: () => now,
    );
    final bytes = _FakeBytes();
    bytes.files['/local/photo'] = List<int>.generate(20, (i) => i);
    uploads = UploadManager(
      store: UploadTaskStore(db),
      transport: _FakeStorage(),
      bytes: bytes,
      chunkBytes: 10,
      nowMillis: () => now,
      random: Random(6),
    );
    media = MediaMessageCoordinator(
      pipeline: pipeline,
      uploads: uploads,
      uploadStore: UploadTaskStore(db),
      remotePathBuilder: (e) => 'conversations/${e.conversationId}/${e.id}',
    );
    service = ConversationService(
      conversations: conversations,
      pipeline: pipeline,
      media: media,
      clock: HybridClock('dev-1', nowMillis: () => now),
      newMessageId: () => 'msg-${nextId++}',
      nowMillis: () => now,
    );
  });

  tearDown(() async {
    await service.dispose();
    await media.dispose();
    await uploads.dispose();
    await pipeline.dispose();
    await db.close();
  });

  Conversation dm() => const Conversation(
    id: 'dm-1',
    type: ConversationType.dm,
    memberIds: ['me', 'you'],
  );

  Conversation groupChat() => const Conversation(
    id: 'grp-1',
    type: ConversationType.group,
    memberIds: ['me', 'you', 'them'],
    roles: {'me': MemberRole.member, 'you': MemberRole.owner},
    policy: ConversationPolicy.groupDefault,
    title: 'DevOps Squad',
  );

  Conversation broadcast() => const Conversation(
    id: 'bc-1',
    type: ConversationType.broadcast,
    memberIds: ['owner', 'sub'],
    roles: {'owner': MemberRole.owner, 'sub': MemberRole.subscriber},
    policy: ConversationPolicy.broadcastDefault,
    title: 'Creator Channel',
  );

  group('unified send across conversation types', () {
    test('DM and GROUP text go through the SAME pipeline (offline-first)', () async {
      await service.upsertConversation(dm());
      await service.upsertConversation(groupChat());

      final dmSend = await service.send(
        conversationId: 'dm-1',
        senderId: 'me',
        content: const TextBlock('hello dm'),
      );
      final groupSend = await service.send(
        conversationId: 'grp-1',
        senderId: 'me',
        content: const TextBlock('hello group'),
      );
      expect(dmSend.isOk, isTrue);
      expect(groupSend.isOk, isTrue);
      await pipeline.drain();

      // Both delivered via the one transport, both persisted + acknowledged.
      expect(delivery.delivered.map((e) => e.conversationId).toSet(), {
        'dm-1',
        'grp-1',
      });
      expect(
        (await messageStore.getById(groupSend.valueOrNull!.id))!.deliveryState,
        DeliveryState.sent,
      );
      // Group sends now have the outbox behind them — the legacy stack's raw
      // insert (message lost on flaky network) is structurally impossible here.
    });

    test('group send while offline queues and survives (legacy stack lost these)', () async {
      await service.upsertConversation(groupChat());
      delivery.failWith = CommError.network('offline');

      final send = await service.send(
        conversationId: 'grp-1',
        senderId: 'me',
        content: const TextBlock('offline group message'),
      );
      expect(send.isOk, isTrue); // accepted locally
      await pipeline.drain();
      expect(delivery.delivered, isEmpty);

      delivery.failWith = null;
      now += 60000; // past backoff
      await pipeline.drain();
      expect(delivery.delivered.single.conversationId, 'grp-1');
    });

    test('policy: subscriber cannot post to a broadcast; owner can', () async {
      await service.upsertConversation(broadcast());

      final denied = await service.send(
        conversationId: 'bc-1',
        senderId: 'sub',
        content: const TextBlock('hi'),
      );
      expect(denied.isErr, isTrue);
      expect(denied.errorOrNull!.kind, CommErrorKind.permission);
      expect(await messageStore.countForConversation('bc-1'), 0); // nothing queued

      final allowed = await service.send(
        conversationId: 'bc-1',
        senderId: 'owner',
        content: const TextBlock('announcement'),
      );
      expect(allowed.isOk, isTrue);
    });

    test('non-members and unknown conversations are refused', () async {
      await service.upsertConversation(dm());
      final stranger = await service.send(
        conversationId: 'dm-1',
        senderId: 'stranger',
        content: const TextBlock('let me in'),
      );
      expect(stranger.errorOrNull!.kind, CommErrorKind.permission);

      final unknown = await service.send(
        conversationId: 'nope',
        senderId: 'me',
        content: const TextBlock('?'),
      );
      expect(unknown.errorOrNull!.kind, CommErrorKind.notFound);
    });

    test('media into a GROUP routes through upload-verify-then-send', () async {
      await service.upsertConversation(groupChat());
      final accepted = await service.send(
        conversationId: 'grp-1',
        senderId: 'me',
        content: const ImageBlock(
          MediaRef(localPath: '/local/photo', mimeType: 'image/webp'),
        ),
      );
      expect(accepted.isOk, isTrue);
      final id = accepted.valueOrNull!.id;

      // Invariant holds for groups too: no message before verify.
      expect(await messageStore.getById(id), isNull);

      await uploads.drain();
      await media.events.firstWhere((e) => e.kind == MediaSendEventKind.sent)
          .timeout(const Duration(seconds: 10));
      await pipeline.drain();

      final stored = (await messageStore.getById(id))!;
      expect(stored.deliveryState, DeliveryState.sent);
      expect(
        (stored.content as ImageBlock).media.remoteUrl,
        'conversations/grp-1/$id',
      );
    });

    test('mentions are extracted from text', () async {
      await service.upsertConversation(groupChat());
      final send = await service.send(
        conversationId: 'grp-1',
        senderId: 'me',
        content: const TextBlock('ping @you and @them, not @you twice'),
      );
      expect(send.valueOrNull!.mentions, unorderedEquals(['you', 'them']));
    });
  });

  group('inbox', () {
    test('one ordered inbox across types + type filtering', () async {
      await service.upsertConversation(dm());
      await service.upsertConversation(groupChat());
      await service.upsertConversation(broadcast());

      now = 2000;
      await service.send(
        conversationId: 'grp-1',
        senderId: 'me',
        content: const TextBlock('newest activity'),
      );

      final all = await service.inbox();
      expect(all.first.id, 'grp-1'); // bumped to top by the send
      expect(all.length, 3);

      final chatsTab = await service.inbox(
        types: [ConversationType.dm, ConversationType.group],
      );
      expect(chatsTab.map((c) => c.id).toSet(), {'dm-1', 'grp-1'});

      final communities = await service.inbox(
        types: [ConversationType.broadcast],
      );
      expect(communities.single.id, 'bc-1');
    });

    test('conversation round-trips through the store with roles + policy', () async {
      await service.upsertConversation(broadcast());
      final loaded = (await service.conversationById('bc-1'))!;
      expect(loaded.type, ConversationType.broadcast);
      expect(loaded.roleOf('owner'), MemberRole.owner);
      expect(loaded.roleOf('sub'), MemberRole.subscriber);
      expect(loaded.canPost('sub'), isFalse);
      expect(loaded.title, 'Creator Channel');
    });
  });
}

// ---- fakes -------------------------------------------------------------------

class _FakeDelivery implements DeliveryTransport {
  final List<MessageEnvelope> delivered = [];
  CommError? failWith;
  int _revision = 1;

  @override
  Future<Result<int>> deliver(
    MessageEnvelope envelope,
    EncryptedPayload payload,
  ) async {
    final error = failWith;
    if (error != null) return Err(error);
    delivered.add(envelope);
    return Ok(_revision++);
  }

  @override
  Future<Result<SyncPage>> fetchChanges({String? cursor, int limit = 100}) async =>
      const Ok(SyncPage(envelopes: [], hasMore: false));
}

class _FakeBytes implements UploadByteSource {
  final Map<String, List<int>> files = {};

  @override
  Future<int> length(String localPath) async => files[localPath]!.length;

  @override
  Future<List<int>> read(String localPath, int offset, int count) async {
    final data = files[localPath]!;
    if (offset >= data.length) return const [];
    return data.sublist(offset, min(offset + count, data.length));
  }

  @override
  Future<String> sha256Of(String localPath) async =>
      sha256.convert(files[localPath]!).toString();
}

class _FakeStorage implements ResumableStorageTransport {
  final Map<String, List<int>> objects = {};

  @override
  Future<Result<int>> storedBytes(String remotePath) async =>
      Ok(objects[remotePath]?.length ?? 0);

  @override
  Future<Result<int>> putChunk(
    String remotePath,
    int offset,
    List<int> bytes, {
    required int totalBytes,
    String? mimeType,
  }) async {
    final existing = objects.putIfAbsent(remotePath, () => <int>[]);
    if (offset != existing.length) {
      return Err(CommError.validation('offset gap'));
    }
    existing.addAll(bytes);
    return Ok(existing.length);
  }

  @override
  Future<Result<String?>> remoteSha256(String remotePath) async {
    final data = objects[remotePath];
    if (data == null) return const Ok(null);
    return Ok(sha256.convert(data).toString());
  }

  @override
  Future<Result<void>> abort(String remotePath) async {
    objects.remove(remotePath);
    return const Ok(null);
  }
}
