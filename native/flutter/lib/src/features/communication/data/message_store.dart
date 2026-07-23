import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../domain/delivery_state.dart';
import '../domain/message_envelope.dart';
import 'communication_database.dart';

/// A newest-first page of messages plus the keyset needed to fetch the next
/// (older) page without OFFSET scans.
class MessagePage {
  const MessagePage({required this.messages, required this.hasMore});

  /// Newest → oldest.
  final List<MessageEnvelope> messages;
  final bool hasMore;
}

/// The single local message store, backed by indexed SQLite.
///
/// Replaces both Hive stores' full-box-scan reads: conversation pages are
/// keyset-paginated off `idx_comm_messages_page`, and writes are idempotent
/// upserts that resolve conflicts with [MessageEnvelope.mergedWith] (revision →
/// HLC → furthest delivery state), so a realtime event, a reconcile pull, and a
/// local echo of the same message always converge to one row.
class MessageStore {
  MessageStore(this._database);

  final CommunicationDatabase _database;
  Database get _db => _database.db;

  static const _table = 'comm_messages';

  /// Idempotently insert-or-merge [envelope]. Returns the stored (possibly
  /// merged) envelope.
  Future<MessageEnvelope> upsert(MessageEnvelope envelope) async {
    return _db.transaction((txn) async {
      final existingRows = await txn.query(
        _table,
        columns: ['envelope'],
        where: 'id = ?',
        whereArgs: [envelope.id],
        limit: 1,
      );
      var toStore = envelope;
      if (existingRows.isNotEmpty) {
        final existing = MessageEnvelope.fromJson(
          (jsonDecode(existingRows.first['envelope']! as String) as Map)
              .cast<String, Object?>(),
        );
        toStore = existing.mergedWith(envelope);
      }
      await txn.insert(
        _table,
        _toRow(toStore),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      return toStore;
    });
  }

  Future<MessageEnvelope?> getById(String id) async {
    final rows = await _db.query(
      _table,
      columns: ['envelope'],
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _decode(rows.first);
  }

  /// Newest-first keyset pagination. Pass the last (oldest) message of the
  /// previous page as [before] to get the next page; null loads the newest.
  Future<MessagePage> pageForConversation(
    String conversationId, {
    int limit = 50,
    MessageEnvelope? before,
  }) async {
    final args = <Object?>[conversationId];
    var where = 'conversation_id = ?';
    if (before != null) {
      // Strict keyset predicate over (sent_millis, sent_counter, id).
      where +=
          ' AND (sent_millis < ?'
          ' OR (sent_millis = ? AND sent_counter < ?)'
          ' OR (sent_millis = ? AND sent_counter = ? AND id < ?))';
      args.addAll([
        before.sentAt.millis,
        before.sentAt.millis,
        before.sentAt.counter,
        before.sentAt.millis,
        before.sentAt.counter,
        before.id,
      ]);
    }
    // Fetch one extra row to compute hasMore without a COUNT.
    final rows = await _db.query(
      _table,
      columns: ['envelope'],
      where: where,
      whereArgs: args,
      orderBy: 'sent_millis DESC, sent_counter DESC, id DESC',
      limit: limit + 1,
    );
    final hasMore = rows.length > limit;
    final page = rows.take(limit).map(_decode).toList();
    return MessagePage(messages: page, hasMore: hasMore);
  }

  /// Update just the delivery state of a message (fast path used by the outbox
  /// and receipt application). No-op if the message is unknown.
  Future<void> setDeliveryState(String id, DeliveryState state) async {
    final existing = await getById(id);
    if (existing == null) return;
    await upsert(existing.copyWith(deliveryState: state));
  }

  Future<int> countForConversation(String conversationId) async {
    final result = await _db.rawQuery(
      'SELECT COUNT(*) AS c FROM $_table WHERE conversation_id = ?',
      [conversationId],
    );
    return (result.first['c'] as num).toInt();
  }

  Future<void> delete(String id) =>
      _db.delete(_table, where: 'id = ?', whereArgs: [id]);

  Map<String, Object?> _toRow(MessageEnvelope e) => {
    'id': e.id,
    'conversation_id': e.conversationId,
    'sender_id': e.senderId,
    'sent_millis': e.sentAt.millis,
    'sent_counter': e.sentAt.counter,
    'revision': e.revision,
    'delivery_state': e.deliveryState.name,
    'deleted': e.isDeleted ? 1 : 0,
    'envelope': jsonEncode(e.toJson()),
  };

  MessageEnvelope _decode(Map<String, Object?> row) => MessageEnvelope.fromJson(
    (jsonDecode(row['envelope']! as String) as Map).cast<String, Object?>(),
  );
}
