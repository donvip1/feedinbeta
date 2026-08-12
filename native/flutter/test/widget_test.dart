import 'dart:io';

import 'package:feedin/src/app/feedin_app.dart';
import 'package:feedin/src/app/feedin_services.dart';
import 'package:feedin/src/core/config/feedin_config.dart';
import 'package:feedin/src/core/connectivity/connectivity_service.dart';
import 'package:feedin/src/core/notifications/callkit_service.dart';
import 'package:feedin/src/core/notifications/local_notifications_service.dart';
import 'package:feedin/src/core/notifications/push_notification_service.dart';
import 'package:feedin/src/core/realtime/feedin_realtime_service.dart';
import 'package:feedin/src/core/storage/local_storage_maintenance.dart';
import 'package:feedin/src/core/storage/storage_diagnostics_service.dart';
import 'package:feedin/src/core/sync/conversation_starter.dart';
import 'package:feedin/src/core/sync/foreground_sync_coordinator.dart';
import 'package:feedin/src/core/sync/sync_service.dart';
import 'package:feedin/src/core/sync/upload_queue_service.dart';
import 'package:feedin/src/data/local/local_feed_repository_contract.dart';
import 'package:feedin/src/data/local/local_messages_repository_contract.dart';
import 'package:feedin/src/data/local/notification_repository_contract.dart';
import 'package:feedin/src/data/local/preferences_repository_contract.dart';
import 'package:feedin/src/data/local/post_draft_repository.dart';
import 'package:feedin/src/data/local/profile_repository_contract.dart';
import 'package:feedin/src/data/local/upload_queue_repository.dart';
import 'package:feedin/src/data/remote/messages_remote_data_source.dart';
import 'package:feedin/src/features/auth/data/auth_repository.dart';
import 'package:feedin/src/features/auth/data/auth_repository_contract.dart';
import 'package:feedin/src/features/create/post_draft.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/messages/message_models.dart';
import 'package:feedin/src/features/messages/message_recipient.dart';
import 'package:feedin/src/features/notifications/notification_item.dart';
import 'package:feedin/src/features/profile/user_profile.dart';
import 'package:feedin/src/features/settings/app_preferences.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show UserIdentity;

