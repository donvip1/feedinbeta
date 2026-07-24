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

  static const int schemaVersion = 5;

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
        onUpgrade: _upgradeSchema,
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

    await _createUploadsTable(db);
    await _createConversationsTable(db);
    await _createReceiptsTable(db);
    await _createNotificationTables(db);
  }

  /// v1 -> v2: the Media Engine's persisted upload state.
  /// v2 -> v3: the unified conversation store.
  /// v3 -> v4: per-message receipts.
  /// v4 -> v5: notification preferences + mutes.
  static Future<void> _upgradeSchema(
    Database db,
    int oldVersion,
    int newVersion,
  ) async {
    if (oldVersion < 2) {
      await _createUploadsTable(db);
    }
    if (oldVersion < 3) {
      await _createConversationsTable(db);
    }
    if (oldVersion < 4) {
      await _createReceiptsTable(db);
    }
    if (oldVersion < 5) {
      await _createNotificationTables(db);
    }
  }

  /// Per-category notification preferences and per-conversation mutes
  /// (mute-until 0 = muted forever, else epoch-millis expiry).
  static Future<void> _createNotificationTables(DatabaseExecutor db) async {
    await db.execute('''
      CREATE TABLE comm_notification_prefs (
        category TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1
      )
    ''');
    await db.execute('''
      CREATE TABLE comm_conversation_mutes (
        conversation_id TEXT PRIMARY KEY,
        muted_until INTEGER NOT NULL DEFAULT 0
      )
    ''');
  }

  /// Per-(message, user) delivery/read receipts — the primitive the legacy
  /// stack faked. `pending_sync` marks locally-recorded receipts (our own
  /// delivered/read marks) that still need to reach the server; timestamps are
  /// monotonic-earliest so merges are idempotent.
  static Future<void> _createReceiptsTable(DatabaseExecutor db) async {
    await db.execute('''
      CREATE TABLE comm_receipts (
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        delivered_at INTEGER,
        read_at INTEGER,
        pending_sync INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (message_id, user_id)
      )
    ''');
    await db.execute('''
      CREATE INDEX idx_comm_receipts_pending ON comm_receipts (pending_sync)
    ''');
    await db.execute('''
      CREATE INDEX idx_comm_receipts_conversation
        ON comm_receipts (conversation_id, user_id)
    ''');
  }

  /// One row per conversation of EVERY type (dm/group/community/channel/
  /// broadcast/support/ai) — the single inbox source replacing the per-type
  /// stacks. The full domain object is stored as JSON; extracted columns exist
  /// only to index the inbox ordering and type filters.
  static Future<void> _createConversationsTable(DatabaseExecutor db) async {
    await db.execute('''
      CREATE TABLE comm_conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        last_message_at INTEGER NOT NULL DEFAULT 0,
        body TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE INDEX idx_comm_conversations_inbox
        ON comm_conversations (last_message_at DESC, id DESC)
    ''');
    await db.execute('''
      CREATE INDEX idx_comm_conversations_type ON comm_conversations (type)
    ''');
  }

  /// Resumable upload tasks: one row per attachment from enqueue until
  /// verified/cancelled, carrying the byte offset so an upload survives process
  /// death and resumes instead of restarting.
  static Future<void> _createUploadsTable(DatabaseExecutor db) async {
    await db.execute('''
      CREATE TABLE comm_uploads (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        local_path TEXT NOT NULL,
        remote_path TEXT,
        mime_type TEXT,
        total_bytes INTEGER NOT NULL DEFAULT 0,
        sent_bytes INTEGER NOT NULL DEFAULT 0,
        sha256 TEXT,
        state TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL
      )
    ''');
    await db.execute('''
      CREATE INDEX idx_comm_uploads_due ON comm_uploads (state, next_attempt_at)
    ''');
  }

  Future<void> close() => db.close();
}
