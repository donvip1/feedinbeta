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
    required bool seedDemoContent,
  }) : _box = box,
       _remoteDataSource = remoteDataSource,
       _mediaCacheService = mediaCacheService,
       _pendingActionRepository = pendingActionRepository,
       _seedDemoContent = seedDemoContent;

  final Box<Map> _box;
  final FeedRemoteDataSource _remoteDataSource;
  final MediaCacheService _mediaCacheService;
  final PendingActionRepository _pendingActionRepository;
  final bool _seedDemoContent;

  @override
  Future<List<FeedPost>> loadPosts() async {
    if (_seedDemoContent) {
      await seedDemoPostsIfEmpty();
    } else {
      await _removeDemoPosts();
    }
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
          message: 'No active posts returned from Supabase.',
        );
      }

      final cachedPosts = await loadPosts();
      final refreshedIds = remotePosts.map((post) => post.id).toSet();
      final oldestRemote = remotePosts
          .map((post) => post.createdAtMillis)
          .reduce((a, b) => a < b ? a : b);
      for (final cached in cachedPosts) {
        if (cached.createdAtMillis >= oldestRemote &&
            !refreshedIds.contains(cached.id)) {
          await _box.delete(cached.id);
        }
      }
      for (final post in remotePosts) {
        final cachedPost = await _cacheMediaForPost(post);
        await _box.put(cachedPost.id, cachedPost.toJson());
      }

      return FeedRefreshResult(posts: await loadPosts(), usedRemote: true);
    } catch (error) {
      return FeedRefreshResult(
        posts: await loadPosts(),
        usedRemote: false,
        message: 'Feed refresh failed: ${_friendlyError(error)}',
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

  @override
  Future<List<FeedPost>> loadPostsByUser(String userId) async {
    try {
      final remotePosts = await _remoteDataSource.fetchFeed(
        userId: userId,
        limit: 60,
      );
      return remotePosts;
    } catch (_) {
      final posts = await loadPosts();
      return posts.where((post) => post.userId == userId).toList();
    }
  }

  @override
  Future<List<LiveFeedItem>> loadLiveItems() {
    return _remoteDataSource.fetchLiveItems();
  }

  Future<FeedPost> _cacheMediaForPost(FeedPost post) async {
    final mediaUrl = post.mediaUrl ?? post.mediaUrls.firstOrNull;
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
  Future<bool> toggleLike(String postId, {required bool liked}) {
    return _remoteDataSource.toggleLike(postId, liked: liked);
  }

  @override
  Future<bool> toggleSave(String postId, {required bool saved}) {
    return _remoteDataSource.toggleSave(postId, saved: saved);
  }

  @override
  Future<List<FeedComment>> loadComments(String postId) {
    return _remoteDataSource.fetchComments(postId);
  }

  @override
  Future<FeedComment> addComment(String postId, String body) {
    return _remoteDataSource.addComment(postId, body);
  }

  @override
  Future<bool> toggleRefeed(String postId, {required bool refeeded}) {
    return _remoteDataSource.toggleRefeed(postId, refeeded: refeeded);
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
  Future<void> queueRefeed(String postId) {
    return _pendingActionRepository.queueAction(
      type: PendingActionType.refeedPost,
      payload: {'post_id': postId},
    );
  }

  @override
  Future<void> queueShare(String postId) {
    return _pendingActionRepository.queueAction(
      type: PendingActionType.sharePost,
      payload: {'post_id': postId},
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
        userId: 'local-demo',
        authorName: post.authorName,
        body: post.body,
        meta: post.meta,
        createdAtMillis: now - (index * 1000),
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        mediaTypes: post.mediaTypes,
        location: post.location,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        viewsCount: post.viewsCount,
        refeedsCount: post.refeedsCount,
      );
      await _box.put(feedPost.id, feedPost.toJson());
    }
  }

  Future<void> _removeDemoPosts() async {
    final demoKeys = _box.keys
        .where((key) => key.toString().startsWith('demo-'))
        .toList();
    for (final key in demoKeys) {
      await _box.delete(key);
    }
  }

  String _friendlyError(Object error) {
    final message = error.toString();
    if (message.length <= 180) return message;
    return '${message.substring(0, 180)}...';
  }
}
