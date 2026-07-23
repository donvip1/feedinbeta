import 'dart:math';

import 'package:sqflite/sqflite.dart';

import '../domain/result.dart';
import 'communication_database.dart';

/// One due-or-dead outbox entry.
class OutboxEntry {
  const OutboxEntry({
    required this.messageId,
    required this.conversationId,
    required this.enqueuedAt,
    required this.attempts,
    required this.nextAttemptAt,
    required this.isDead,
    this.lastError,
  });

  final String messageId;
  final String conversationId;
  final int enqueuedAt;
  final int attempts;
  final int nextAttemptAt;
  final bool isDead;
  final String? lastError;
}

/// The durable outgoing queue. Every send lives here from enqueue until the
/// server acknowledges — surviving restarts, offline periods, and crashes.
///
/// Guarantees (fixing the legacy stack's poison-message loop):
///  * **Capped exponential backoff with jitter** — retries at ~2^n seconds,
///    capped at [maxBackoff], never a hot loop.
///  * **Permanent-vs-transient classification** — a [CommError] with
///    `isTransient: false` (validation/permission/unauthorized) dead-letters
///    immediately instead of retrying a request that can never succeed.
///  * **Attempt ceiling** — after [maxAttempts] transient failures the entry is
///    dead-lettered, surfaced to the UI for manual retry/delete. Nothing retries
///    forever; nothing is silently dropped.
class Outbox {
  Outbox(
    this._database, {
    this.maxAttempts = 8,
    this.baseBackoff = const Duration(seconds: 2),
    this.maxBackoff = const Duration(minutes: 15),
    Random? random,
  }) : _random = random ?? Random();

  final CommunicationDatabase _database;
  final int maxAttempts;
  final Duration baseBackoff;
  final Duration maxBackoff;
  final Random _random;

  Database get _db => _database.db;
  static const _table = 'comm_outbox';

  /// Enqueue a message for delivery (idempotent on message id).
  Future<void> enqueue({
    required String messageId,
    required String conversationId,
    required int nowMillis,
  }) async {
    await _db.insert(_table, {
      'message_id': messageId,
      'conversation_id': conversationId,
      'enqueued_at': nowMillis,
      'attempts': 0,
      'next_attempt_at': nowMillis,
      'is_dead': 0,
    }, conflictAlgorithm: ConflictAlgorithm.ignore);
  }

  /// Entries due for a delivery attempt at [nowMillis], oldest first.
  Future<List<OutboxEntry>> claimDue({
    required int nowMillis,
    int limit = 20,
  }) async {
    final rows = await _db.query(
      _table,
      where: 'is_dead = 0 AND next_attempt_at <= ?',
      whereArgs: [nowMillis],
      orderBy: 'next_attempt_at ASC',
      limit: limit,
    );
    return rows.map(_fromRow).toList();
  }

  /// The server acknowledged the message — remove it from the queue.
  Future<void> markSent(String messageId) =>
      _db.delete(_table, where: 'message_id = ?', whereArgs: [messageId]);

  /// Record a failed attempt. Transient errors reschedule with backoff until
  /// [maxAttempts]; permanent errors dead-letter immediately.
  Future<void> markFailed({
    required String messageId,
    required CommError error,
    required int nowMillis,
  }) async {
    final rows = await _db.query(
      _table,
      where: 'message_id = ?',
      whereArgs: [messageId],
      limit: 1,
    );
    if (rows.isEmpty) return;
    final attempts = (rows.first['attempts'] as num).toInt() + 1;
    final dead = !error.isTransient || attempts >= maxAttempts;
    await _db.update(
      _table,
      {
        'attempts': attempts,
        'last_error': '${error.kind.name}: ${error.message}',
        'is_dead': dead ? 1 : 0,
        'next_attempt_at': dead ? nowMillis : nowMillis + _backoffMillis(attempts),
      },
      where: 'message_id = ?',
      whereArgs: [messageId],
    );
  }

  /// Dead-lettered entries for the "failed messages" UI.
  Future<List<OutboxEntry>> deadLetters() async {
    final rows = await _db.query(_table, where: 'is_dead = 1');
    return rows.map(_fromRow).toList();
  }

  /// User-initiated retry of a dead letter: revive with a fresh attempt window.
  Future<void> retryDeadLetter(String messageId, {required int nowMillis}) =>
      _db.update(
        _table,
        {'is_dead': 0, 'attempts': 0, 'next_attempt_at': nowMillis},
        where: 'message_id = ?',
        whereArgs: [messageId],
      );

  Future<void> remove(String messageId) => markSent(messageId);

  Future<int> pendingCount() async {
    final rows = await _db.rawQuery(
      'SELECT COUNT(*) AS c FROM $_table WHERE is_dead = 0',
    );
    return (rows.first['c'] as num).toInt();
  }

  /// `base * 2^(attempts-1)` capped at [maxBackoff], plus up to 25% jitter so a
  /// fleet of clients doesn't retry in lockstep.
  int _backoffMillis(int attempts) {
    final exp = baseBackoff.inMilliseconds * pow(2, attempts - 1);
    final capped = min(exp.toDouble(), maxBackoff.inMilliseconds.toDouble());
    final jitter = _random.nextDouble() * 0.25 * capped;
    return (capped + jitter).round();
  }

  OutboxEntry _fromRow(Map<String, Object?> row) => OutboxEntry(
    messageId: row['message_id']! as String,
    conversationId: row['conversation_id']! as String,
    enqueuedAt: (row['enqueued_at'] as num).toInt(),
    attempts: (row['attempts'] as num).toInt(),
    nextAttemptAt: (row['next_attempt_at'] as num).toInt(),
    isDead: (row['is_dead'] as num) == 1,
    lastError: row['last_error'] as String?,
  );
}
