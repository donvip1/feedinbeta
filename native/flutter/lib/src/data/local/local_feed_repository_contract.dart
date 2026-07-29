import '../../features/feed/feed_post.dart';

abstract interface class LocalFeedRepositoryContract {
  Future<List<FeedPost>> loadPosts();
  Future<FeedRefreshResult> refresh();
  Future<FeedPaginationResult> loadMorePosts();
  Future<List<FeedPost>> loadPostsByUser(String userId);
  Future<List<FeedPost>> loadSavedPosts();
  Future<void> deletePost(String postId);
  Future<FeedSearchResults> search(String query, {int limit = 30});
  Future<List<LiveFeedItem>> loadLiveItems();
  Future<void> queueLike(String postId);
  Future<bool> toggleLike(String postId, {required bool liked});
  Future<bool> toggleSave(String postId, {required bool saved});
  Future<List<FeedComment>> loadComments(String postId);
  Future<FeedComment> addComment(
    String postId,
    String body, {
    String? parentCommentId,
  });
  Future<bool> toggleCommentLike(String commentId, {required bool liked});
  Future<void> deleteComment(String commentId);
  Future<bool> toggleRefeed(String postId, {required bool refeeded});
  Future<FeedPost> createQuoteRefeed(String postId, String quote);
  Future<void> queueSave(String postId);
  Future<void> queueComment(String postId, String body);
  Future<void> queueRefeed(String postId);
  Future<void> queueShare(String postId);
  Future<int> pendingActionCount();
}

class FeedSearchResults {
  const FeedSearchResults({
    this.posts = const <FeedPost>[],
    this.people = const <FeedSearchPerson>[],
    this.hashtags = const <FeedSearchHashtag>[],
  });

  final List<FeedPost> posts;
  final List<FeedSearchPerson> people;
  final List<FeedSearchHashtag> hashtags;

  bool get isEmpty => posts.isEmpty && people.isEmpty && hashtags.isEmpty;
}

class FeedSearchPerson {
  const FeedSearchPerson({
    required this.userId,
    required this.displayName,
    required this.handle,
    this.avatarUrl,
    this.bio,
  });

  final String userId;
  final String displayName;
  final String handle;
  final String? avatarUrl;
  final String? bio;
}

class FeedSearchHashtag {
  const FeedSearchHashtag({required this.tag, required this.postCount});

  final String tag;
  final int postCount;
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
