import 'package:hive_ce/hive.dart';

import '../../core/storage/media_cache_service.dart';
import '../remote/feed_remote_data_source.dart';
import '../../features/feed/feed_post.dart';
import 'demo_posts.dart';
import 'local_record_decoder.dart';
import 'local_feed_repository_contract.dart';
import 'pending_action.dart';
import 'pending_action_repository.dart';

class LocalFeedRepository implements LocalFeedRepositoryContract {
  LocalFeedRepository({
    required Box<Map> box,
    required FeedRemoteDataSource remoteDataSource,
    required MediaCacheService mediaCacheService,
    required PendingActionRepository pendingActionRepository,
  }) : _box = box,
       _remoteDataSource = remoteDataSource,
       _mediaCacheService = mediaCacheService,
       _pendingActionRepository = pendingActionRepository;

  final Box<Map> _box;
  final FeedRemoteDataSource _remoteDataSource;
  final MediaCacheService _mediaCacheService;
  final PendingActionRepository _pendingActionRepository;

  @override
  Future<List<FeedPost>> loadPosts() async {
    await seedDemoPostsIfEmpty();
    final posts =
        _box.values
            .map((value) => decodeLocalRecord(value, FeedPost.fromJson))
            .whereType<FeedPost>()
            .toList()
          ..sort((a, b) => b.createdAtMillis.compareTo(a.createdAtMillis));
    return posts;
  }

  @override
  Future<FeedRefreshResult> refresh() async {
    try {
      final remotePosts = await _remoteDataSource.fetchFeed();

      if (remotePosts.isEmpty) {
        return FeedRefreshResult(
          posts: await loadPosts(),
          usedRemote: false,
          message: 'Showing cached feed.',
        );
      }

      await _box.clear();
      for (final post in remotePosts) {
        final cachedPost = await _cacheMediaForPost(post);
        await _box.put(cachedPost.id, cachedPost.toJson());
      }

      return FeedRefreshResult(posts: await loadPosts(), usedRemote: true);
    } catch (_) {
      return FeedRefreshResult(
        posts: await loadPosts(),
        usedRemote: false,
        message: 'Refresh failed. Showing cached feed.',
      );
    }
  }

  @override
  Future<FeedPaginationResult> loadMorePosts() async {
    final currentPosts = await loadPosts();
    if (currentPosts.isEmpty) {
      final refreshResult = await refresh();
      return FeedPaginationResult(
        posts: refreshResult.posts,
        hasMore: refreshResult.usedRemote,
        message: refreshResult.message,
      );
    }

    try {
      final remotePosts = await _remoteDataSource.fetchFeed(
        beforeCreatedAtMillis: currentPosts.last.createdAtMillis,
      );
      if (remotePosts.isEmpty) {
        return FeedPaginationResult(
          posts: currentPosts,
          hasMore: false,
          message: 'No older posts available.',
        );
      }

      for (final post in remotePosts) {
        final cachedPost = await _cacheMediaForPost(post);
        await _box.put(cachedPost.id, cachedPost.toJson());
      }

      return FeedPaginationResult(posts: await loadPosts(), hasMore: true);
    } catch (_) {
      return FeedPaginationResult(
        posts: currentPosts,
        hasMore: true,
        message: 'Could not load older posts.',
      );
    }
  }

  Future<FeedPost> _cacheMediaForPost(FeedPost post) async {
    final mediaUrl = post.mediaUrl;
    if (mediaUrl == null || mediaUrl.isEmpty) return post;

    final localPath = await _mediaCacheService.cacheRemoteMedia(mediaUrl);
    if (localPath == null) return post;

    return post.copyWith(localMediaPath: localPath);
  }

  @override
  Future<void> queueLike(String postId) {
    return _pendingActionRepository.queueAction(
      type: PendingActionType.likePost,
      payload: {'post_id': postId},
    );
  }

  @override
  Future<void> queueSave(String postId) {
    return _pendingActionRepository.queueAction(
      type: PendingActionType.savePost,
      payload: {'post_id': postId},
    );
  }

  @override
  Future<void> queueComment(String postId, String body) {
    return _pendingActionRepository.queueAction(
      type: PendingActionType.commentOnPost,
      payload: {'post_id': postId, 'content': body},
    );
  }

  @override
  Future<int> pendingActionCount() {
    return _pendingActionRepository.count();
  }

  Future<void> seedDemoPostsIfEmpty() async {
    if (_box.isNotEmpty) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    for (final (index, post) in demoPosts.indexed) {
      final feedPost = FeedPost(
        id: 'demo-${index + 1}',
        authorName: post.authorName,
        body: post.body,
        meta: post.meta,
        createdAtMillis: now - (index * 1000),
      );
      await _box.put(feedPost.id, feedPost.toJson());
    }
  }
}
