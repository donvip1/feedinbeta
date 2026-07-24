/// Lifecycle of one attachment upload, persisted from enqueue until verified or
/// cancelled so it survives process death and resumes instead of restarting.
enum UploadState {
  /// Waiting for a runner (fresh, or rescheduled after a transient failure).
  queued,

  /// Bytes actively moving.
  uploading,

  /// Paused by the user; resumable from the persisted offset.
  paused,

  /// All bytes stored remotely AND integrity verified. Terminal success —
  /// only now may a message referencing this media be created.
  verified,

  /// Terminal failure after retries exhausted or a permanent error
  /// (e.g. integrity mismatch). Surfaced for manual retry/discard.
  dead,

  /// Cancelled by the user. Terminal.
  cancelled;

  bool get isTerminal => this == verified || this == dead || this == cancelled;
  bool get canRun => this == queued || this == paused;
}

/// One persisted upload row (see `comm_uploads`).
class UploadTask {
  const UploadTask({
    required this.id,
    required this.messageId,
    required this.localPath,
    required this.state,
    this.remotePath,
    this.mimeType,
    this.totalBytes = 0,
    this.sentBytes = 0,
    this.sha256,
    this.attempts = 0,
    this.nextAttemptAt = 0,
    this.lastError,
    this.createdAt = 0,
  });

  final String id;

  /// The (not-yet-sent) message this attachment belongs to.
  final String messageId;
  final String localPath;
  final String? remotePath;
  final String? mimeType;
  final int totalBytes;

  /// Confirmed-stored byte offset — the resume point.
  final int sentBytes;
  final String? sha256;
  final UploadState state;
  final int attempts;
  final int nextAttemptAt;
  final String? lastError;
  final int createdAt;

  double get progress =>
      totalBytes <= 0 ? 0 : (sentBytes / totalBytes).clamp(0.0, 1.0);

  UploadTask copyWith({
    String? remotePath,
    int? totalBytes,
    int? sentBytes,
    String? sha256,
    UploadState? state,
    int? attempts,
    int? nextAttemptAt,
    String? lastError,
  }) {
    return UploadTask(
      id: id,
      messageId: messageId,
      localPath: localPath,
      remotePath: remotePath ?? this.remotePath,
      mimeType: mimeType,
      totalBytes: totalBytes ?? this.totalBytes,
      sentBytes: sentBytes ?? this.sentBytes,
      sha256: sha256 ?? this.sha256,
      state: state ?? this.state,
      attempts: attempts ?? this.attempts,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      lastError: lastError ?? this.lastError,
      createdAt: createdAt,
    );
  }
}
