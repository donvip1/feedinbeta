import 'package:sqflite/sqflite.dart';

import 'communication_database.dart';

/// Durable per-scope sync cursors (e.g. `messages`, `receipts`).
///
/// A cursor is an opaque string (for messages: the `(updated_at, id)` keyset)
/// persisted after every successful reconcile page, so a device — or a freshly
/// signed-in second device — can always resume exactly where it left off even
/// when realtime events were missed. This is the multi-device catch-up
/// primitive.
class SyncCursorStore {
  SyncCursorStore(this._database);

  final CommunicationDatabase _database;
  Database get _db => _database.db;
  static const _table = 'comm_cursors';

  Future<String?> read(String scope) async {
    final rows = await _db.query(
      _table,
      columns: ['cursor'],
      where: 'scope = ?',
      whereArgs: [scope],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['cursor'] as String?;
  }

  Future<void> write(String scope, String cursor, {required int nowMillis}) =>
      _db.insert(_table, {
        'scope': scope,
        'cursor': cursor,
        'updated_at': nowMillis,
      }, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> clear(String scope) =>
      _db.delete(_table, where: 'scope = ?', whereArgs: [scope]);
}
