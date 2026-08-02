import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/local/local_feed_repository_contract.dart';
import '../feed_post.dart';
import '../immersive/immersive_post_card.dart';
import '../state/feed_chrome_state_machine.dart';
import '../state/post_controller.dart';

/// Riverpod boundary for a single immersive Feed card.
///
/// The pager supplies stable content and navigation callbacks. Engagement and
/// More-menu changes are watched here, so they never rebuild the parent pager.
/// The Feed chrome visibility state (hidden / socialOnly / full) is passed
/// down from the pager and forwarded to the card so each layer can decide
/// whether it's currently interactive.
class PostControllerCard extends ConsumerStatefulWidget {
  const PostControllerCard({
    super.key,
    required this.post,
    required this.repository,
    required this.isActive,
    required this.onCommentRequested,
    required this.onRefeedRequested,
    required this.onShare,
    required this.onGift,
    this.onAvatar,
    this.onCreatorName,
    this.chromeState = FeedChromeVisibility.full,
    this.onSurfaceTap,
    this.onPlaybackChange,
  });

  final FeedPost post;
  final LocalFeedRepositoryContract repository;
  final bool isActive;
  final Future<void> Function(PostController controller) onCommentRequested;
  final Future<void> Function(PostController controller) onRefeedRequested;
  final VoidCallback onShare;
  final VoidCallback onGift;
  final VoidCallback? onAvatar;
  final VoidCallback? onCreatorName;

  /// Visibility stage for the Feed chrome around this card.
  final FeedChromeVisibility chromeState;

  /// Tap-forwarding callback so the pager can drive the chrome state
  /// machine from a single tap on the immersive surface.
  final void Function(FeedSurfaceTapIntent intent)? onSurfaceTap;

  /// Playback-state callback so the pager can arm/disarm the auto-hide
  /// timer when the video actually starts/stops playing.
  final void Function(bool isPlaying)? onPlaybackChange;

  @override
  ConsumerState<PostControllerCard> createState() => _PostControllerCardState();
}

class _PostControllerCardState extends ConsumerState<PostControllerCard> {
  late PostControllerArgs _args;

  @override
  void initState() {
    super.initState();
    _args = PostControllerArgs(
      post: widget.post,
      repository: widget.repository,
    );
  }

  @override
  void didUpdateWidget(covariant PostControllerCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.post.id != widget.post.id ||
        !identical(oldWidget.repository, widget.repository)) {
      _args = PostControllerArgs(
        post: widget.post,
        repository: widget.repository,
      );
      return;
    }
    if (oldWidget.post != widget.post) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ref.read(postControllerProvider(_args).notifier).reconcile(widget.post);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final postState = ref.watch(postControllerProvider(_args));
    final controller = ref.read(postControllerProvider(_args).notifier);
    final renderedPost = postState.applyTo(widget.post);

    return ImmersivePostCard(
      post: renderedPost,
      isActive: widget.isActive,
      isLiked: postState.isLiked,
      isRefeeded: postState.isRefeeded,
      isSaved: postState.isSaved,
      isMoreExpanded: postState.isMoreExpanded,
      onLike: () => unawaited(controller.toggleLike()),
      onComment: () {
        controller.collapseMore();
        unawaited(widget.onCommentRequested(controller));
      },
      onRefeed: () => unawaited(widget.onRefeedRequested(controller)),
      onSave: () => unawaited(controller.toggleSave()),
      onShare: () {
        controller.collapseMore();
        widget.onShare();
      },
      onMore: controller.toggleMore,
      onGift: () {
        controller.collapseMore();
        widget.onGift();
      },
      onAvatar: widget.onAvatar,
      onCreatorName: widget.onCreatorName,
      chromeState: widget.chromeState,
    );
  }
}