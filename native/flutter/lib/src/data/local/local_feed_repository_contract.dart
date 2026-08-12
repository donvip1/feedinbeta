import '../../features/feed/feed_item.dart';
import '../../features/feed/feed_post.dart';

abstract interface class LocalFeedRepositoryContract {
  Future<List<FeedPost>> loadPosts();
  Future<FeedRefreshResult> refresh();
  Future<FeedPaginationResult> loadMorePosts();

  /// Ranked, de-duplicated, ad-injected feed page from the server engine.
  /// Falls back to the reverse-chron [refresh]/[loadMorePosts] path (wrapped as
  /// [FeedPostItem]s) whenever the engine is unavailable, so the feed never
  /// breaks. [isNewSession] should be true only for the first page of a session.
  Future<FeedRankedResult> fetchRankedFeed({
    int limit = 20,
    int offset = 0,
    required String sessionId,
    required bool isNewSession,
  });

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

/// A page of ranked feed items (posts + injected ads). [usedEngine] is false
/// when the server engine was unavailable and the reverse-chron fallback was
/// used, so callers can decide whether to keep paginating via the engine.
class FeedRankedResult {
  const FeedRankedResult({
    required this.items,
    required this.hasMore,
    required this.usedEngine,
    this.message,
  });

  final List<FeedItem> items;
  final bool hasMore;
  final bool usedEngine;
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
