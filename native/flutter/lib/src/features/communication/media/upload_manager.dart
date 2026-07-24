import 'dart:async';
import 'dart:math';

import '../domain/result.dart';
import 'resumable_storage_transport.dart';
import 'upload_byte_source.dart';
import 'upload_task.dart';
import 'upload_task_store.dart';

/// The Media Engine's upload core: a durable queue of chunked, resumable
/// uploads with pause/cancel/progress and end-to-end integrity verification.
///
/// Guarantees:
///  * **Resume, don't restart** — progress is persisted per chunk and
///    re-anchored against the remote's confirmed offset, so a crash or network
///    drop mid-upload continues from the last stored byte.
///  * **A message is never created before upload succeeds** — a task reaches
///    [UploadState.verified] only after every byte is stored AND the remote
///    hash (when available) matches the local sha256; the pipeline only builds
///    the MessageEnvelope from a verified task.
///  * **Never stuck** — transient failures back off with a cap and attempt
///    ceiling (dead-letter + manual retry), integrity mismatches are permanent
///    (remote object aborted).
class UploadManager {
  UploadManager({
    required UploadTaskStore store,
    required ResumableStorageTransport transport,
    required UploadByteSource bytes,
    this.chunkBytes = 256 * 1024,
    this.maxAttempts = 6,
    this.baseBackoff = const Duration(seconds: 2),
    this.maxBackoff = const Duration(minutes: 10),
    int Function()? nowMillis,
    Random? random,
  }) : _store = store,
       _transport = transport,
       _bytes = bytes,
       _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch),
       _random = random ?? Random();

  final UploadTaskStore _store;
  final ResumableStorageTransport _transport;
  final UploadByteSource _bytes;
  final int chunkBytes;
  final int maxAttempts;
  final Duration baseBackoff;
  final Duration maxBackoff;
  final int Function() _now;
  final Random _random;

  final _updates = StreamController<UploadTask>.broadcast();

  /// Progress + state changes for every task (drives progress rings).
  Stream<UploadTask> get updates => _updates.stream;

  /// Pause/cancel requests observed between chunks of an active run.
  final Set<String> _pauseRequested = {};
  final Set<String> _cancelRequested = {};

  Future<int>? _drainInFlight;

  /// Persist a new upload task (state `queued`) and return it. Computes the
  /// local sha256 up front so integrity is anchored to the bytes as enqueued.
  Future<UploadTask> enqueue({
    required String id,
    required String messageId,
    required String localPath,
    required String remotePath,
    String? mimeType,
  }) async {
    final existing = await _store.getById(id);
    if (existing != null) return existing; // idempotent

    final task = UploadTask(
      id: id,
      messageId: messageId,
      localPath: localPath,
      remotePath: remotePath,
      mimeType: mimeType,
      totalBytes: await _bytes.length(localPath),
      sha256: await _bytes.sha256Of(localPath),
      state: UploadState.queued,
      createdAt: _now(),
    );
    await _store.upsert(task);
    _emit(task);
    return task;
  }

  /// Run every due task to completion/pause/failure. Concurrent calls coalesce
  /// onto one pass. Returns how many tasks reached `verified` this pass.
  Future<int> drain() {
    final inFlight = _drainInFlight;
    if (inFlight != null) return inFlight;
    final pass = _drainPass();
    _drainInFlight = pass;
    pass.whenComplete(() {
      if (identical(_drainInFlight, pass)) _drainInFlight = null;
    });
    return pass;
  }

  Future<int> _drainPass() async {
    var verified = 0;
    final due = await _store.claimDue(nowMillis: _now());
    for (final task in due) {
      final done = await _run(task);
      if (done) verified += 1;
    }
    return verified;
  }

  /// Returns true when the task reached `verified`.
  Future<bool> _run(UploadTask start) async {
    var task = start.copyWith(state: UploadState.uploading);
    await _persist(task);

    // Re-anchor the resume point on the remote's confirmed offset — the local
    // row can be behind (crash after a chunk landed) but never ahead.
    final remotePath = task.remotePath!;
    final anchored = await _transport.storedBytes(remotePath);
    if (anchored.isErr) return _failTransient(task, anchored.errorOrNull!);
    var offset = max(task.sentBytes, anchored.valueOrNull!);

    while (offset < task.totalBytes) {
      if (_cancelRequested.remove(task.id)) return _cancel(task);
      if (_pauseRequested.remove(task.id)) {
        await _persist(task.copyWith(sentBytes: offset, state: UploadState.paused));
        return false;
      }
      final chunk = await _bytes.read(
        task.localPath,
        offset,
        min(chunkBytes, task.totalBytes - offset),
      );
      if (chunk.isEmpty) {
        return _failPermanent(task, 'Local file truncated during upload');
      }
      final put = await _transport.putChunk(
        remotePath,
        offset,
        chunk,
        totalBytes: task.totalBytes,
        mimeType: task.mimeType,
      );
      if (put.isErr) {
        return _failTransientAt(task, offset, put.errorOrNull!);
      }
      offset = put.valueOrNull!;
      task = task.copyWith(sentBytes: offset);
      await _persist(task);
    }

    // All bytes stored — verify integrity before declaring success.
    final remoteHash = await _transport.remoteSha256(remotePath);
    if (remoteHash.isErr) return _failTransient(task, remoteHash.errorOrNull!);
    final expected = task.sha256;
    final actual = remoteHash.valueOrNull;
    if (actual != null && expected != null && actual != expected) {
      await _transport.abort(remotePath);
      return _failPermanent(task, 'Integrity mismatch (sha256)');
    }
    await _persist(task.copyWith(state: UploadState.verified));
    return true;
  }

  // -- User controls -----------------------------------------------------------

  /// Pause: takes effect at the next chunk boundary (or immediately if queued).
  Future<void> pause(String id) async {
    final task = await _store.getById(id);
    if (task == null || task.state.isTerminal) return;
    if (task.state == UploadState.queued) {
      await _persist(task.copyWith(state: UploadState.paused));
    } else {
      _pauseRequested.add(id);
    }
  }

  /// Resume a paused task (re-queues it; drain() picks it up).
  Future<void> resume(String id) async {
    final task = await _store.getById(id);
    if (task == null || task.state != UploadState.paused) return;
    await _persist(task.copyWith(state: UploadState.queued, nextAttemptAt: _now()));
  }

  /// Cancel: aborts the remote partial and terminally marks the task.
  Future<void> cancel(String id) async {
    final task = await _store.getById(id);
    if (task == null || task.state.isTerminal) return;
    if (task.state == UploadState.uploading) {
      _cancelRequested.add(id); // handled at the next chunk boundary
    } else {
      await _cancel(task);
    }
  }

  /// Manual retry of a dead task with a fresh attempt window.
  Future<void> retryDead(String id) async {
    final task = await _store.getById(id);
    if (task == null || task.state != UploadState.dead) return;
    await _persist(task.copyWith(
      state: UploadState.queued,
      attempts: 0,
      nextAttemptAt: _now(),
    ));
  }

  Future<UploadTask?> taskById(String id) => _store.getById(id);

  // -- Internals ----------------------------------------------------------------

  Future<bool> _cancel(UploadTask task) async {
    if (task.remotePath != null) {
      await _transport.abort(task.remotePath!);
    }
    await _persist(task.copyWith(state: UploadState.cancelled));
    return false;
  }

  Future<bool> _failTransient(UploadTask task, CommError error) =>
      _failTransientAt(task, task.sentBytes, error);

  Future<bool> _failTransientAt(
    UploadTask task,
    int offset,
    CommError error,
  ) async {
    if (!error.isTransient) {
      return _failPermanent(task, error.message);
    }
    final attempts = task.attempts + 1;
    if (attempts >= maxAttempts) {
      return _failPermanent(task, 'Retries exhausted: ${error.message}');
    }
    await _persist(task.copyWith(
      sentBytes: offset,
      state: UploadState.queued,
      attempts: attempts,
      nextAttemptAt: _now() + _backoffMillis(attempts),
      lastError: error.message,
    ));
    return false;
  }

  Future<bool> _failPermanent(UploadTask task, String message) async {
    await _persist(task.copyWith(state: UploadState.dead, lastError: message));
    return false;
  }

  Future<void> _persist(UploadTask task) async {
    await _store.upsert(task);
    _emit(task);
  }

  void _emit(UploadTask task) {
    if (!_updates.isClosed) _updates.add(task);
  }

  int _backoffMillis(int attempts) {
    final exp = baseBackoff.inMilliseconds * pow(2, attempts - 1);
    final capped = min(exp.toDouble(), maxBackoff.inMilliseconds.toDouble());
    return (capped + _random.nextDouble() * 0.25 * capped).round();
  }

  Future<void> dispose() async {
    await _updates.close();
  }
}
