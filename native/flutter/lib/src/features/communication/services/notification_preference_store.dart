import 'package:sqflite/sqflite.dart';

import '../data/communication_database.dart';
import '../domain/notification_payload.dart';

/// Per-category notification preferences + per-conversation mutes, persisted
/// locally (mirrored server-side later for cross-device consistency).
class NotificationPreferenceStore {
  NotificationPreferenceStore(this._database);

  final CommunicationDatabase _database;
  Database get _db => _database.db;

  /// Whether [category] is enabled (default: enabled).
  Future<bool> isEnabled(NotificationCategory category) async {
    final rows = await _db.query(
      'comm_notification_prefs',
      columns: ['enabled'],
      where: 'category = ?',
      whereArgs: [category.name],
      limit: 1,
    );
    if (rows.isEmpty) return true;
    return (rows.first['enabled'] as num) == 1;
  }

  Future<void> setEnabled(NotificationCategory category, bool enabled) =>
      _db.insert('comm_notification_prefs', {
        'category': category.name,
        'enabled': enabled ? 1 : 0,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

  /// Mute [conversationId]; null [until] = forever.
  Future<void> mute(String conversationId, {DateTime? until}) =>
      _db.insert('comm_conversation_mutes', {
        'conversation_id': conversationId,
        'muted_until': until?.millisecondsSinceEpoch ?? 0,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> unmute(String conversationId) => _db.delete(
    'comm_conversation_mutes',
    where: 'conversation_id = ?',
    whereArgs: [conversationId],
  );

  /// Whether [conversationId] is muted at [nowMillis]. Expired timed mutes are
  /// cleaned up lazily.
  Future<bool> isMuted(String conversationId, {required int nowMillis}) async {
    final rows = await _db.query(
      'comm_conversation_mutes',
      columns: ['muted_until'],
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
      limit: 1,
    );
    if (rows.isEmpty) return false;
    final until = (rows.first['muted_until'] as num).toInt();
    if (until == 0) return true; // forever
    if (nowMillis < until) return true;
    await unmute(conversationId); // expired — clean up
    return false;
  }
}
