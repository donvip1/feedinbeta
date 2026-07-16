import '../../features/feed/feed_post.dart';

abstract interface class LocalFeedRepositoryContract {
  Future<List<FeedPost>> loadPosts();
  Future<FeedRefreshResult> refresh();
  Future<FeedPaginationResult> loadMorePosts();
  Future<List<FeedPost>> loadPostsByUser(String userId);
  Future<List<LiveFeedItem>> loadLiveItems();
  Future<void> queueLike(String postId);
  Future<bool> toggleLike(String postId, {required bool liked});
  Future<bool> toggleSave(String postId, {required bool saved});
  Future<List<FeedComment>> loadComments(String postId);
  Future<FeedComment> addComment(String postId, String body);
  Future<bool> toggleRefeed(String postId, {required bool refeeded});
  Future<void> queueSave(String postId);
  Future<void> queueComment(String postId, String body);
  Future<void> queueRefeed(String postId);
  Future<void> queueShare(String postId);
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
