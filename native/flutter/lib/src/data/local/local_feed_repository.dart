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
  Future<List<FeedPost>> loadSavedPosts() async {
    try {
      return await _remoteDataSource.fetchSavedPosts();
    } catch (_) {
      final posts = await loadPosts();
      return posts.where((post) => post.viewerHasSaved).toList();
    }
  }

  @override
  Future<void> deletePost(String postId) async {
    await _remoteDataSource.deletePost(postId);
    await _box.delete(postId);
  }

  @override
  Future<FeedSearchResults> search(String query, {int limit = 30}) async {
    final normalized = query.trim();
    if (normalized.isEmpty) return const FeedSearchResults();

    try {
      final remote = await _remoteDataSource.search(normalized, limit: limit);
      if (!remote.isEmpty || _remoteDataSource.isConfigured) return remote;
    } catch (_) {
      // Fall through to cached search when remote search is unavailable.
    }
    final needle = normalized.replaceFirst(RegExp(r'^#'), '').toLowerCase();
    final posts = await loadPosts();
    final matches = posts
        .where((post) {
          final content = post.displayedPost;
          return content.body.toLowerCase().contains(needle) ||
              content.authorName.toLowerCase().contains(needle) ||
              (content.authorHandle?.toLowerCase().contains(needle) ?? false);
        })
        .take(limit)
        .toList(growable: false);
    final peopleById = <String, FeedSearchPerson>{};
    for (final post in posts) {
      final content = post.displayedPost;
      if (content.userId.isEmpty) continue;
      final handle = (content.authorHandle ?? '')
          .replaceFirst(RegExp(r'^@'), '')
          .trim();
      if (!content.authorName.toLowerCase().contains(needle) &&
          !handle.toLowerCase().contains(needle)) {
        continue;
      }
      peopleById.putIfAbsent(
        content.userId,
        () => FeedSearchPerson(
          userId: content.userId,
          displayName: content.authorName,
          handle: handle.isEmpty ? 'feedin_user' : handle,
          avatarUrl: content.avatarUrl,
        ),
      );
      if (peopleById.length >= limit) break;
    }
    return FeedSearchResults(
      posts: matches,
      people: peopleById.values.toList(growable: false),
      hashtags: _hashtagsFromPosts(posts, needle: needle, limit: limit),
    );
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
  Future<FeedComment> addComment(
    String postId,
    String body, {
    String? parentCommentId,
  }) {
    return _remoteDataSource.addComment(
      postId,
      body,
      parentCommentId: parentCommentId,
    );
  }

  @override
  Future<bool> toggleCommentLike(String commentId, {required bool liked}) {
    return _remoteDataSource.toggleCommentLike(commentId, liked: liked);
  }

  @override
  Future<void> deleteComment(String commentId) {
    return _remoteDataSource.deleteComment(commentId);
  }

  @override
  Future<bool> toggleRefeed(String postId, {required bool refeeded}) {
    return _remoteDataSource.toggleRefeed(postId, refeeded: refeeded);
  }

  @override
  Future<FeedPost> createQuoteRefeed(String postId, String quote) {
    return _remoteDataSource.createQuoteRefeed(postId, quote);
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

  List<FeedSearchHashtag> _hashtagsFromPosts(
    List<FeedPost> posts, {
    required String needle,
    required int limit,
  }) {
    final counts = <String, int>{};
    final pattern = RegExp(r'#[A-Za-z0-9_]+');
    for (final post in posts) {
      for (final match in pattern.allMatches(post.displayedPost.body)) {
        final tag = match.group(0)!.substring(1).toLowerCase();
        if (needle.isNotEmpty && !tag.contains(needle)) continue;
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    final entries = counts.entries.toList()
      ..sort((a, b) {
        final byCount = b.value.compareTo(a.value);
        return byCount != 0 ? byCount : a.key.compareTo(b.key);
      });
    return entries
        .take(limit)
        .map(
          (entry) => FeedSearchHashtag(tag: entry.key, postCount: entry.value),
        )
        .toList(growable: false);
  }

  String _friendlyError(Object error) {
    final message = error.toString();
    if (message.length <= 180) return message;
    return '${message.substring(0, 180)}...';
  }
}
