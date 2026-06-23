import '../../features/feed/feed_post.dart';

abstract interface class LocalFeedRepositoryContract {
  Future<List<FeedPost>> loadPosts();
  Future<FeedRefreshResult> refresh();
  Future<FeedPaginationResult> loadMorePosts();
  Future<void> queueLike(String postId);
  Future<void> queueSave(String postId);
  Future<void> queueComment(String postId, String body);
  Future<int> pendingActionCount();
}

class FeedRefreshResult {
  const FeedRefreshResult({
    required this.posts,
    required this.usedRemote,
    this.message,
  });

  final List<FeedPost> posts;
  final bool usedRemote;
  final String? message;
}

class FeedPaginationResult {
  const FeedPaginationResult({
    required this.posts,
    required this.hasMore,
    this.message,
  });

  final List<FeedPost> posts;
  final bool hasMore;
  final String? message;
}
