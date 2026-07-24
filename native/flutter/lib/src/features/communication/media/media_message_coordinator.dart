import 'dart:async';

import '../domain/content_block.dart';
import '../domain/message_envelope.dart';
import '../domain/result.dart';
import '../pipeline/message_pipeline.dart';
import 'upload_manager.dart';
import 'upload_task.dart';
import 'upload_task_store.dart';

/// Bridges the Media Engine and the Message Pipeline, enforcing the platform
/// invariant: **a message is never created before its upload succeeds.**
///
/// Flow for a media message:
///   1. [sendMedia] validates the envelope, then enqueues the attachment with
///      the [UploadManager] — the message does NOT enter the pipeline yet. The
///      draft envelope is persisted alongside the upload row so it survives
///      restarts.
///   2. When the task reaches [UploadState.verified], the coordinator swaps the
///      block's local [MediaRef] for the uploaded one (remote path + sha256)
///      and only THEN hands the envelope to [MessagePipeline.send].
///   3. On terminal failure/cancel the draft is surfaced through [events] as
///      failed — nothing half-sent ever reaches the server.
///
/// [recover] replays this handoff for uploads that verified right before a
/// crash, so the invariant also holds across process death.
class MediaMessageCoordinator {
  MediaMessageCoordinator({
    required MessagePipeline pipeline,
    required UploadManager uploads,
    required UploadTaskStore uploadStore,
    required String Function(MessageEnvelope envelope) remotePathBuilder,
  }) : _pipeline = pipeline,
       _uploads = uploads,
       _uploadStore = uploadStore,
       _remotePathBuilder = remotePathBuilder {
    _uploadSub = _uploads.updates.listen(_onUploadUpdate);
  }

  final MessagePipeline _pipeline;
  final UploadManager _uploads;
  final UploadTaskStore _uploadStore;

  /// Builds the storage object path for an envelope (e.g.
  /// `conversations/<cid>/<messageId>`), keeping bucket layout out of this class.
  final String Function(MessageEnvelope envelope) _remotePathBuilder;

  late final StreamSubscription<UploadTask> _uploadSub;

  /// Drafts awaiting upload, keyed by upload-task id (== message id).
  final Map<String, MessageEnvelope> _drafts = {};

  /// In-flight handoffs, so [dispose] can settle them before teardown and a
  /// verified event arriving twice can't double-send.
  final Map<String, Future<void>> _handoffs = {};

  final _events = StreamController<MediaSendEvent>.broadcast();

  /// Progress + terminal events for media sends (drives bubbles' progress ring
  /// and failed state).
  Stream<MediaSendEvent> get events => _events.stream;

  /// Begin a media send. Returns the draft envelope on acceptance (upload
  /// queued) or a validation error. The message will enter the pipeline
  /// automatically once the upload verifies.
  Future<Result<MessageEnvelope>> sendMedia(MessageEnvelope envelope) async {
    final content = envelope.content;
    if (content is! MediaContentBlock) {
      return Err(
        CommError.validation('sendMedia requires a media content block'),
      );
    }
    final valid = envelope.validate();
    if (valid.isErr) return Err(valid.errorOrNull!);
    final localPath = (content as MediaContentBlock).media.localPath;
    if (localPath == null || localPath.isEmpty) {
      return Err(CommError.validation('Media has no local file to upload'));
    }

    _drafts[envelope.id] = envelope;
    await _uploads.enqueue(
      id: envelope.id, // upload task id == message id (idempotent, recoverable)
      messageId: envelope.id,
      localPath: localPath,
      remotePath: _remotePathBuilder(envelope),
      mimeType: (content as MediaContentBlock).media.mimeType,
    );
    _events.add(MediaSendEvent.queued(envelope));
    unawaited(_uploads.drain());
    return Ok(envelope);
  }

  /// Replay handoffs for uploads that verified before a crash. Call once on
  /// startup with a [draftResolver] that can rebuild the draft envelope for a
  /// message id (e.g. from the message store where the caller persisted it).
  Future<int> recover(
    Future<MessageEnvelope?> Function(String messageId) draftResolver,
  ) async {
    var recovered = 0;
    for (final task in await _uploadStore.verifiedTasks()) {
      final draft = _drafts[task.messageId] ?? await draftResolver(task.messageId);
      if (draft == null) continue;
      _drafts[task.messageId] = draft;
      await _startHandoff(task);
      recovered += 1;
    }
    return recovered;
  }

  Future<void> _onUploadUpdate(UploadTask task) async {
    final draft = _drafts[task.messageId];
    if (draft == null) return; // not one of ours (e.g. story upload)

    switch (task.state) {
      case UploadState.verified:
        await _startHandoff(task);
      case UploadState.dead:
      case UploadState.cancelled:
        _drafts.remove(task.messageId);
        _events.add(MediaSendEvent.failed(draft, task.lastError));
      case UploadState.uploading:
        _events.add(MediaSendEvent.progress(draft, task.progress));
      case UploadState.queued:
      case UploadState.paused:
        break;
    }
  }

  /// Run the handoff exactly once per task, tracked so dispose() can await it.
  Future<void> _startHandoff(UploadTask task) {
    return _handoffs.putIfAbsent(task.id, () {
      final run = _handoff(task);
      run.whenComplete(() => _handoffs.remove(task.id));
      return run;
    });
  }

  Future<void> _handoff(UploadTask task) async {
    final draft = _drafts.remove(task.messageId);
    if (draft == null) return;

    final content = draft.content as MediaContentBlock;
    final uploaded = draft.copyWith(
      content: content.withMedia(
        MediaRef(
          remoteUrl: task.remotePath,
          sha256: task.sha256,
          sizeBytes: task.totalBytes,
          mimeType: task.mimeType,
          localPath: content.media.localPath, // keep for instant local render
        ),
      ),
    );
    final sent = await _pipeline.send(uploaded);
    await sent.fold(
      (envelope) async {
        // Handoff complete — the upload row has served its purpose.
        await _uploadStore.delete(task.id);
        _events.add(MediaSendEvent.sent(envelope));
      },
      (error) async {
        // Pipeline refused (should be rare — validation ran up front). Keep the
        // verified row so recover() can retry after the cause is fixed.
        _drafts[task.messageId] = draft;
        _events.add(MediaSendEvent.failed(draft, error.message));
      },
    );
  }

  Future<void> dispose() async {
    await _uploadSub.cancel();
    // Settle in-flight handoffs so teardown never races a live pipeline send.
    for (final handoff in List<Future<void>>.of(_handoffs.values)) {
      try {
        await handoff;
      } catch (_) {}
    }
    await _events.close();
  }
}

/// What happened to a media send.
enum MediaSendEventKind { queued, progress, sent, failed }

class MediaSendEvent {
  const MediaSendEvent._(this.kind, this.envelope, {this.progress = 0, this.error});

  factory MediaSendEvent.queued(MessageEnvelope e) =>
      MediaSendEvent._(MediaSendEventKind.queued, e);
  factory MediaSendEvent.progress(MessageEnvelope e, double progress) =>
      MediaSendEvent._(MediaSendEventKind.progress, e, progress: progress);
  factory MediaSendEvent.sent(MessageEnvelope e) =>
      MediaSendEvent._(MediaSendEventKind.sent, e);
  factory MediaSendEvent.failed(MessageEnvelope e, String? error) =>
      MediaSendEvent._(MediaSendEventKind.failed, e, error: error);

  final MediaSendEventKind kind;
  final MessageEnvelope envelope;
  final double progress;
  final String? error;
}
