import '../feed_post.dart';

/// Immutable interaction state for one Feed post.
///
/// The server-backed [FeedPost] remains the content model. This state contains
/// only values that may change while the viewer interacts with the post.
class PostState {
  const PostState({
    required this.postId,
    required this.isLiked,
    required this.isSaved,
    required this.isRefeeded,
    required this.likesCount,
    required this.commentsCount,
    required this.refeedsCount,
    this.isMoreExpanded = false,
    this.likeBusy = false,
    this.saveBusy = false,
    this.refeedBusy = false,
    this.statusMessage,
  });

  factory PostState.fromPost(FeedPost post) => PostState(
    postId: post.id,
    isLiked: post.viewerHasLiked,
    isSaved: post.viewerHasSaved,
    isRefeeded: post.viewerHasRefeeded,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    refeedsCount: post.refeedsCount,
  );

  final String postId;
  final bool isLiked;
  final bool isSaved;
  final bool isRefeeded;
  final int likesCount;
  final int commentsCount;
  final int refeedsCount;
  final bool isMoreExpanded;
  final bool likeBusy;
  final bool saveBusy;
  final bool refeedBusy;
  final String? statusMessage;

  PostState copyWith({
    bool? isLiked,
    bool? isSaved,
    bool? isRefeeded,
    int? likesCount,
    int? commentsCount,
    int? refeedsCount,
    bool? isMoreExpanded,
    bool? likeBusy,
    bool? saveBusy,
    bool? refeedBusy,
    String? statusMessage,
    bool clearStatusMessage = false,
  }) {
    return PostState(
      postId: postId,
      isLiked: isLiked ?? this.isLiked,
      isSaved: isSaved ?? this.isSaved,
      isRefeeded: isRefeeded ?? this.isRefeeded,
      likesCount: likesCount ?? this.likesCount,
      commentsCount: commentsCount ?? this.commentsCount,
      refeedsCount: refeedsCount ?? this.refeedsCount,
      isMoreExpanded: isMoreExpanded ?? this.isMoreExpanded,
      likeBusy: likeBusy ?? this.likeBusy,
      saveBusy: saveBusy ?? this.saveBusy,
      refeedBusy: refeedBusy ?? this.refeedBusy,
      statusMessage: clearStatusMessage
          ? null
          : statusMessage ?? this.statusMessage,
    );
  }

  FeedPost applyTo(FeedPost post) => post.copyWith(
    likesCount: likesCount,
    commentsCount: commentsCount,
    refeedsCount: refeedsCount,
    viewerHasLiked: isLiked,
    viewerHasSaved: isSaved,
    viewerHasRefeeded: isRefeeded,
  );
}
