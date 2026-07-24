import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../domain/conversation.dart';
import 'communication_database.dart';

/// The single local store for conversations of every type — dm, group,
/// community, channel, broadcast, support, ai. Replaces the per-type stacks
/// with one indexed inbox.
class ConversationStore {
  ConversationStore(this._database);

  final CommunicationDatabase _database;
  Database get _db => _database.db;
  static const _table = 'comm_conversations';

  Future<void> upsert(Conversation conversation) => _db.insert(_table, {
    'id': conversation.id,
    'type': conversation.type.name,
    'last_message_at': conversation.lastMessageAt ?? 0,
    'body': jsonEncode(conversation.toJson()),
  }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<Conversation?> getById(String id) async {
    final rows = await _db.query(
      _table,
      columns: ['body'],
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return _decode(rows.first);
  }

  /// The inbox: newest-activity-first, optionally filtered by [types].
  Future<List<Conversation>> inbox({
    List<ConversationType>? types,
    int limit = 100,
  }) async {
    String? where;
    List<Object?>? args;
    if (types != null && types.isNotEmpty) {
      where = 'type IN (${List.filled(types.length, '?').join(',')})';
      args = types.map((t) => t.name).toList();
    }
    final rows = await _db.query(
      _table,
      columns: ['body'],
      where: where,
      whereArgs: args,
      orderBy: 'last_message_at DESC, id DESC',
      limit: limit,
    );
    return rows.map(_decode).toList();
  }

  /// Bump inbox ordering when a message lands (no-op for unknown ids).
  Future<void> touch(String id, int lastMessageAtMillis) async {
    final existing = await getById(id);
    if (existing == null) return;
    if ((existing.lastMessageAt ?? 0) >= lastMessageAtMillis) return;
    await upsert(existing.copyWith(lastMessageAt: lastMessageAtMillis));
  }

  Future<void> delete(String id) =>
      _db.delete(_table, where: 'id = ?', whereArgs: [id]);

  Conversation _decode(Map<String, Object?> row) => Conversation.fromJson(
    (jsonDecode(row['body']! as String) as Map).cast<String, Object?>(),
  );
}