void main() {
  testWidgets('feedIn offline preview opens from auth gate', (tester) async {
    final services = FeedinServices(
      config: const FeedinConfig(supabaseUrl: '', supabasePublishableKey: ''),
      authRepository: _FakeAuthRepository(),
      profileRepository: _MemoryProfileRepository(),
      feedRepository: _MemoryFeedRepository(),
      messagesRepository: _MemoryMessagesRepository(),
      messagesRemoteDataSource: const MessagesRemoteDataSource(
        isConfigured: false,
      ),
      notificationRepository: _FakeNotificationRepository(),
      preferencesRepository: _FakePreferencesRepository(),
      conversationStarter: const _FakeConversationStarter(),
      postDraftRepository: _FakePostDraftRepository(),
      uploadQueueRepository: _FakeUploadQueueRepository(),
      syncService: const _FakeSyncService(),
      uploadQueueService: const _FakeUploadQueueService(),
      foregroundSyncCoordinator: ForegroundSyncCoordinator(
        syncService: const _FakeSyncService(),
        uploadQueueService: const _FakeUploadQueueService(),
        interval: const Duration(hours: 1),
      ),
      storageDiagnosticsService: const _FakeStorageDiagnosticsService(),
      realtimeService: FeedinRealtimeService(isConfigured: false),
      connectivityService: ConnectivityService(isEnabled: false),
      storageMaintenance: const _FakeStorageMaintenance(),
      pushNotificationService: PushNotificationService(isConfigured: false),
      localNotificationsService: LocalNotificationsService(isConfigured: false),
      callKitService: CallKitService(isConfigured: false),
    );

    await tester.pumpWidget(
      FeedinApp(config: services.config, servicesOverride: services),
    );
    // The branded splash animation (~1.1s) plays before the auth screen; let it
    // finish so the gate advances to the login/local-mode surface.
    await tester.pump(const Duration(milliseconds: 1300));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('feedIn'), findsOneWidget);
    expect(find.text('Open local mode'), findsOneWidget);

    await tester.tap(find.text('Open local mode'));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Complete profile'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Videos'), findsOneWidget);
    expect(find.text('Photos'), findsOneWidget);
    expect(find.text('Live'), findsOneWidget);
    expect(find.text('Wallet'), findsOneWidget);

    await tester.tap(find.text('Chats'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();

    // Messaging is a focused full-screen destination: the app-wide navigation
    // stays hidden on both the inbox and thread surfaces.
    expect(find.text('Feed'), findsNothing);
    expect(find.text('Chats'), findsNothing);
    expect(find.text('Wallet'), findsNothing);
    expect(find.text('Profile'), findsNothing);
    expect(find.text('feedIn Support'), findsOneWidget);

    await tester.tap(find.text('feedIn Support'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(find.text('Feed'), findsNothing);
    expect(find.text('Wallet'), findsNothing);
    expect(find.text('Local messages ready'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(find.text('feedIn Support'), findsOneWidget);
    expect(find.text('Feed'), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Videos'), findsOneWidget);
    expect(find.text('Feed'), findsOneWidget);
    expect(find.text('Chats'), findsOneWidget);
  });
}

class _FakePostDraftRepository implements PostDraftRepository {
  @override
  Future<void> deleteDraft(String draftId) async {}

  @override
  Future<List<PostDraft>> loadDrafts() async => const [];

  @override
  Future<void> markState({
    required String draftId,
    required DraftUploadState uploadState,
  }) async {}

  @override
  Future<PostDraft> saveDraft({
    required String content,
    String? mediaPath,
    String? mediaType,
    List<String> mediaPaths = const [],
    List<String> mediaTypes = const [],
    String privacy = 'everyone',
    String draftKind = 'post',
    String? mediaFilterId,
  }) async {
    return PostDraft(
      id: 'draft',
      content: content,
      createdAtMillis: 1,
      mediaPath: mediaPath ?? mediaPaths.firstOrNull,
      mediaType: mediaType ?? mediaTypes.firstOrNull,
      mediaPaths: mediaPaths,
      mediaTypes: mediaTypes,
      privacy: privacy,
      draftKind: draftKind,
      mediaFilterId: mediaFilterId,
    );
  }
}

class _FakeUploadQueueRepository implements UploadQueueRepository {
  @override
  Future<int> count() async => 0;

  @override
  Future<void> enqueueDraft(String draftId) async {}

  @override
  Future<List<UploadQueueItem>> loadQueuedItems() async => const [];

  @override
  Future<void> remove(String draftId) async {}

  @override
  Future<void> updateProgress(String draftId, int progress) async {}
}

class _FakeStorageDiagnosticsService implements StorageDiagnosticsService {
  const _FakeStorageDiagnosticsService();

  @override
  bool get isConfigured => false;

  @override
  Future<StorageDiagnosticsSummary> checkPostMedia() async {
    return const StorageDiagnosticsSummary(
      attempted: false,
      canListOwnPrefix: false,
      publicUrlGenerated: false,
      message: 'Test storage check skipped.',
    );
  }
}

class _FakeSyncService implements SyncServiceContract {
  const _FakeSyncService();

  @override
  Future<SyncSummary> syncNow() async {
    return const SyncSummary(
      attempted: false,
      feedActionsSynced: 0,
      messagesSynced: 0,
      message: 'Test sync skipped.',
    );
  }
}

class _FakeStorageMaintenance implements LocalStorageMaintenance {
  const _FakeStorageMaintenance();

  @override
  Future<LocalStorageSnapshot> snapshot() async {
    return const LocalStorageSnapshot(
      profileRecords: 0,
      feedPosts: 0,
      pendingActions: 0,
      conversations: 0,
      messages: 0,
      notifications: 0,
      mediaFiles: 0,
      mediaBytes: 0,
    );
  }

  @override
  Future<void> clearFeedCache() async {}

  @override
  Future<void> clearMessages() async {}

  @override
  Future<void> clearMediaCache() async {}

  @override
  Future<void> clearNotifications() async {}

  @override
  Future<void> clearPendingActions() async {}
}

class _FakeNotificationRepository implements NotificationRepositoryContract {
  final List<NotificationItem> _notifications = [
    const NotificationItem(
      id: 'message-notification',
      title: 'New message',
      body: 'Open chat',
      createdAtMillis: 1,
      isRead: false,
      route: 'conversation:demo-conversation',
    ),
  ];

  @override
  Future<void> addNotification({
    required String title,
    required String body,
    String? route,
    String? rawType,
    String? displayName,
    String? avatarUrl,
  }) async {
    _notifications.add(
      NotificationItem(
        id: title,
        title: title,
        body: body,
        createdAtMillis: 2,
        isRead: false,
        route: route,
        rawType: rawType,
        displayName: displayName,
        avatarUrl: avatarUrl,
      ),
    );
  }

  @override
  Future<void> clear() async {}

  @override
  Future<List<NotificationItem>> loadNotifications() async => _notifications;

  @override
  Future<void> markAllRead() async {}

  @override
  Future<void> markRead(String notificationId) async {}

  @override
  Future<int> unreadCount() async => 0;
}

class _FakePreferencesRepository implements PreferencesRepositoryContract {
  AppPreferences _preferences = AppPreferences.defaults;

  @override
  Future<void> clear() async {
    _preferences = AppPreferences.defaults;
  }

  @override
  Future<AppPreferences> load() async => _preferences;

  @override
  Future<void> save(AppPreferences preferences) async {
    _preferences = preferences;
  }
}

class _FakeConversationStarter implements ConversationStarter {
  const _FakeConversationStarter();

  @override
  Future<List<MessageRecipient>> searchRecipients(String query) async =>
      const [];

  @override
  Future<ConversationSummary> startConversation({
    required MessageRecipient recipient,
  }) async {
    return ConversationSummary(
      id: 'starter-conversation',
      title: recipient.displayName,
      lastMessagePreview: 'Tap to send your first message.',
      updatedAtMillis: 1,
      pendingCount: 0,
    );
  }
}

class _FakeUploadQueueService implements UploadQueueService {
  const _FakeUploadQueueService();

  @override
  Future<UploadQueueSummary> processQueue() async {
    return const UploadQueueSummary(
      attempted: false,
      uploaded: 0,
      failed: 0,
      message: 'Test upload skipped.',
    );
  }
}

class _FakeAuthRepository implements AuthRepositoryContract {
  @override
  bool get isConfigured => false;

  @override
  Future<AuthUser?> restoreSession() async => null;

  @override
  Future<AuthUser> signInWithPassword({
    required String email,
    required String password,
  }) async => const AuthUser.demo();

  @override
  Future<AuthUser> signInWithIdentifier({
    required String identifier,
    required String password,
  }) async => const AuthUser.demo();

  @override
  Future<AuthUser?> signUpWithPassword({
    required String email,
    required String password,
  }) async => const AuthUser.demo();

  @override
  Future<void> sendPasswordReset({required String email}) async {}

  @override
  Future<void> updatePassword({required String password}) async {}

  @override
  Future<void> signOut() async {}

  @override
  Future<AuthUser> signInWithGoogle({
    required String idToken,
    String? accessToken,
  }) async => const AuthUser.demo();

  @override
  Future<void> linkGoogleIdentity() async {}

  @override
  Future<void> unlinkIdentity(UserIdentity identity) async {}

  @override
  Future<List<UserIdentity>> listIdentities() async => const [];
}

class _MemoryProfileRepository implements ProfileRepositoryContract {
  UserProfile? _profile;

  @override
  Future<UserProfile?> loadCurrentProfile() async => _profile;

  @override
  Future<UserProfile?> loadProfileForUser(String userId) async {
    return _profile?.userId == userId ? _profile : null;
  }

  @override
  Future<void> saveCurrentProfile(UserProfile profile) async {
    _profile = profile;
  }

  @override
  Future<void> syncProfile(UserProfile profile) async {
    _profile = profile;
  }

  @override
  Future<UserProfile> uploadProfileImage({
    required UserProfile profile,
    required ProfileImageSlot slot,
    required File file,
  }) async {
    final updated = slot == ProfileImageSlot.avatar
        ? profile.copyWith(avatarUrl: file.path)
        : profile.copyWith(coverUrl: file.path);
    _profile = updated;
    return updated;
  }

  @override
  Future<void> clearCurrentProfile() async {
    _profile = null;
  }
}

class _MemoryFeedRepository implements LocalFeedRepositoryContract {
  int _pendingActions = 0;

  @override
  Future<List<FeedPost>> loadPosts() async {
    return const [
      FeedPost(
        id: 'test-1',
        userId: 'test-user',
        authorName: 'feedIn System',
        body: 'Cached test post',
        meta: 'Local-first',
        createdAtMillis: 1,
      ),
      FeedPost(
        id: 'test-2',
        userId: 'test-user',
        authorName: 'Platform',
        body: 'Cross-platform test post',
        meta: 'Cross-platform',
        createdAtMillis: 0,
      ),
    ];
  }

  @override
  Future<FeedRefreshResult> refresh() async {
    return FeedRefreshResult(posts: await loadPosts(), usedRemote: false);
  }

  @override
  Future<FeedPaginationResult> loadMorePosts() async {
    return FeedPaginationResult(posts: await loadPosts(), hasMore: false);
  }

  @override
  Future<List<FeedPost>> loadPostsByUser(String userId) async {
    final posts = await loadPosts();
    return posts.where((post) => post.userId == userId).toList();
  }

  @override
  Future<List<FeedPost>> loadSavedPosts() async {
    final posts = await loadPosts();
    return posts.where((post) => post.viewerHasSaved).toList();
  }

  @override
  Future<void> deletePost(String postId) async {
    _pendingActions++;
  }

  @override
  Future<FeedSearchResults> search(String query, {int limit = 30}) async {
    final normalized = query.trim().toLowerCase();
    final posts = await loadPosts();
    return FeedSearchResults(
      posts: posts
          .where(
            (post) =>
                post.body.toLowerCase().contains(normalized) ||
                post.authorName.toLowerCase().contains(normalized),
          )
          .take(limit)
          .toList(),
    );
  }

  @override
  Future<List<LiveFeedItem>> loadLiveItems() async => const [];

  @override
  Future<void> queueLike(String postId) async {
    _pendingActions++;
  }

  @override
  Future<bool> toggleLike(String postId, {required bool liked}) async {
    return !liked;
  }

  @override
  Future<bool> toggleSave(String postId, {required bool saved}) async {
    return !saved;
  }

  @override
  Future<List<FeedComment>> loadComments(String postId) async => const [];

  @override
  Future<FeedComment> addComment(
    String postId,
    String body, {
    String? parentCommentId,
  }) async {
    return FeedComment(
      id: 'comment-${_pendingActions++}',
      userId: 'test-user',
      authorName: 'Tester',
      authorHandle: '@tester',
      content: body,
      createdAtMillis: DateTime.now().millisecondsSinceEpoch,
      parentCommentId: parentCommentId,
    );
  }

  @override
  Future<bool> toggleCommentLike(
    String commentId, {
    required bool liked,
  }) async {
    _pendingActions++;
    return !liked;
  }

  @override
  Future<void> deleteComment(String commentId) async {
    _pendingActions++;
  }

  @override
  Future<FeedPost> createQuoteRefeed(String postId, String quote) async {
    _pendingActions++;
    return FeedPost(
      id: 'quote-$_pendingActions',
      userId: 'test-user',
      authorName: 'Tester',
      body: quote,
      meta: '@tester',
      createdAtMillis: DateTime.now().millisecondsSinceEpoch,
      postType: 'refeed',
      originalPostId: postId,
    );
  }

  @override
  Future<bool> toggleRefeed(String postId, {required bool refeeded}) async {
    _pendingActions++;
    return !refeeded;
  }

  @override
  Future<void> queueSave(String postId) async {
    _pendingActions++;
  }

  @override
  Future<void> queueComment(String postId, String body) async {
    _pendingActions++;
  }

  @override
  Future<void> queueRefeed(String postId) async {
    _pendingActions++;
  }

  @override
  Future<void> queueShare(String postId) async {
    _pendingActions++;
  }

  @override
  Future<int> pendingActionCount() async => _pendingActions;
}

class _MemoryMessagesRepository implements LocalMessagesRepositoryContract {
  @override
  Future<List<ConversationSummary>> loadConversations() async {
    return const [
      ConversationSummary(
        id: 'test-conversation',
        title: 'feedIn Support',
        lastMessagePreview: 'Local messages ready',
        updatedAtMillis: 1,
        pendingCount: 0,
      ),
    ];
  }

  @override
  Future<ConversationSummary?> loadConversation(String conversationId) async {
    return const ConversationSummary(
      id: 'test-conversation',
      title: 'feedIn Support',
      lastMessagePreview: 'Local messages ready',
      updatedAtMillis: 1,
      pendingCount: 0,
    );
  }

  @override
  Future<ConversationSummary?> loadConversationByServerId(
    String serverConversationId,
  ) async {
    return null;
  }

  @override
  Future<ConversationSummary> createConversation({
    required String title,
  }) async {
    return ConversationSummary(
      id: 'new-conversation',
      title: title,
      lastMessagePreview: 'Tap to send your first message.',
      updatedAtMillis: 1,
      pendingCount: 0,
    );
  }

  @override
  Future<void> upsertConversation(ConversationSummary conversation) async {}

  @override
  Future<List<LocalMessage>> loadMessages(String conversationId) async {
    return const [
      LocalMessage(
        id: 'test-message',
        conversationId: 'test-conversation',
        senderName: 'feedIn Support',
        body: 'Local messages ready',
        createdAtMillis: 1,
        deliveryState: MessageDeliveryState.delivered,
      ),
    ];
  }

  @override
  Future<List<LocalMessage>> loadPendingMessages() async => const [];

  @override
  Future<void> upsertMessage(LocalMessage message) async {}

  @override
  Future<void> markMessageState({
    required String messageId,
    required MessageDeliveryState deliveryState,
  }) async {}

  @override
  Future<void> markConversationSynced({
    required String conversationId,
    required String serverConversationId,
  }) async {}

  @override
  Future<void> setConversationDisappearingSeconds({
    required String conversationId,
    required int seconds,
  }) async {}

  @override
  Future<void> markConversationRead(String conversationId) async {}

  @override
  Future<void> queueMessage({
    required String conversationId,
    required String senderName,
    required String body,
    String? senderId,
    String? senderAvatarUrl,
    String? replyToId,
    int? expiresAtMillis,
  }) async {}

  @override
  Future<void> queueAttachment({
    required String conversationId,
    required String senderName,
    required String localPath,
    required String mediaType,
    String? senderId,
    String? senderAvatarUrl,
    String? mimeType,
    String? fileName,
    int? fileSizeBytes,
    String? caption,
    bool viewOnce = false,
    int? expiresAtMillis,
  }) async {}
}
