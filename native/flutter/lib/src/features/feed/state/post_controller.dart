import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/local/local_feed_repository_contract.dart';
import '../feed_post.dart';
import 'post_state.dart';

class PostControllerArgs {
  const PostControllerArgs({required this.post, required this.repository});

  final FeedPost post;
  final LocalFeedRepositoryContract repository;

  String get postId => post.id;

  @override
  bool operator ==(Object other) =>
      other is PostControllerArgs &&
      other.postId == postId &&
      identical(other.repository, repository);

  @override
  int get hashCode => Object.hash(postId, identityHashCode(repository));
}

final postControllerProvider =
    NotifierProviderFamily<PostController, PostState, PostControllerArgs>(
      PostController.new,
    );

/// Granular optimistic state for a single post.
///
/// Each command snapshots the exact pre-command state, applies immediately,
/// and restores that snapshot if the repository rejects the mutation.
class PostController extends FamilyNotifier<PostState, PostControllerArgs> {
  @override
  PostState build(PostControllerArgs args) {
    return PostState.fromPost(args.post);
  }

  bool get isRefeeded => state.isRefeeded;

  void toggleMore() {
    state = state.copyWith(
      isMoreExpanded: !state.isMoreExpanded,
      clearStatusMessage: true,
    );
  }

  void collapseMore() {
    if (!state.isMoreExpanded) return;
    state = state.copyWith(isMoreExpanded: false);
  }

  Future<void> toggleLike() async {
    if (state.likeBusy) return;
    final before = state;
    final wasLiked = before.isLiked;
    state = before.copyWith(
      isLiked: !wasLiked,
      likesCount: _nonNegative(before.likesCount + (wasLiked ? -1 : 1)),
      likeBusy: true,
      clearStatusMessage: true,
    );
    try {
      final confirmed = await arg.repository.toggleLike(
        arg.postId,
        liked: wasLiked,
      );
      state = state.copyWith(isLiked: confirmed, likeBusy: false);
    } catch (_) {
      state = before.copyWith(statusMessage: 'Could not update the like.');
    }
  }

  Future<void> toggleSave() async {
    if (state.saveBusy) return;
    final before = state;
    final wasSaved = before.isSaved;
    state = before.copyWith(
      isSaved: !wasSaved,
      saveBusy: true,
      clearStatusMessage: true,
    );
    try {
      final confirmed = await arg.repository.toggleSave(
        arg.postId,
        saved: wasSaved,
      );
      state = state.copyWith(
        isSaved: confirmed,
        saveBusy: false,
        statusMessage: confirmed ? 'Post saved.' : 'Post removed from saved.',
      );
    } catch (_) {
      state = before.copyWith(statusMessage: 'Could not update saved posts.');
    }
  }

  Future<void> toggleRefeed() async {
    if (state.refeedBusy) return;
    final before = state;
    final wasRefeeded = before.isRefeeded;
    state = before.copyWith(
      isRefeeded: !wasRefeeded,
      refeedsCount: _nonNegative(before.refeedsCount + (wasRefeeded ? -1 : 1)),
      refeedBusy: true,
      clearStatusMessage: true,
    );
    try {
      final confirmed = await arg.repository.toggleRefeed(
        arg.postId,
        refeeded: wasRefeeded,
      );
      state = state.copyWith(
        isRefeeded: confirmed,
        refeedBusy: false,
        statusMessage: confirmed ? 'Refeeded to your feed.' : 'Refeed removed.',
      );
    } catch (_) {
      state = before.copyWith(statusMessage: 'Could not update this Refeed.');
    }
  }

  void incrementCommentCount() {
    adjustCommentCount(1);
  }

  void decrementCommentCount() {
    adjustCommentCount(-1);
  }

  void adjustCommentCount(int delta) {
    state = state.copyWith(
      commentsCount: _nonNegative(state.commentsCount + delta),
    );
  }

  void recordQuoteRefeed() {
    state = state.copyWith(
      refeedsCount: state.refeedsCount + 1,
      statusMessage: 'Quote shared to your feed.',
    );
  }

  /// Reconcile a fresh server snapshot without replacing a newer optimistic
  /// operation that is still in flight.
  void reconcile(FeedPost post) {
    if (post.id != arg.postId) return;
    state = state.copyWith(
      isLiked: state.likeBusy ? null : post.viewerHasLiked,
      likesCount: state.likeBusy ? null : post.likesCount,
      isSaved: state.saveBusy ? null : post.viewerHasSaved,
      isRefeeded: state.refeedBusy ? null : post.viewerHasRefeeded,
      refeedsCount: state.refeedBusy ? null : post.refeedsCount,
      commentsCount: post.commentsCount,
    );
  }
}

int _nonNegative(int value) => value < 0 ? 0 : value;
