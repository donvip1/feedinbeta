import 'package:hive_ce/hive.dart';

import '../remote/feed_remote_data_source.dart';
import '../../features/feed/feed_post.dart';
import 'demo_posts.dart';
import 'local_feed_repository_contract.dart';
import 'pending_action.dart';
import 'pending_action_repository.dart';

class LocalFeedRepository implements LocalFeedRepositoryContract {
  LocalFeedRepository({
    required Box<Map> box,
    required FeedRemoteDataSource remoteDataSource,
    required PendingActionRepository pendingActionRepository,
  }) : _box = box,
       _remoteDataSource = remoteDataSource,
       _pendingActionRepository = pendingActionRepository;

  final Box<Map> _box;
  final FeedRemoteDataSource _remoteDataSource;
  final PendingActionRepository _pendingActionRepository;

  @override
  Future<List<FeedPost>> loadPosts() async {
    await seedDemoPostsIfEmpty();
    final posts =
        _box.values
            .map((value) => FeedPost.fromJson(Map<String, Object?>.from(value)))
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
        await _box.put(post.id, post.toJson());
      }

      return FeedRefreshResult(posts: remotePosts, usedRemote: true);
    } catch (_) {
      return FeedRefreshResult(
        posts: await loadPosts(),
        usedRemote: false,
        message: 'Refresh failed. Showing cached feed.',
      );
    }
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
