import 'dart:io';

import 'package:feedin/src/core/connectivity/connectivity_service.dart';
import 'package:feedin/src/core/sync/sync_service.dart';
import 'package:feedin/src/data/local/local_feed_repository_contract.dart';
import 'package:feedin/src/data/local/profile_repository_contract.dart';
import 'package:feedin/src/data/remote/social_graph_remote_data_source.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/profile/user_profile.dart';
import 'package:feedin/src/features/profile/user_profile_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('other-user profile is read-only and renders posts', (
    tester,
  ) async {
    final profileRepository = _ProfileRepository(
      const UserProfile(
        userId: 'creator-1',
        displayName: 'Ada Creator',
        handle: 'ada',
        bio: 'Builds useful things.',
        completedAtMillis: 1,
        followersCount: 3,
      ),
    );
    final feedRepository = _FeedRepository(const [
      FeedPost(
        id: 'post-1',
        userId: 'creator-1',
        authorName: 'Ada Creator',
        body: 'Creator post',
        meta: '@ada',
        createdAtMillis: 1,
      ),
    ]);

    await tester.pumpWidget(
      MaterialApp(
        home: UserProfileScreen(
          userId: 'creator-1',
          profileRepository: profileRepository,
          feedRepository: feedRepository,
          connectivityService: ConnectivityService(isEnabled: false),
          syncService: const _SyncService(),
          currentUserId: 'viewer-1',
          onOpenUserProfile: (_) {},
          socialGraphDataSource: const SocialGraphRemoteDataSource(
            isConfigured: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Ada Creator'), findsWidgets);
    expect(find.text('Follow'), findsOneWidget);
    expect(find.text('Edit Profile'), findsNothing);
    expect(find.byTooltip('Settings'), findsNothing);
    expect(find.byTooltip('Change cover photo'), findsNothing);
    expect(find.byIcon(Icons.photo_camera_outlined), findsNothing);
    expect(profileRepository.requestedUserIds, ['creator-1']);
    expect(feedRepository.requestedUserIds, ['creator-1']);
  });
}

class _ProfileRepository implements ProfileRepositoryContract {
  _ProfileRepository(this.profile);

  final UserProfile profile;
  final List<String> requestedUserIds = <String>[];

  @override
  Future<UserProfile?> loadProfileForUser(String userId) async {
    requestedUserIds.add(userId);
    return profile.userId == userId ? profile : null;
  }

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

class _FeedRepository implements LocalFeedRepositoryContract {
  _FeedRepository(this.posts);

  final List<FeedPost> posts;
  final List<String> requestedUserIds = <String>[];

  @override
  Future<List<FeedPost>> loadPostsByUser(String userId) async {
    requestedUserIds.add(userId);
    return posts.where((post) => post.userId == userId).toList();
  }

  @override
  Future<FeedRankedResult> fetchRankedFeed({
    int limit = 20,
    int offset = 0,
    required String sessionId,
    required bool isNewSession,
  }) => throw UnimplementedError();

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

  @override
  Future<FeedPost> createQuoteRefeed(String postId, String quote) =>
      throw UnimplementedError();

  @override
  Future<List<FeedPost>> loadSavedPosts() async => const [];

  @override
  Future<void> deletePost(String postId) async {}

  @override
  Future<List<FeedComment>> loadComments(String postId) async => const [];

  @override
  Future<List<LiveFeedItem>> loadLiveItems() async => const [];

  @override
  Future<FeedPaginationResult> loadMorePosts() => throw UnimplementedError();

  @override
  Future<List<FeedPost>> loadPosts() async => posts;

  @override
  Future<int> pendingActionCount() async => 0;

  @override
  Future<void> queueComment(String postId, String body) async {}

  @override
  Future<void> queueLike(String postId) async {}

  @override
  Future<void> queueRefeed(String postId) async {}

  @override
  Future<void> queueSave(String postId) async {}

  @override
  Future<void> queueShare(String postId) async {}

  @override
  Future<FeedRefreshResult> refresh() async =>
      FeedRefreshResult(posts: posts, usedRemote: false);

  @override
  Future<FeedSearchResults> search(String query, {int limit = 30}) async =>
      const FeedSearchResults();

  @override
  Future<bool> toggleLike(String postId, {required bool liked}) async => !liked;

  @override
  Future<bool> toggleRefeed(String postId, {required bool refeeded}) async =>
      !refeeded;

  @override
  Future<bool> toggleSave(String postId, {required bool saved}) async => !saved;
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
