import 'package:sqflite/sqflite.dart';

/// Owns the Communication Platform's SQLite database: schema, indexes, and
/// versioned migrations. Replaces the old Hive boxes whose every read was a
/// full-box scan — here conversation pages, outbox drains, and cursor reads are
/// all index-backed.
///
/// The [DatabaseFactory] is injected so tests run on `sqflite_common_ffi`
/// (host machine, no emulator) and the app runs on the platform factory —
/// same schema, same code.
class CommunicationDatabase {
  CommunicationDatabase._(this.db);

  final Database db;

  static const int schemaVersion = 1;

  static Future<CommunicationDatabase> open(
    DatabaseFactory factory,
    String path,
  ) async {
    final db = await factory.openDatabase(
      path,
      options: OpenDatabaseOptions(
        version: schemaVersion,
        onConfigure: (db) => db.execute('PRAGMA foreign_keys = ON'),
        onCreate: _createSchema,
      ),
    );
    return CommunicationDatabase._(db);
  }

  static Future<void> _createSchema(Database db, int version) async {
    // One row per canonical message. The full envelope is stored as JSON (the
    // domain model is the source of truth for shape); the extracted columns
    // exist purely to index/sort/filter without decoding JSON.
    await db.execute('''
      CREATE TABLE comm_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sent_millis INTEGER NOT NULL,
        sent_counter INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        delivery_state TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        envelope TEXT NOT NULL
      )
    ''');
    // The pagination index: newest-first keyset pages per conversation.
    await db.execute('''
      CREATE INDEX idx_comm_messages_page
        ON comm_messages (conversation_id, sent_millis DESC, sent_counter DESC, id DESC)
    ''');
    await db.execute('''
      CREATE INDEX idx_comm_messages_state ON comm_messages (delivery_state)
    ''');

    // Durable outbox: one row per not-yet-acknowledged outgoing message.
    await db.execute('''
      CREATE TABLE comm_outbox (
        message_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        enqueued_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL,
        last_error TEXT,
        is_dead INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE INDEX idx_comm_outbox_due ON comm_outbox (is_dead, next_attempt_at)
    ''');

    // Sync cursors: one per scope (e.g. "messages", "receipts").
    await db.execute('''
      CREATE TABLE comm_cursors (
        scope TEXT PRIMARY KEY,
        cursor TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ''');
  }

  Future<void> close() => db.close();
}
