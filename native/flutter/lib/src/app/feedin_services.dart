import 'package:hive_ce/hive.dart';

import '../core/bootstrap/local_storage_bootstrap.dart';
import '../core/config/feedin_config.dart';
import '../core/security/secure_session_store.dart';
import '../core/realtime/feedin_realtime_service.dart';
import '../core/storage/local_storage_maintenance.dart';
import '../core/storage/media_cache_service.dart';
import '../core/storage/storage_diagnostics_service.dart';
import '../core/sync/conversation_starter.dart';
import '../core/sync/foreground_sync_coordinator.dart';
import '../core/sync/message_materializer.dart';
import '../core/sync/sync_service.dart';
import '../core/sync/upload_queue_service.dart';
import '../data/local/local_feed_repository.dart';
import '../data/local/local_feed_repository_contract.dart';
import '../data/local/local_messages_repository.dart';
import '../data/local/local_messages_repository_contract.dart';
import '../data/local/notification_repository.dart';
import '../data/local/notification_repository_contract.dart';
import '../data/local/pending_action_repository.dart';
import '../data/local/preferences_repository.dart';
import '../data/local/preferences_repository_contract.dart';
import '../data/local/post_draft_repository.dart';
import '../data/local/profile_repository.dart';
import '../data/local/profile_repository_contract.dart';
import '../data/local/upload_queue_repository.dart';
import '../data/remote/feed_remote_data_source.dart';
import '../data/remote/message_recipient_remote_data_source.dart';
import '../data/remote/messages_remote_data_source.dart';
import '../data/remote/notifications_remote_data_source.dart';
import '../data/remote/profile_remote_data_source.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/data/auth_repository_contract.dart';

class FeedinServices {
  FeedinServices({
    required this.config,
    required this.authRepository,
    required this.profileRepository,
    required this.feedRepository,
    required this.messagesRepository,
    required this.notificationRepository,
    required this.preferencesRepository,
    required this.conversationStarter,
    required this.postDraftRepository,
    required this.uploadQueueRepository,
    required this.syncService,
    required this.uploadQueueService,
    required this.foregroundSyncCoordinator,
    required this.storageDiagnosticsService,
    required this.realtimeService,
    required this.storageMaintenance,
  });

  final FeedinConfig config;
  final AuthRepositoryContract authRepository;
  final ProfileRepositoryContract profileRepository;
  final LocalFeedRepositoryContract feedRepository;
  final LocalMessagesRepositoryContract messagesRepository;
  final NotificationRepositoryContract notificationRepository;
  final PreferencesRepositoryContract preferencesRepository;
  final ConversationStarter conversationStarter;
  final PostDraftRepository postDraftRepository;
  final UploadQueueRepository uploadQueueRepository;
  final SyncServiceContract syncService;
  final UploadQueueService uploadQueueService;
  final ForegroundSyncCoordinator foregroundSyncCoordinator;
  final StorageDiagnosticsService storageDiagnosticsService;
  final FeedinRealtimeService realtimeService;
  final LocalStorageMaintenance storageMaintenance;

  factory FeedinServices.create(FeedinConfig config) {
    final profileBox = Hive.box<Map>(LocalStorageBootstrap.profileBoxName);
    final feedBox = Hive.box<Map>(LocalStorageBootstrap.feedBoxName);
    final pendingActionsBox = Hive.box<Map>(
      LocalStorageBootstrap.pendingActionsBoxName,
    );
    final conversationsBox = Hive.box<Map>(
      LocalStorageBootstrap.conversationsBoxName,
    );
    final messagesBox = Hive.box<Map>(LocalStorageBootstrap.messagesBoxName);
    final postDraftsBox = Hive.box<Map>(
      LocalStorageBootstrap.postDraftsBoxName,
    );
    final uploadQueueBox = Hive.box<Map>(
      LocalStorageBootstrap.uploadQueueBoxName,
    );
    final notificationsBox = Hive.box<Map>(
      LocalStorageBootstrap.notificationsBoxName,
    );
    final preferencesBox = Hive.box<Map>(
      LocalStorageBootstrap.preferencesBoxName,
    );

    final pendingActionRepository = PendingActionRepository(
      box: pendingActionsBox,
    );
    const mediaCacheService = MediaCacheService();
    final messagesRepository = LocalMessagesRepository(
      conversationsBox: conversationsBox,
      messagesBox: messagesBox,
      seedDemoContent: !config.hasSupabaseConfig,
    );
    final notificationRepository = NotificationRepository(
      box: notificationsBox,
      remoteDataSource: NotificationsRemoteDataSource(
        isConfigured: config.hasSupabaseConfig,
      ),
    );
    final preferencesRepository = PreferencesRepository(box: preferencesBox);
    final postDraftRepository = PostDraftRepository(box: postDraftsBox);
    final uploadQueueRepository = UploadQueueRepository(box: uploadQueueBox);
    final messagesRemoteDataSource = MessagesRemoteDataSource(
      isConfigured: config.hasSupabaseConfig,
    );
    final recipientRemoteDataSource = MessageRecipientRemoteDataSource(
      isConfigured: config.hasSupabaseConfig,
    );
    final messageMaterializer = MessageMaterializer(
      remoteDataSource: messagesRemoteDataSource,
      messagesRepository: messagesRepository,
    );
    final conversationStarter = ConversationStarter(
      recipientRemoteDataSource: recipientRemoteDataSource,
      messagesRepository: messagesRepository,
    );

    final syncService = SyncService(
      isConfigured: config.hasSupabaseConfig,
      pendingActionRepository: pendingActionRepository,
      messagesRepository: messagesRepository,
      messageMaterializer: messageMaterializer,
    );
    final uploadQueueService = UploadQueueService(
      isConfigured: config.hasSupabaseConfig,
      draftRepository: postDraftRepository,
      uploadQueueRepository: uploadQueueRepository,
    );

    return FeedinServices(
      config: config,
      authRepository: AuthRepository(
        config: config,
        sessionStore: const SecureSessionStore(),
      ),
      profileRepository: ProfileRepository(
        box: profileBox,
        remoteDataSource: ProfileRemoteDataSource(
          isConfigured: config.hasSupabaseConfig,
        ),
      ),
      feedRepository: LocalFeedRepository(
        box: feedBox,
        remoteDataSource: FeedRemoteDataSource(
          isConfigured: config.hasSupabaseConfig,
        ),
        mediaCacheService: mediaCacheService,
        pendingActionRepository: pendingActionRepository,
        seedDemoContent: !config.hasSupabaseConfig,
      ),
      messagesRepository: messagesRepository,
      notificationRepository: notificationRepository,
      preferencesRepository: preferencesRepository,
      conversationStarter: conversationStarter,
      postDraftRepository: postDraftRepository,
      uploadQueueRepository: uploadQueueRepository,
      syncService: syncService,
      uploadQueueService: uploadQueueService,
      foregroundSyncCoordinator: ForegroundSyncCoordinator(
        syncService: syncService,
        uploadQueueService: uploadQueueService,
      ),
      storageDiagnosticsService: StorageDiagnosticsService(
        isConfigured: config.hasSupabaseConfig,
      ),
      realtimeService: FeedinRealtimeService(
        isConfigured: config.hasSupabaseConfig,
      ),
      storageMaintenance: LocalStorageMaintenance(
        profileBox: profileBox,
        feedBox: feedBox,
        pendingActionsBox: pendingActionsBox,
        conversationsBox: conversationsBox,
        messagesBox: messagesBox,
        notificationsBox: notificationsBox,
        mediaCacheService: mediaCacheService,
      ),
    );
  }
}
