import 'package:hive_ce/hive.dart';

import '../core/bootstrap/local_storage_bootstrap.dart';
import '../core/config/feedin_config.dart';
import '../core/security/secure_session_store.dart';
import '../core/storage/local_storage_maintenance.dart';
import '../core/storage/media_cache_service.dart';
import '../core/sync/sync_service.dart';
import '../data/local/local_feed_repository.dart';
import '../data/local/local_feed_repository_contract.dart';
import '../data/local/local_messages_repository.dart';
import '../data/local/local_messages_repository_contract.dart';
import '../data/local/pending_action_repository.dart';
import '../data/local/profile_repository.dart';
import '../data/local/profile_repository_contract.dart';
import '../data/remote/feed_remote_data_source.dart';
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
    required this.syncService,
    required this.storageMaintenance,
  });

  final FeedinConfig config;
  final AuthRepositoryContract authRepository;
  final ProfileRepositoryContract profileRepository;
  final LocalFeedRepositoryContract feedRepository;
  final LocalMessagesRepositoryContract messagesRepository;
  final SyncServiceContract syncService;
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

    final pendingActionRepository = PendingActionRepository(
      box: pendingActionsBox,
    );
    final messagesRepository = LocalMessagesRepository(
      conversationsBox: conversationsBox,
      messagesBox: messagesBox,
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
        pendingActionRepository: pendingActionRepository,
      ),
      messagesRepository: messagesRepository,
      syncService: SyncService(
        isConfigured: config.hasSupabaseConfig,
        pendingActionRepository: pendingActionRepository,
        messagesRepository: messagesRepository,
      ),
      storageMaintenance: LocalStorageMaintenance(
        profileBox: profileBox,
        feedBox: feedBox,
        pendingActionsBox: pendingActionsBox,
        conversationsBox: conversationsBox,
        messagesBox: messagesBox,
        mediaCacheService: const MediaCacheService(),
      ),
    );
  }
}
