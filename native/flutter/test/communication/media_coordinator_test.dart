import 'dart:async';
import 'dart:math';

import 'package:crypto/crypto.dart';import 'package:feedin/src/features/communication/core/encryption/encryption_codec.dart';
import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/data/message_store.dart';
import 'package:feedin/src/features/communication/data/outbox.dart';
import 'package:feedin/src/features/communication/data/sync_cursor_store.dart';
import 'package:feedin/src/features/communication/domain/content_block.dart';
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
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  late CommunicationDatabase db;
  late MessageStore messageStore;
  late UploadTaskStore uploadStore;
  late _FakeBytes bytes;
  late _FakeStorage storage;
  late _FakeDelivery delivery;
  late MessagePipeline pipeline;
  late UploadManager uploads;
  late MediaMessageCoordinator coordinator;
  var now = 1000;

  setUp(() async {
    now = 1000;
    db = await CommunicationDatabase.open(
      databaseFactoryFfi,
      inMemoryDatabasePath,
    );
    messageStore = MessageStore(db);
    uploadStore = UploadTaskStore(db);
    bytes = _FakeBytes();
    storage = _FakeStorage();
    delivery = _FakeDelivery();
    pipeline = MessagePipeline(
      store: messageStore,
      outbox: Outbox(db, random: Random(3)),
      cursors: SyncCursorStore(db),
      transport: delivery,
      codec: const IdentityEncryptionCodec(),
      nowMillis: () => now,
    );
    uploads = UploadManager(
      store: uploadStore,
      transport: storage,
      bytes: bytes,
      chunkBytes: 10,
      nowMillis: () => now,
      random: Random(9),
    );
    coordinator = MediaMessageCoordinator(
      pipeline: pipeline,
      uploads: uploads,
      uploadStore: uploadStore,
      remotePathBuilder: (e) => 'conversations/${e.conversationId}/${e.id}',
    );
  });

  tearDown(() async {
    await coordinator.dispose();
    await uploads.dispose();
    await pipeline.dispose();
    await db.close();
  });

  MessageEnvelope makeImage(String id, {String path = '/local/img'}) =>
      MessageEnvelope(
        id: id,
        conversationId: 'c1',
        senderId: 'me',
        sentAt: const HybridTimestamp(millis: 1, counter: 0, nodeId: 'dev'),
        content: ImageBlock(MediaRef(localPath: path, mimeType: 'image/webp')),
      );

  Future<MediaSendEvent> waitFor(
    Stream<MediaSendEvent> events,
    MediaSendEventKind kind,
  ) =>
      events
          .firstWhere((e) => e.kind == kind)
          .timeout(const Duration(seconds: 10));

  test('invariant: no message exists before upload verifies; then it is sent', () async {
    bytes.files['/local/img'] = List<int>.generate(25, (i) => i);
    // Subscribe BEFORE anything runs so the terminal event can't be missed.
    final sentEvent = waitFor(coordinator.events, MediaSendEventKind.sent);

    final accepted = await coordinator.sendMedia(makeImage('m1'));
    expect(accepted.isOk, isTrue);

    // Upload queued but not run: NOTHING in the message store or on the wire.
    expect(await messageStore.getById('m1'), isNull);
    expect(delivery.delivered, isEmpty);

    await uploads.drain(); // upload completes + verifies -> handoff
    await sentEvent; // deterministic: handoff reached pipeline.send
    await pipeline.drain(); // settle the outbox delivery

    final stored = await messageStore.getById('m1');
    expect(stored, isNotNull);
    expect(stored!.deliveryState, DeliveryState.sent);
    final media = (stored.content as ImageBlock).media;
    expect(media.remoteUrl, 'conversations/c1/m1'); // uploaded ref swapped in
    expect(media.sha256, isNotNull);
    expect(delivery.delivered.single.id, 'm1');
    // Handoff consumed the upload row.
    expect(await uploadStore.getById('m1'), isNull);
  });

  test('upload failure means NO message is ever created; failed event emitted', () async {
    bytes.files['/local/img'] = List<int>.generate(25, (i) => i);
    storage.failEveryPut = true;

    final capped = UploadManager(
      store: uploadStore,
      transport: storage,
      bytes: bytes,
      chunkBytes: 10,
      maxAttempts: 1, // dead-letter on first failure
      nowMillis: () => now,
      random: Random(2),
    );
    final coord = MediaMessageCoordinator(
      pipeline: pipeline,
      uploads: capped,
      uploadStore: uploadStore,
      remotePathBuilder: (e) => 'x/${e.id}',
    );
    final failedEvent = waitFor(coord.events, MediaSendEventKind.failed);

    await coord.sendMedia(makeImage('m1'));
    await capped.drain();
    final failed = await failedEvent; // deterministic terminal signal

    expect(failed.envelope.id, 'm1');
    expect(await messageStore.getById('m1'), isNull); // invariant holds
    expect(delivery.delivered, isEmpty);

    await coord.dispose();
    await capped.dispose();
  });

  test('progress events flow to the UI stream', () async {
    bytes.files['/local/img'] = List<int>.generate(30, (i) => i);
    final progress = <double>[];
    final sub = coordinator.events.listen((e) {
      if (e.kind == MediaSendEventKind.progress) progress.add(e.progress);
    });
    final sentEvent = waitFor(coordinator.events, MediaSendEventKind.sent);

    await coordinator.sendMedia(makeImage('m1'));
    await uploads.drain();
    await sentEvent;
    await sub.cancel();

    expect(progress, isNotEmpty);
    expect(progress.last, 1.0);
  });

  test('crash between verify and handoff: recover() completes the send', () async {
    bytes.files['/local/img'] = List<int>.generate(20, (i) => i);

    // Simulate the crash: upload verifies with NO coordinator listening.
    await coordinator.dispose(); // detach the live listener
    await uploads.enqueue(
      id: 'm1',
      messageId: 'm1',
      localPath: '/local/img',
      remotePath: 'conversations/c1/m1',
      mimeType: 'image/webp',
    );
    await uploads.drain();
    expect((await uploadStore.verifiedTasks()).length, 1);
    expect(await messageStore.getById('m1'), isNull); // not yet a message

    // "Restart": a fresh coordinator recovers the verified upload. recover()
    // awaits the handoff inline, so no event-waiting is needed here.
    final revived = MediaMessageCoordinator(
      pipeline: pipeline,
      uploads: uploads,
      uploadStore: uploadStore,
      remotePathBuilder: (e) => 'conversations/${e.conversationId}/${e.id}',
    );
    final recovered = await revived.recover((id) async => makeImage(id));
    await pipeline.drain(); // settle the outbox delivery

    expect(recovered, 1);
    final stored = await messageStore.getById('m1');
    expect(stored!.deliveryState, DeliveryState.sent);
    expect((stored.content as ImageBlock).media.remoteUrl, 'conversations/c1/m1');
    expect(await uploadStore.verifiedTasks(), isEmpty); // row consumed
    await revived.dispose();
  });

  test('non-media content is rejected up front', () async {
    final result = await coordinator.sendMedia(
      MessageEnvelope(
        id: 'x',
        conversationId: 'c1',
        senderId: 'me',
        sentAt: const HybridTimestamp(millis: 1, counter: 0, nodeId: 'dev'),
        content: const TextBlock('not media'),
      ),
    );
    expect(result.isErr, isTrue);
    expect(result.errorOrNull!.kind, CommErrorKind.validation);
  });
}

// ---- fakes -----------------------------------------------------------------

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
  bool failEveryPut = false;

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
    if (failEveryPut) return Err(CommError.network('injected'));
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

class _FakeDelivery implements DeliveryTransport {
  final List<MessageEnvelope> delivered = [];
  int _revision = 1;

  @override
  Future<Result<int>> deliver(
    MessageEnvelope envelope,
    EncryptedPayload payload,
  ) async {
    delivered.add(envelope);
    return Ok(_revision++);
  }

  @override
  Future<Result<SyncPage>> fetchChanges({String? cursor, int limit = 100}) async =>
      const Ok(SyncPage(envelopes: [], hasMore: false));
}
