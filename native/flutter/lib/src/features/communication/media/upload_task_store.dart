import 'package:sqflite/sqflite.dart';

import '../data/communication_database.dart';
import 'upload_task.dart';

/// Persistence for [UploadTask] rows (`comm_uploads`). Pure storage — the
/// UploadManager owns all policy.
class UploadTaskStore {
  UploadTaskStore(this._database);

  final CommunicationDatabase _database;
  Database get _db => _database.db;
  static const _table = 'comm_uploads';

  Future<void> upsert(UploadTask task) => _db.insert(_table, {
    'id': task.id,
    'message_id': task.messageId,
    'local_path': task.localPath,
    'remote_path': task.remotePath,
    'mime_type': task.mimeType,
    'total_bytes': task.totalBytes,
    'sent_bytes': task.sentBytes,
    'sha256': task.sha256,
    'state': task.state.name,
    'attempts': task.attempts,
    'next_attempt_at': task.nextAttemptAt,
    'last_error': task.lastError,
    'created_at': task.createdAt,
  }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<UploadTask?> getById(String id) async {
    final rows = await _db.query(
      _table,
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _fromRow(rows.first);
  }

  /// Runnable tasks (queued and due, oldest first).
  Future<List<UploadTask>> claimDue({
    required int nowMillis,
    int limit = 3,
  }) async {
    final rows = await _db.query(
      _table,
      where: 'state = ? AND next_attempt_at <= ?',
      whereArgs: [UploadState.queued.name, nowMillis],
      orderBy: 'created_at ASC',
      limit: limit,
    );
    return rows.map(_fromRow).toList();
  }

  /// Non-terminal tasks to restore after a process restart.
  Future<List<UploadTask>> openTasks() async {
    final rows = await _db.query(
      _table,
      where: 'state IN (?, ?, ?)',
      whereArgs: [
        UploadState.queued.name,
        UploadState.uploading.name,
        UploadState.paused.name,
      ],
    );
    return rows.map(_fromRow).toList();
  }

  Future<void> delete(String id) =>
      _db.delete(_table, where: 'id = ?', whereArgs: [id]);

  UploadTask _fromRow(Map<String, Object?> row) => UploadTask(
    id: row['id']! as String,
    messageId: row['message_id']! as String,
    localPath: row['local_path']! as String,
    remotePath: row['remote_path'] as String?,
    mimeType: row['mime_type'] as String?,
    totalBytes: (row['total_bytes'] as num).toInt(),
    sentBytes: (row['sent_bytes'] as num).toInt(),
    sha256: row['sha256'] as String?,
    state: UploadState.values.firstWhere(
      (s) => s.name == row['state'],
      orElse: () => UploadState.dead,
    ),
    attempts: (row['attempts'] as num).toInt(),
    nextAttemptAt: (row['next_attempt_at'] as num).toInt(),
    lastError: row['last_error'] as String?,
    createdAt: (row['created_at'] as num).toInt(),
  );
}
