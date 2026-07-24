import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:feedin/src/features/communication/media/resumable_storage_transport.dart';
import 'package:feedin/src/features/communication/media/upload_byte_source.dart';
import 'package:feedin/src/features/communication/media/upload_manager.dart';
import 'package:feedin/src/features/communication/media/upload_task.dart';
import 'package:feedin/src/features/communication/media/upload_task_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  late CommunicationDatabase db;
  late UploadTaskStore store;
  late _FakeBytes bytes;
  late _FakeStorage storage;
  late UploadManager manager;
  var now = 1000;

  setUp(() async {
    now = 1000;
    db = await CommunicationDatabase.open(
      databaseFactoryFfi,
      inMemoryDatabasePath,
    );
    store = UploadTaskStore(db);
    bytes = _FakeBytes();
    storage = _FakeStorage();
    manager = UploadManager(
      store: store,
      transport: storage,
      bytes: bytes,
      chunkBytes: 10, // small chunks so tests exercise many boundaries
      nowMillis: () => now,
      random: Random(7),
    );
  });

  tearDown(() async {
    await manager.dispose();
    await db.close();
  });

  Future<UploadTask> enqueueFile(String id, List<int> content) async {
    bytes.files['/local/$id'] = content;
    return manager.enqueue(
      id: id,
      messageId: 'msg-$id',
      localPath: '/local/$id',
      remotePath: 'remote/$id',
      mimeType: 'application/octet-stream',
    );
  }

  test('enqueue persists size + local sha256 and is idempotent', () async {
    final content = List<int>.generate(25, (i) => i);
    final task = await enqueueFile('u1', content);
    expect(task.totalBytes, 25);
    expect(task.sha256, sha256.convert(content).toString());
    expect(task.state, UploadState.queued);

    final again = await enqueueFile('u1', content);
    expect(again.sentBytes, task.sentBytes); // unchanged row returned
  });

  test('happy path: chunked upload -> verified, bytes identical, progress emitted', () async {
    final content = List<int>.generate(25, (i) => i * 3 % 251);
    await enqueueFile('u1', content);

    final states = <UploadState>[];
    final sub = manager.updates.listen((t) => states.add(t.state));

    expect(await manager.drain(), 1);
    await Future<void>.delayed(Duration.zero);
    await sub.cancel();

    final task = (await manager.taskById('u1'))!;
    expect(task.state, UploadState.verified);
    expect(storage.objects['remote/u1'], content); // byte-exact
    expect(storage.putCalls, 3); // 10 + 10 + 5
    expect(states, contains(UploadState.uploading));
    expect(states.last, UploadState.verified);
  });

  test('transient failure mid-upload resumes from the confirmed offset', () async {
    final content = List<int>.generate(30, (i) => i);
    await enqueueFile('u1', content);
    storage.failPutAtCall = 2; // first chunk lands, second fails

    expect(await manager.drain(), 0);
    var task = (await manager.taskById('u1'))!;
    expect(task.state, UploadState.queued); // rescheduled, not dead
    expect(task.sentBytes, 10); // progress kept
    expect(task.attempts, 1);

    // Not due until backoff elapses.
    expect(await manager.drain(), 0);
    now += 60000;
    expect(await manager.drain(), 1);

    task = (await manager.taskById('u1'))!;
    expect(task.state, UploadState.verified);
    expect(storage.objects['remote/u1'], content);
    // Chunk 1 was NEVER re-sent: call 1 (ok) + call 2 (fail) + calls 3,4 (rest).
    expect(storage.putCalls, 4);
  });

  test('crash re-anchor: local offset behind remote resumes from remote', () async {
    final content = List<int>.generate(20, (i) => i + 5);
    final task = await enqueueFile('u1', content);
    // Simulate: one chunk landed remotely but the process died before the
    // local row recorded it.
    storage.objects['remote/u1'] = content.sublist(0, 10);
    await store.upsert(task.copyWith(sentBytes: 0));

    expect(await manager.drain(), 1);
    expect(storage.objects['remote/u1'], content);
    // Only the missing 10 bytes were sent (one put call).
    expect(storage.putCalls, 1);
  });

  test('pause at a chunk boundary, then resume to completion', () async {
    final content = List<int>.generate(40, (i) => i);
    await enqueueFile('u1', content);
    // Request pause after the second chunk lands.
    storage.onPut = (call) {
      if (call == 2) manager.pause('u1');
    };

    expect(await manager.drain(), 0);
    var task = (await manager.taskById('u1'))!;
    expect(task.state, UploadState.paused);
    expect(task.sentBytes, 20);

    storage.onPut = null;
    await manager.resume('u1');
    expect(await manager.drain(), 1);
    task = (await manager.taskById('u1'))!;
    expect(task.state, UploadState.verified);
    expect(storage.objects['remote/u1'], content);
  });

  test('cancel mid-upload aborts the remote partial', () async {
    final content = List<int>.generate(40, (i) => i);
    await enqueueFile('u1', content);
    storage.onPut = (call) {
      if (call == 1) manager.cancel('u1');
    };

    expect(await manager.drain(), 0);
    final task = (await manager.taskById('u1'))!;
    expect(task.state, UploadState.cancelled);
    expect(storage.aborted, contains('remote/u1'));
    expect(storage.objects.containsKey('remote/u1'), isFalse);
  });

  test('integrity mismatch is permanent: dead + remote aborted', () async {
    final content = List<int>.generate(15, (i) => i);
    await enqueueFile('u1', content);
    storage.corruptOnFinish = true; // remote hash won't match

    expect(await manager.drain(), 0);
    final task = (await manager.taskById('u1'))!;
    expect(task.state, UploadState.dead);
    expect(task.lastError, contains('Integrity'));
    expect(storage.aborted, contains('remote/u1'));
  });

  test('attempt ceiling dead-letters; retryDead revives and completes', () async {
    final capped = UploadManager(
      store: store,
      transport: storage,
      bytes: bytes,
      chunkBytes: 10,
      maxAttempts: 2,
      nowMillis: () => now,
      random: Random(1),
    );
    final content = List<int>.generate(10, (i) => i);
    bytes.files['/local/u1'] = content;
    await capped.enqueue(
      id: 'u1',
      messageId: 'm',
      localPath: '/local/u1',
      remotePath: 'remote/u1',
    );

    storage.failPutAtCall = -1; // fail every put
    await capped.drain();
    now += 60000;
    await capped.drain();
    var task = (await capped.taskById('u1'))!;
    expect(task.state, UploadState.dead);
    expect(task.lastError, contains('Retries exhausted'));

    storage.failPutAtCall = null;
    await capped.retryDead('u1');
    expect(await capped.drain(), 1);
    task = (await capped.taskById('u1'))!;
    expect(task.state, UploadState.verified);
    await capped.dispose();
  });

  test('openTasks restores non-terminal work after a restart', () async {
    await enqueueFile('u1', List<int>.generate(10, (i) => i));
    await enqueueFile('u2', List<int>.generate(10, (i) => i));
    await manager.pause('u2');
    expect(await manager.drain(), 1); // u1 verified

    final open = await store.openTasks();
    expect(open.map((t) => t.id).toList(), ['u2']); // only the paused one
  });
}

