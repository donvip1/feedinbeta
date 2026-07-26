import 'dart:async';

import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import 'core/encryption/encryption_codec.dart';
import 'data/communication_database.dart';
import 'data/conversation_store.dart';
import 'data/message_store.dart';
import 'data/outbox.dart';
import 'data/sync_cursor_store.dart';
import 'domain/hybrid_clock.dart';
import 'media/buffered_storage_transport.dart';
import 'media/io_or_fake.dart' show defaultByteSource;
import 'media/media_message_coordinator.dart';
import 'media/resumable_storage_transport.dart';
import 'media/upload_byte_source.dart';
import 'media/upload_manager.dart';
import 'media/upload_task_store.dart';
import 'pipeline/delivery_transport.dart';
import 'pipeline/message_pipeline.dart';
import 'services/conversation_service.dart';
import 'transport/supabase_delivery_transport.dart';

/// The composition root of the Communication Platform: constructs and wires
/// every subsystem (store → outbox → pipeline → media → conversations) in one
/// place, owns their lifecycles, and runs boot recovery.
///
/// Dark until wired into the UI: constructing this object changes NOTHING in
/// production behavior — the legacy stacks keep running untouched. The UI swap
/// (a later, separate phase) flips screens onto [conversations] one surface at
/// a time behind a feature flag.
///
/// Every dependency is injectable so the platform composes identically in
/// tests (in-memory factory + fakes) and production (platform SQLite +
/// Supabase adapters).
class CommunicationPlatform {
  CommunicationPlatform._({
    required this.database,
    required this.messages,
    required this.outbox,
    required this.cursors,
    required this.conversationStore,
    required this.pipeline,
    required this.uploads,
    required this.mediaCoordinator,
    required this.conversations,
  });

  final CommunicationDatabase database;
  final MessageStore messages;
  final Outbox outbox;
  final SyncCursorStore cursors;
  final ConversationStore conversationStore;
  final MessagePipeline pipeline;
  final UploadManager uploads;
  final MediaMessageCoordinator mediaCoordinator;
  final ConversationService conversations;

  Timer? _drainTimer;

  /// Build the full platform.
  ///
  /// Production: `CommunicationPlatform.boot(selfUserId: uid,
  /// databaseFactory: databaseFactory, databasePath: 'DIR/comm.db')`.
  /// Tests inject [deliveryTransport]/[storageTransport]/[byteSource] fakes and
  /// an in-memory path.
  static Future<CommunicationPlatform> boot({
    required String selfUserId,
    required DatabaseFactory databaseFactory,
    required String databasePath,
    DeliveryTransport? deliveryTransport,
    ResumableStorageTransport? storageTransport,
    UploadByteSource? byteSource,
    EncryptionCodec codec = const IdentityEncryptionCodec(),
    int Function()? nowMillis,
  }) async {
    final database = await CommunicationDatabase.open(
      databaseFactory,
      databasePath,
    );
    final messages = MessageStore(database);
    final outbox = Outbox(database);
    final cursors = SyncCursorStore(database);
    final conversationStore = ConversationStore(database);
    final uploadStore = UploadTaskStore(database);

    final pipeline = MessagePipeline(
      store: messages,
      outbox: outbox,
      cursors: cursors,
      transport: deliveryTransport ?? SupabaseDeliveryTransport(),
      codec: codec,
      nowMillis: nowMillis,
    );

    final uploads = UploadManager(
      store: uploadStore,
      transport:
          storageTransport ?? BufferedStorageTransport.supabase(),
      bytes: byteSource ?? defaultByteSource(),
      nowMillis: nowMillis,
    );

    final mediaCoordinator = MediaMessageCoordinator(
      pipeline: pipeline,
      uploads: uploads,
      uploadStore: uploadStore,
      remotePathBuilder: (e) =>
          'conversations/${e.conversationId}/${e.id}',
    );

    final conversations = ConversationService(
      conversations: conversationStore,
      pipeline: pipeline,
      media: mediaCoordinator,
      clock: HybridClock(selfUserId, nowMillis: nowMillis),
      newMessageId: () => const Uuid().v4(),
      nowMillis: nowMillis,
    );

    return CommunicationPlatform._(
      database: database,
      messages: messages,
      outbox: outbox,
      cursors: cursors,
      conversationStore: conversationStore,
      pipeline: pipeline,
      uploads: uploads,
      mediaCoordinator: mediaCoordinator,
      conversations: conversations,
    );
  }

  /// Boot recovery + steady-state draining. Call once after [boot]:
  ///  1. re-drain the outbox (messages queued before the last shutdown);
  ///  2. resume interrupted uploads and replay verified-but-unsent handoffs;
  ///  3. reconcile missed history from the persisted cursor;
  ///  4. start the periodic drain heartbeat (connectivity events should also
  ///     call [drainNow] for instant recovery).
  Future<void> start({
    Duration drainInterval = const Duration(seconds: 30),
  }) async {
    await mediaCoordinator.recover((id) => messages.getById(id));
    await uploads.drain();
    await pipeline.drain();
    unawaited(pipeline.reconcile());

    _drainTimer?.cancel();
    _drainTimer = Timer.periodic(drainInterval, (_) {
      unawaited(pipeline.drain());
      unawaited(uploads.drain());
    });
  }

  /// Immediate drain (call on connectivity-restored events).
  Future<void> drainNow() async {
    await pipeline.drain();
    await uploads.drain();
    unawaited(pipeline.reconcile());
  }

  Future<void> dispose() async {
    _drainTimer?.cancel();
    _drainTimer = null;
    await conversations.dispose();
    await mediaCoordinator.dispose();
    await uploads.dispose();
    await pipeline.dispose();
    await database.close();
  }
}
