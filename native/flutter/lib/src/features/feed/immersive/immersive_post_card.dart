import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import '../state/feed_chrome_state_machine.dart';
import 'caption_layer.dart';
import 'feed_action_rail.dart';
import 'feed_immersive_theme.dart';
import 'gesture_layer.dart';
import 'gradient_overlay.dart';
import 'media_layer.dart';

/// A single full-screen TikTok-style social post.
///
/// This is the thin orchestrator that composes the immersive layers as a
/// full-bleed [Stack]: [MediaLayer] background, [ReadabilityScrims]
/// legibility treatment, the bottom-left [CaptionLayer], the right-hand
/// [FeedActionRail], and the double-tap [HeartBurst]. All state and
/// behavior live in the layers; this widget only wires callbacks and the
/// active-page transitions.
///
/// The two visibility groups [socialChromeVisible] and [fullChromeVisible]
/// are owned by the host pager; the card renders caption/rail in the
/// appropriate stage and adds `IgnorePointer` so hidden chrome cannot
/// intercept taps. The single-tap on the immersive surface is forwarded
/// to the host as a staged reveal gesture; double-tap still Likes.
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
    this.onOriginalPost,
    this.chromeState = FeedChromeVisibility.full,
  });

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

  /// Tapping the avatar opens the creator preview; tapping the name can
  /// route directly to the creator's full profile.
  final VoidCallback? onAvatar;
  final VoidCallback? onCreatorName;
  final VoidCallback? onOriginalPost;

  /// Visibility stage for the chrome around this post. The card decides
  /// which groups (caption, action rail) are interactive based on this
  /// value; the immersive surface tap is forwarded through [MediaLayer].
  final FeedChromeVisibility chromeState;

  @override
  State<ImmersivePostCard> createState() => _ImmersivePostCardState();
}

class _ImmersivePostCardState extends State<ImmersivePostCard> {
  static const double _railWidth = FeedImmersiveTheme.postRailInset;
  static const double _contentInset =
      FeedImmersiveTheme.contentHorizontalPadding;

  final HeartBurstController _burst = HeartBurstController();

  FeedPost get _contentPost => widget.post.displayedPost;

  /// Whether the right-side social action rail should be visible AND
  /// interactive for this post. In `hidden` it must not eat taps; in
  /// `socialOnly` and `full` it is interactive.
  bool get _socialChromeVisible =>
      widget.chromeState == FeedChromeVisibility.socialOnly ||
      widget.chromeState == FeedChromeVisibility.full;

  /// Caption only appears in the full chrome stage. Tap-to-reveal and
  /// hidden chrome never expose it.
  bool get _fullChromeVisible =>
      widget.chromeState == FeedChromeVisibility.full;

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
          // 1. Background media layer. Always visible — even when the
          //    chrome is hidden the user is still watching the video.
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

          // 4. Bottom-left text overlay. Only visible in the full chrome
          //    stage; hidden chrome never reveals it.
          Positioned(
            left: _contentInset,
            right: _railWidth,
            bottom: overlayBottom,
            child: _ChromeStageOverlay(
              visible: _fullChromeVisible,
              active: widget.isActive,
              child: CaptionLayer(
                post: widget.post,
                onCreatorTap: widget.onCreatorName ?? widget.onAvatar,
                onOriginalPostTap: widget.onOriginalPost,
              ),
            ),
          ),

          // 5. Right action rail. Visible + interactive in socialOnly
          //    and full; fully ignored (no opacity hit-test) in hidden.
          Positioned(
            right: FeedImmersiveTheme.railRightInset,
            bottom: overlayBottom,
            child: _ChromeStageOverlay(
              visible: _socialChromeVisible,
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

/// Animates a chrome group in/out as both the page becomes active AND
/// the chrome visibility stage wants it visible.
///
/// We combine [AnimatedSlide] + [AnimatedOpacity] with `IgnorePointer`
/// (not opacity alone) so a hidden widget cannot intercept taps. This
/// is the core defensive technique for the staged reveal: even when an
/// animation is mid-fade or the visibility flag is briefly wrong, taps
/// fall through to the immersive surface and trigger the next reveal
/// stage.
class _ChromeStageOverlay extends StatelessWidget {
  const _ChromeStageOverlay({
    required this.visible,
    required this.active,
    required this.child,
    this.offset = const Offset(0, 0.025),
  });

  final bool visible;
  final bool active;
  final Widget child;
  final Offset offset;

  @override
  Widget build(BuildContext context) {
    // Hide chrome when this post is not the active page (existing
    // behaviour) OR when the staged reveal hasn't reached this group.
    final show = visible && active;

    return IgnorePointer(
      ignoring: !show,
      child: AnimatedSlide(
        offset: show ? Offset.zero : offset,
        duration: FeedImmersiveTheme.motionMedium,
        curve: FeedImmersiveTheme.premiumSettleCurve,
        child: AnimatedOpacity(
          opacity: show
              ? FeedImmersiveTheme.opacityVisible
              : FeedImmersiveTheme.opacityHidden,
          duration: FeedImmersiveTheme.motionMedium,
          curve: FeedImmersiveTheme.premiumSettleCurve,
          child: child,
        ),
      ),
    );
  }
}
