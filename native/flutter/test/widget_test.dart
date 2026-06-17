import 'package:feedin/src/app/feedin_app.dart';
import 'package:feedin/src/app/feedin_services.dart';
import 'package:feedin/src/core/config/feedin_config.dart';
import 'package:feedin/src/core/storage/local_storage_maintenance.dart';
import 'package:feedin/src/core/sync/sync_service.dart';
import 'package:feedin/src/data/local/local_feed_repository_contract.dart';
import 'package:feedin/src/data/local/local_messages_repository_contract.dart';
import 'package:feedin/src/data/local/profile_repository_contract.dart';
import 'package:feedin/src/features/auth/data/auth_repository.dart';
import 'package:feedin/src/features/auth/data/auth_repository_contract.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/messages/message_models.dart';
import 'package:feedin/src/features/profile/user_profile.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('FEEDIN demo shell opens from auth gate', (tester) async {
    final services = FeedinServices(
      config: const FeedinConfig(supabaseUrl: '', supabasePublishableKey: ''),
      authRepository: _FakeAuthRepository(),
      profileRepository: _MemoryProfileRepository(),
      feedRepository: _MemoryFeedRepository(),
      messagesRepository: _MemoryMessagesRepository(),
      syncService: const _FakeSyncService(),
      storageMaintenance: const _FakeStorageMaintenance(),
    );

    await tester.pumpWidget(
      FeedinApp(config: services.config, servicesOverride: services),
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('FEEDIN'), findsOneWidget);
    expect(find.text('Enter demo shell'), findsOneWidget);

    await tester.tap(find.text('Enter demo shell'));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Complete profile'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Local-first'), findsWidgets);
    expect(find.text('Cross-platform'), findsWidgets);
  });
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
  Future<void> clearPendingActions() async {}
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
        authorName: 'FEEDIN System',
        body: 'Cached test post',
        meta: 'Local-first',
        createdAtMillis: 1,
      ),
      FeedPost(
        id: 'test-2',
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
  Future<void> queueLike(String postId) async {
    _pendingActions++;
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
  Future<int> pendingActionCount() async => _pendingActions;
}

class _MemoryMessagesRepository implements LocalMessagesRepositoryContract {
  @override
  Future<List<ConversationSummary>> loadConversations() async {
    return const [
      ConversationSummary(
        id: 'test-conversation',
        title: 'FEEDIN Support',
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
      title: 'FEEDIN Support',
      lastMessagePreview: 'Local messages ready',
      updatedAtMillis: 1,
      pendingCount: 0,
    );
  }

  @override
  Future<List<LocalMessage>> loadMessages(String conversationId) async {
    return const [
      LocalMessage(
        id: 'test-message',
        conversationId: 'test-conversation',
        senderName: 'FEEDIN Support',
        body: 'Local messages ready',
        createdAtMillis: 1,
        deliveryState: MessageDeliveryState.delivered,
      ),
    ];
  }

  @override
  Future<List<LocalMessage>> loadPendingMessages() async => const [];

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
  Future<void> queueMessage({
    required String conversationId,
    required String senderName,
    required String body,
  }) async {}
}
