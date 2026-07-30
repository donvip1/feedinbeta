import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import 'caption_layer.dart';
import 'feed_action_rail.dart';
import 'feed_immersive_theme.dart';
import 'gesture_layer.dart';
import 'gradient_overlay.dart';
import 'media_layer.dart';

/// A single full-screen TikTok-style social post.
///
/// This is the thin orchestrator that composes the immersive layers as a
/// full-bleed [Stack]: [MediaLayer] background, [ReadabilityScrims] legibility
/// treatment, the bottom-left [CaptionLayer], the right-hand [FeedActionRail],
/// and the double-tap [HeartBurst]. All state and behavior live in the layers;
/// this widget only wires callbacks and the active-page transitions.
class ImmersivePostCard extends StatefulWidget {
  const ImmersivePostCard({
    super.key,
    required this.post,
    required this.isActive,
    required this.isLiked,
    required this.isRefeeded,
    required this.isSaved,
    this.isMoreExpanded = false,
    required this.onLike,
    required this.onComment,
    required this.onRefeed,
    required this.onSave,
    required this.onShare,
    required this.onMore,
    required this.onGift,
    this.onAvatar,
    this.onCreatorName,
  });

  /// The post to render.
  final FeedPost post;

  /// Whether this card is the on-screen page; drives video autoplay.
  final bool isActive;

  final bool isLiked;
  final bool isRefeeded;
  final bool isSaved;
  final bool isMoreExpanded;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onSave;
  final VoidCallback onShare;
  final VoidCallback onMore;
  final VoidCallback onGift;

  /// Tapping the avatar opens the creator preview; tapping the name can route
  /// directly to the creator's full profile.
  final VoidCallback? onAvatar;
  final VoidCallback? onCreatorName;

  @override
  State<ImmersivePostCard> createState() => _ImmersivePostCardState();
}

class _ImmersivePostCardState extends State<ImmersivePostCard> {
  static const double _railWidth = FeedImmersiveTheme.postRailInset;
  static const double _contentInset =
      FeedImmersiveTheme.contentHorizontalPadding;

  final HeartBurstController _burst = HeartBurstController();

  FeedPost get _contentPost => widget.post.displayedPost;

  void _handleDoubleTapLike() {
    HapticFeedback.mediumImpact();
    _burst.fire();
    if (!widget.isLiked) widget.onLike();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final overlayBottom = FeedImmersiveTheme.overlayBottomPadding + bottomInset;

    return ColoredBox(
      color: FeedImmersiveTheme.mediaBackdrop,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Background media layer.
          Positioned.fill(
            child: RepaintBoundary(
              child: MediaLayer(
                post: _contentPost,
                isActive: widget.isActive,
                onDoubleTapLike: _handleDoubleTapLike,
              ),
            ),
          ),

          // 2. The shared top scrim is drawn once by FeedScreen's overlay
          //    (above the pager), so the card omits its own to avoid the
          //    over-darkened "double scrim" at the top of the media.

          // 3. Layered edge treatment protecting the caption/rail.
          const Positioned.fill(child: ReadabilityScrims()),

          // 4. Bottom-left text overlay.
          Positioned(
            left: _contentInset,
            right: _railWidth,
            bottom: overlayBottom,
            child: _ActiveOverlayTransition(
              active: widget.isActive,
              child: CaptionLayer(
                post: widget.post,
                onCreatorTap: widget.onCreatorName ?? widget.onAvatar,
              ),
            ),
          ),

          // 5. Right action rail.
          Positioned(
            right: FeedImmersiveTheme.railRightInset,
            bottom: overlayBottom,
            child: _ActiveOverlayTransition(
              active: widget.isActive,
              offset: const Offset(0.04, 0),
              child: RepaintBoundary(
                child: FeedActionRail(
                  likesCount: widget.post.likesCount,
                  commentsCount: widget.post.commentsCount,
                  refeedsCount: widget.post.refeedsCount,
                  viewsCount: widget.post.viewsCount,
                  isLiked: widget.isLiked,
                  isRefeeded: widget.isRefeeded,
                  isSaved: widget.isSaved,
                  isMoreExpanded: widget.isMoreExpanded,
                  avatarText: _contentPost.authorName,
                  avatarUrl: _contentPost.avatarUrl,
                  onLike: widget.onLike,
                  onComment: widget.onComment,
                  onRefeed: widget.onRefeed,
                  onMore: widget.onMore,
                  onSave: widget.onSave,
                  onGift: widget.onGift,
                  onShare: widget.onShare,
                  onAvatar: widget.onAvatar,
                  avatarHeroTag: 'creator-avatar-${widget.post.id}',
                ),
              ),
            ),
          ),

          // 6. Double-tap heart burst.
          Positioned.fill(child: HeartBurst(controller: _burst)),
        ],
      ),
    );
  }
}

/// Slides + fades the overlays in as their page settles into view, so inactive
/// neighbours read as quietly recessed.
class _ActiveOverlayTransition extends StatelessWidget {
  const _ActiveOverlayTransition({
    required this.active,
    required this.child,
    this.offset = const Offset(0, 0.025),
  });

  final bool active;
  final Widget child;
  final Offset offset;

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      offset: active ? Offset.zero : offset,
      duration: FeedImmersiveTheme.motionMedium,
      curve: FeedImmersiveTheme.premiumSettleCurve,
      child: AnimatedOpacity(
        opacity: active
            ? FeedImmersiveTheme.opacityVisible
            : FeedImmersiveTheme.opacityInactive,
        duration: FeedImmersiveTheme.motionMedium,
        curve: FeedImmersiveTheme.premiumSettleCurve,
        child: child,
      ),
    );
  }
}