/// In-memory byte source.
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

/// In-memory resumable storage with failure injection.
class _FakeStorage implements ResumableStorageTransport {
  final Map<String, List<int>> objects = {};
  final List<String> aborted = [];
  int putCalls = 0;

  /// Fail the Nth put call (-1 = fail every call).
  int? failPutAtCall;
  bool corruptOnFinish = false;
  void Function(int call)? onPut;

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
    putCalls += 1;
    onPut?.call(putCalls);
    final failAt = failPutAtCall;
    if (failAt != null && (failAt == -1 || putCalls == failAt)) {
      return Err(CommError.network('injected put failure'));
    }
    final existing = objects.putIfAbsent(remotePath, () => <int>[]);
    if (offset != existing.length) {
      return Err(CommError.validation('offset gap: $offset vs ${existing.length}'));
    }
    existing.addAll(bytes);
    return Ok(existing.length);
  }

  @override
  Future<Result<String?>> remoteSha256(String remotePath) async {
    final data = objects[remotePath];
    if (data == null) return const Ok(null);
    if (corruptOnFinish) return const Ok('deadbeef');
    return Ok(sha256.convert(data).toString());
  }

  @override
  Future<Result<void>> abort(String remotePath) async {
    aborted.add(remotePath);
    objects.remove(remotePath);
    return const Ok(null);
  }
}
