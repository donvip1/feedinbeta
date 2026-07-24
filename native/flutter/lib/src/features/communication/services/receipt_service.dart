import 'dart:async';

import 'package:sqflite/sqflite.dart';

import '../data/communication_database.dart';
import '../domain/receipt.dart';
import '../domain/result.dart';

/// Pushes locally-recorded receipts to the server. Provider-agnostic; the
/// Supabase adapter implements it over the receipts RPC/table, tests use a fake.
abstract interface class ReceiptTransport {
  /// Publish a batch of the viewer's receipts. Must be idempotent — receipts
  /// use earliest-timestamp merge semantics everywhere.
  Future<Result<void>> publish(List<Receipt> receipts);
}

/// Per-message delivery/read receipts, done properly (the legacy stack faked
/// "delivered" and inferred reads per-conversation).
///
///  * **Recording is local-first**: [markDelivered]/[markRead] persist
///    immediately with `pending_sync` and are flushed to the server in batches
///    with retry — the same never-lost discipline as messages.
///  * **Merging is idempotent + monotonic**: earliest timestamp wins on both
///    sides (a receipt can never regress from read back to delivered).
///  * **Summaries answer the UI's tick question** per message: delivered to
///    any / read by any / read by all.
class ReceiptService {
  ReceiptService({
    required CommunicationDatabase database,
    required ReceiptTransport transport,
    int Function()? nowMillis,
  }) : _database = database,
       _transport = transport,
       _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch);

  final CommunicationDatabase _database;
  final ReceiptTransport _transport;
  final int Function() _now;

  Database get _db => _database.db;
  static const _table = 'comm_receipts';

  final _updates = StreamController<Receipt>.broadcast();

  /// Receipt changes (local marks and remote applies) — drives tick rebuilds.
  Stream<Receipt> get updates => _updates.stream;

  Future<void>? _flushInFlight;

  // -- Recording (viewer side) -------------------------------------------------

  /// Record that [userId] (the local viewer) received [messageId].
  Future<void> markDelivered({
    required String messageId,
    required String conversationId,
    required String userId,
  }) => _mark(
    messageId: messageId,
    conversationId: conversationId,
    userId: userId,
    delivered: true,
  );

  /// Record that [userId] read [messageId] (implies delivered).
  Future<void> markRead({
    required String messageId,
    required String conversationId,
    required String userId,
  }) => _mark(
    messageId: messageId,
    conversationId: conversationId,
    userId: userId,
    delivered: true,
    read: true,
  );

  /// Mark every message in [messageIds] read in one transaction (opening a
  /// thread marks the visible page at once).
  Future<void> markManyRead({
    required List<String> messageIds,
    required String conversationId,
    required String userId,
  }) async {
    await _db.transaction((txn) async {
      for (final id in messageIds) {
        await _upsertMerged(
          txn,
          Receipt(
            messageId: id,
            userId: userId,
            deliveredAtMillis: _now(),
            readAtMillis: _now(),
          ),
          conversationId: conversationId,
          pendingSync: true,
        );
      }
    });
    for (final id in messageIds) {
      _emit(await _get(id, userId));
    }
  }

  Future<void> _mark({
    required String messageId,
    required String conversationId,
    required String userId,
    bool delivered = false,
    bool read = false,
  }) async {
    final now = _now();
    await _db.transaction(
      (txn) => _upsertMerged(
        txn,
        Receipt(
          messageId: messageId,
          userId: userId,
          deliveredAtMillis: delivered ? now : null,
          readAtMillis: read ? now : null,
        ),
        conversationId: conversationId,
        pendingSync: true,
      ),
    );
    _emit(await _get(messageId, userId));
  }

  // -- Remote application (peer receipts arriving via realtime/reconcile) -------

  /// Merge a receipt observed from the server (a peer's delivered/read mark).
  Future<void> applyRemote(Receipt receipt, {required String conversationId}) async {
    await _db.transaction(
      (txn) => _upsertMerged(
        txn,
        receipt,
        conversationId: conversationId,
        pendingSync: false,
      ),
    );
    _emit(await _get(receipt.messageId, receipt.userId));
  }

  // -- Sync ---------------------------------------------------------------------

  /// Push pending local receipts to the server in one batch. Coalesces
  /// concurrent calls; on failure the rows stay pending for the next flush
  /// (receipts are idempotent, so redelivery is safe).
  Future<void> flush() {
    final inFlight = _flushInFlight;
    if (inFlight != null) return inFlight;
    final run = _flushPass();
    _flushInFlight = run;
    run.whenComplete(() {
      if (identical(_flushInFlight, run)) _flushInFlight = null;
    });
    return run;
  }

  Future<void> _flushPass() async {
    final rows = await _db.query(
      _table,
      where: 'pending_sync = 1',
      limit: 200,
    );
    if (rows.isEmpty) return;
    final receipts = rows.map(_fromRow).toList();
    final result = await _transport.publish(receipts);
    if (result.isErr) return; // stay pending; next flush retries
    final batch = _db.batch();
    for (final row in rows) {
      batch.update(
        _table,
        {'pending_sync': 0},
        where: 'message_id = ? AND user_id = ?',
        whereArgs: [row['message_id'], row['user_id']],
      );
    }
    await batch.commit(noResult: true);
  }

  Future<int> pendingCount() async {
    final rows = await _db.rawQuery(
      'SELECT COUNT(*) AS c FROM $_table WHERE pending_sync = 1',
    );
    return (rows.first['c'] as num).toInt();
  }

  // -- Reads for the UI -----------------------------------------------------------

  /// Everyone's receipts for one message (excluding [excludeUserId], normally
  /// the sender) plus the recipient count → tick state.
  Future<ReceiptSummary> summaryFor(
    String messageId, {
    required int recipientCount,
    String? excludeUserId,
  }) async {
    final rows = await _db.query(
      _table,
      where: 'message_id = ?',
      whereArgs: [messageId],
    );
    final receipts = rows
        .map(_fromRow)
        .where((r) => r.userId != excludeUserId)
        .toList();
    return ReceiptSummary(receipts, recipientCount: recipientCount);
  }

  Future<Receipt?> receiptFor(String messageId, String userId) =>
      _get(messageId, userId);

  // -- Internals -------------------------------------------------------------------

  /// Earliest-timestamp merge inside a transaction so concurrent marks and
  /// remote applies converge; pending_sync is sticky-true until flushed.
  Future<void> _upsertMerged(
    DatabaseExecutor txn,
    Receipt incoming, {
    required String conversationId,
    required bool pendingSync,
  }) async {
    final existingRows = await txn.query(
      _table,
      where: 'message_id = ? AND user_id = ?',
      whereArgs: [incoming.messageId, incoming.userId],
      limit: 1,
    );
    var merged = incoming;
    var pending = pendingSync;
    if (existingRows.isNotEmpty) {
      final existing = _fromRow(existingRows.first);
      merged = existing.mergedWith(incoming);
      pending = pendingSync || (existingRows.first['pending_sync'] as num) == 1;
    }
    await txn.insert(_table, {
      'message_id': merged.messageId,
      'user_id': merged.userId,
      'conversation_id': conversationId,
      'delivered_at': merged.deliveredAtMillis,
      'read_at': merged.readAtMillis,
      'pending_sync': pending ? 1 : 0,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<Receipt?> _get(String messageId, String userId) async {
    final rows = await _db.query(
      _table,
      where: 'message_id = ? AND user_id = ?',
      whereArgs: [messageId, userId],
      limit: 1,
    );
    return rows.isEmpty ? null : _fromRow(rows.first);
  }

  void _emit(Receipt? receipt) {
    if (receipt != null && !_updates.isClosed) _updates.add(receipt);
  }

  Receipt _fromRow(Map<String, Object?> row) => Receipt(
    messageId: row['message_id']! as String,
    userId: row['user_id']! as String,
    deliveredAtMillis: (row['delivered_at'] as num?)?.toInt(),
    readAtMillis: (row['read_at'] as num?)?.toInt(),
  );

  Future<void> dispose() async {
    final inFlight = _flushInFlight;
    if (inFlight != null) {
      try {
        await inFlight;
      } catch (_) {}
    }
    await _updates.close();
  }
}
