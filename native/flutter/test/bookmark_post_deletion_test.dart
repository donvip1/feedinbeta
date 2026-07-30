import 'dart:io';

import 'package:feedin/src/core/connectivity/connectivity_service.dart';
import 'package:feedin/src/core/sync/sync_service.dart';
import 'package:feedin/src/data/local/local_feed_repository_contract.dart';
import 'package:feedin/src/data/local/profile_repository_contract.dart';
import 'package:feedin/src/data/remote/social_graph_remote_data_source.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/feed_post_pager_screen.dart';
import 'package:feedin/src/features/profile/profile_screen.dart';
import 'package:feedin/src/features/profile/user_profile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const owner = UserProfile(
    userId: 'owner-1',
    displayName: 'Owner User',
    handle: 'owner',
    bio: 'Owner profile',
    completedAtMillis: 1,
  );

  const savedPost = FeedPost(
    id: 'saved-1',
    userId: 'creator-1',
    authorName: 'Saved Creator',
    body: 'Saved post body',
    meta: '@saved',
    createdAtMillis: 2,
    viewerHasSaved: true,
  );

  testWidgets('Profile Saved tab loads live bookmarked posts', (tester) async {
    final repository = _EngagementRepository(savedPosts: const [savedPost]);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProfileScreen(
            profile: owner,
            profileRepository: const _ProfileRepository(),
            feedRepository: repository,
            syncService: const _SyncService(),
            connectivityService: ConnectivityService(isEnabled: false),
            onEditSaved: (_) {},
            onOpenSettings: () {},
            socialGraphDataSource: const SocialGraphRemoteDataSource(
              isConfigured: false,
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(repository.savedLoads, 1);
    await tester.drag(find.byType(NestedScrollView), const Offset(0, -420));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Saved'));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Nothing saved yet'), findsNothing);
    expect(find.byType(InkWell), findsWidgets);
  });

  testWidgets('bookmark toggle rolls back when repository update fails', (
    tester,
  ) async {
    final repository = _EngagementRepository(
      savedPosts: const [savedPost],
      failSave: true,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: FeedPostPagerScreen(
          posts: const [savedPost],
          initialIndex: 0,
          feedRepository: repository,
          syncService: const _SyncService(),
          connectivityService: ConnectivityService(isEnabled: false),
          currentUserId: 'owner-1',
          onOpenUserProfile: (_) {},
          socialGraphDataSource: const SocialGraphRemoteDataSource(
            isConfigured: false,
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byKey(const Key('feed-action-more')));
    await tester.pump(const Duration(milliseconds: 350));
    final bookmarkAction = find.byKey(const Key('feed-action-save'));
    expect(bookmarkAction, findsOneWidget);
    await tester.tap(bookmarkAction);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(repository.saveCalls, [('saved-1', true)]);
    expect(repository.failSave, isTrue);
    expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
  });

  testWidgets('owner can permanently delete a post after confirmation', (
    tester,
  ) async {
    const ownerPost = FeedPost(
      id: 'owner-post',
      userId: 'owner-1',
      authorName: 'Owner User',
      body: 'Delete me',
      meta: '@owner',
      createdAtMillis: 3,
    );
    final repository = _EngagementRepository();

    await tester.pumpWidget(
      MaterialApp(
        home: FeedPostPagerScreen(
          posts: const [ownerPost],
          initialIndex: 0,
          feedRepository: repository,
          syncService: const _SyncService(),
          connectivityService: ConnectivityService(isEnabled: false),
          currentUserId: 'owner-1',
          onOpenUserProfile: (_) {},
          socialGraphDataSource: const SocialGraphRemoteDataSource(
            isConfigured: false,
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byKey(const Key('post-more-actions')));
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('This permanently deletes the post.'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(repository.deletedPostIds, ['owner-post']);
  });

  testWidgets('post actions stay hidden for a non-owner', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: FeedPostPagerScreen(
          posts: const [savedPost],
          initialIndex: 0,
          feedRepository: _EngagementRepository(),
          syncService: const _SyncService(),
          connectivityService: ConnectivityService(isEnabled: false),
          currentUserId: 'viewer-1',
          onOpenUserProfile: (_) {},
          socialGraphDataSource: const SocialGraphRemoteDataSource(
            isConfigured: false,
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.byKey(const Key('post-more-actions')), findsNothing);
  });
}

class _EngagementRepository implements LocalFeedRepositoryContract {
  _EngagementRepository({this.savedPosts = const [], this.failSave = false});

  final List<FeedPost> savedPosts;
  final bool failSave;
  int savedLoads = 0;
  final List<(String, bool)> saveCalls = [];
  final List<String> deletedPostIds = [];

  @override
  Future<List<FeedPost>> loadSavedPosts() async {
    savedLoads++;
    return savedPosts;
  }

  @override
  Future<bool> toggleSave(String postId, {required bool saved}) async {
    saveCalls.add((postId, saved));
    if (failSave) throw StateError('save failed');
    return !saved;
  }

  @override
  Future<void> deletePost(String postId) async {
    deletedPostIds.add(postId);
  }

  @override
  Future<List<FeedPost>> loadPostsByUser(String userId) async => const [];

  @override
  Future<List<FeedPost>> loadPosts() async => const [];

  @override
  Future<FeedRefreshResult> refresh() async =>
      const FeedRefreshResult(posts: [], usedRemote: false);

  @override
  Future<FeedPaginationResult> loadMorePosts() async =>
      const FeedPaginationResult(posts: [], hasMore: false);

  @override
  Future<FeedSearchResults> search(String query, {int limit = 30}) async =>
      const FeedSearchResults();

  @override
  Future<List<LiveFeedItem>> loadLiveItems() async => const [];

  @override
  Future<int> pendingActionCount() async => 0;

  @override
  Future<void> queueLike(String postId) async {}

  @override
  Future<void> queueComment(String postId, String body) async {}

  @override
  Future<void> queueRefeed(String postId) async {}

  @override
  Future<void> queueSave(String postId) async {}

  @override
  Future<void> queueShare(String postId) async {}

  @override
  Future<bool> toggleLike(String postId, {required bool liked}) async => !liked;

  @override
  Future<bool> toggleRefeed(String postId, {required bool refeeded}) async =>
      !refeeded;

  @override
  Future<FeedPost> createQuoteRefeed(String postId, String quote) =>
      throw UnimplementedError();

  @override
  Future<List<FeedComment>> loadComments(String postId) async => const [];

  @override
  Future<FeedComment> addComment(
    String postId,
    String body, {
    String? parentCommentId,
  }) => throw UnimplementedError();

  @override
  Future<bool> toggleCommentLike(String commentId, {required bool liked}) =>
      throw UnimplementedError();

  @override
  Future<void> deleteComment(String commentId) => throw UnimplementedError();
}

class _ProfileRepository implements ProfileRepositoryContract {
  const _ProfileRepository();

  @override
  Future<UserProfile?> loadProfileForUser(String userId) async => null;

  @override
  Future<UserProfile?> loadCurrentProfile() async => null;

  @override
  Future<void> saveCurrentProfile(UserProfile profile) async {}

  @override
  Future<void> syncProfile(UserProfile profile) async {}

  @override
  Future<UserProfile> uploadProfileImage({
    required UserProfile profile,
    required ProfileImageSlot slot,
    required File file,
  }) => throw UnimplementedError();

  @override
  Future<void> clearCurrentProfile() async {}
}

class _SyncService implements SyncServiceContract {
  const _SyncService();

  @override
  Future<SyncSummary> syncNow() async => const SyncSummary(
    attempted: false,
    feedActionsSynced: 0,
    messagesSynced: 0,
    message: 'Test sync disabled.',
  );
}
