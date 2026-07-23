import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import 'caption_text.dart';
import 'feed_action_rail.dart';
import 'feed_immersive_theme.dart';
import 'immersive_video_player.dart';
import 'photo_carousel.dart';

/// A single full-screen TikTok-style social post.
///
/// Renders one [FeedPost] as a full-bleed [Stack]: background media (video,
/// photo carousel, or a gradient text card), legibility scrims, a bottom-left
/// text overlay, a right-hand action rail, and a double-tap heart burst.
class ImmersivePostCard extends StatefulWidget {
  const ImmersivePostCard({
    super.key,
    required this.post,
    required this.isActive,
    required this.isLiked,
    required this.isRefeeded,
    required this.isSaved,
    required this.onLike,
    required this.onComment,
    required this.onRefeed,
    required this.onSave,
    required this.onShare,
    this.onAvatar,
  });

  /// The post to render.
  final FeedPost post;

  /// Whether this card is the on-screen page; drives video autoplay.
  final bool isActive;

  final bool isLiked;
  final bool isRefeeded;
  final bool isSaved;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onSave;
  final VoidCallback onShare;

  /// Tapping the avatar in the action rail.
  final VoidCallback? onAvatar;

  @override
  State<ImmersivePostCard> createState() => _ImmersivePostCardState();
}

class _ImmersivePostCardState extends State<ImmersivePostCard>
    with SingleTickerProviderStateMixin {
  static const double _railWidth = FeedImmersiveTheme.postRailInset;
  static const double _contentInset =
      FeedImmersiveTheme.contentHorizontalPadding;

  late final AnimationController _burstController;
  late final Animation<double> _burstScale;
  late final Animation<double> _burstOpacity;
  late final Animation<double> _ringScale;
  late final Animation<double> _ringOpacity;

  @override
  void initState() {
    super.initState();
    _burstController = AnimationController(
      vsync: this,
      duration: FeedImmersiveTheme.motionBurst,
    );
    _burstScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(
          begin: 0.4,
          end: 1.15,
        ).chain(CurveTween(curve: FeedImmersiveTheme.popCurve)),
        weight: 45,
      ),
      TweenSequenceItem(tween: ConstantTween(1.15), weight: 25),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.15,
          end: 1.45,
        ).chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve)),
        weight: 30,
      ),
    ]).animate(_burstController);
    _burstOpacity = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(
          begin: 0.0,
          end: 1.0,
        ).chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve)),
        weight: 25,
      ),
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 40),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.0,
          end: 0.0,
        ).chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve)),
        weight: 35,
      ),
    ]).animate(_burstController);

    // A soft ring that expands outward from the heart and fades — adds a
    // "pop" of energy without a second widget tree to manage.
    _ringScale = Tween(begin: 0.2, end: 1.9)
        .chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve))
        .animate(
          CurvedAnimation(
            parent: _burstController,
            curve: const Interval(0.0, 0.6),
          ),
        );
    _ringOpacity = Tween(begin: 0.55, end: 0.0)
        .chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve))
        .animate(
          CurvedAnimation(
            parent: _burstController,
            curve: const Interval(0.0, 0.55),
          ),
        );
  }

  @override
  void dispose() {
    _burstController.dispose();
    super.dispose();
  }

  void _handleDoubleTapLike() {
    HapticFeedback.mediumImpact();
    _burstController.forward(from: 0);
    if (!widget.isLiked) widget.onLike();
  }

  // ----- Media resolution -------------------------------------------------

  FeedPost get _contentPost => widget.post.displayedPost;

  String? get _primaryMediaType {
    final type = _contentPost.mediaType;
    if (type != null && type.isNotEmpty) return type;
    final types = _contentPost.mediaTypes;
    return types.isNotEmpty ? types.first : null;
  }

  bool get _isVideo => _primaryMediaType == 'video';

  /// Non-empty image urls collected from [FeedPost.mediaUrl] and
  /// [FeedPost.mediaUrls], de-duplicated while preserving order.
  List<String> get _imageUrls {
    final seen = <String>{};
    final urls = <String>[];
    void add(String? value) {
      if (value == null) return;
      final trimmed = value.trim();
      if (trimmed.isEmpty) return;
      if (seen.add(trimmed)) urls.add(trimmed);
    }

    add(_contentPost.mediaUrl);
    for (final url in _contentPost.mediaUrls) {
      add(url);
    }
    return urls;
  }

  bool get _isVerified =>
      _contentPost.postType?.toLowerCase().contains('verified') ?? false;

  // ----- Build ------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final bottomInset = media.padding.bottom;

    return ColoredBox(
      color: FeedImmersiveTheme.mediaBackdrop,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Background media layer.
          Positioned.fill(child: RepaintBoundary(child: _buildMedia())),

          // 2. The shared top scrim is drawn once by FeedScreen's overlay
          //    (above the pager), so the card omits its own to avoid the
          //    over-darkened "double scrim" at the top of the media.

          // 3. Layered edge treatment: a vertical scrim protects captions and
          //    a restrained side vignette adds depth without blurring video.
          const Positioned.fill(child: _ReadabilityScrims()),

          // 4. Bottom-left text overlay.
          Positioned(
            left: _contentInset,
            right: _railWidth,
            bottom: FeedImmersiveTheme.overlayBottomPadding + bottomInset,
            child: _ActiveOverlayTransition(
              active: widget.isActive,
              child: _buildOverlay(context),
            ),
          ),

          // 5. Right action rail.
          Positioned(
            right: FeedImmersiveTheme.railRightInset,
            bottom: FeedImmersiveTheme.overlayBottomPadding + bottomInset,
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
                  avatarText: _contentPost.authorName,
                  avatarUrl: _contentPost.avatarUrl,
                  onLike: widget.onLike,
                  onComment: widget.onComment,
                  onRefeed: widget.onRefeed,
                  onSave: widget.onSave,
                  onShare: widget.onShare,
                  onAvatar: widget.onAvatar,
                ),
              ),
            ),
          ),

          // 6. Double-tap heart burst.
          Positioned.fill(child: _buildHeartBurst()),
        ],
      ),
    );
  }

  Widget _buildMedia() {
    if (_isVideo) {
      final url =
          _contentPost.mediaUrl ??
          (_contentPost.mediaUrls.isNotEmpty
              ? _contentPost.mediaUrls.first
              : null);
      return ImmersiveVideoPlayer(
        url: url,
        localPath: _contentPost.localMediaPath,
        isActive: widget.isActive,
        onDoubleTapLike: _handleDoubleTapLike,
      );
    }

    final imageUrls = _imageUrls;
    if (imageUrls.isNotEmpty) {
      // Parallel list of local paths: the post carries a single local media
      // path, so attach it to the first image and pad the rest with nulls.
      final localPaths = <String?>[
        for (var i = 0; i < imageUrls.length; i++)
          i == 0 ? _contentPost.localMediaPath : null,
      ];
      return PhotoCarousel(
        urls: imageUrls,
        localPaths: localPaths,
        onDoubleTapLike: _handleDoubleTapLike,
      );
    }

    return _buildTextBackground(context);
  }

  Widget _buildTextBackground(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onDoubleTap: _handleDoubleTapLike,
      child: Semantics(
        label: 'Text post by ${_contentPost.authorName}',
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [
                FeedImmersiveTheme.brandDeepPurple,
                FeedImmersiveTheme.brandPink,
                FeedImmersiveTheme.brandOrange,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(30, 0, 96, 0),
            child: Center(
              child: Text(
                _contentPost.body,
                textAlign: TextAlign.center,
                maxLines: 8,
                overflow: TextOverflow.ellipsis,
                style: FeedImmersiveTheme.textPost,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOverlay(BuildContext context) {
    final wrapper = widget.post;
    final post = _contentPost;
    final handle = post.meta.trim();
    final hasLocation = post.location?.trim().isNotEmpty ?? false;

    return Semantics(
      container: true,
      label: 'Post by ${post.authorName}',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (wrapper.originalPost != null) ...[
            _OverlayBadge(
              icon: Icons.repeat_rounded,
              label: '${wrapper.authorName} re-shared',
            ),
            const SizedBox(height: 10),
          ],
          // Creator identity gets the strongest typographic emphasis while the
          // handle stays quiet and never competes with the caption.
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  post.authorName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: FeedImmersiveTheme.authorName,
                ),
              ),
              if (_isVerified) ...[
                const SizedBox(width: 5),
                const Icon(
                  Icons.verified_rounded,
                  color: FeedImmersiveTheme.brandPink,
                  size: 16,
                  shadows: FeedImmersiveTheme.textShadow,
                ),
              ],
              if (handle.isNotEmpty) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    handle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: FeedImmersiveTheme.handle,
                  ),
                ),
              ],
            ],
          ),

          // Caption.
          if (post.body.trim().isNotEmpty) ...[
            const SizedBox(height: 9),
            ExpandableCaption(
              text: post.body,
              collapsedLines: 2,
              linkColor: FeedImmersiveTheme.brandPink,
            ),
          ],

          // Metadata is compact and pill-shaped so it reads as context, not a
          // second caption block.
          if (hasLocation) ...[
            const SizedBox(height: 11),
            _OverlayBadge(
              icon: Icons.place_rounded,
              label: post.location!.trim(),
            ),
          ],
          const SizedBox(height: 8),
          _OverlayBadge(
            icon: Icons.music_note_rounded,
            label: 'Original audio · ${post.authorName}',
          ),
        ],
      ),
    );
  }

  Widget _buildHeartBurst() {
    return IgnorePointer(
      child: Center(
        child: AnimatedBuilder(
          animation: _burstController,
          builder: (context, child) {
            if (_burstController.isDismissed) {
              return const SizedBox.shrink();
            }
            return Stack(
              alignment: Alignment.center,
              children: [
                // Expanding ring behind the heart.
                Opacity(
                  opacity: _ringOpacity.value.clamp(0.0, 1.0),
                  child: Transform.scale(
                    scale: _ringScale.value,
                    child: Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: FeedImmersiveTheme.likeActive,
                          width: 6,
                        ),
                      ),
                    ),
                  ),
                ),
                Opacity(
                  opacity: _burstOpacity.value.clamp(0.0, 1.0),
                  child: Transform.scale(
                    scale: _burstScale.value,
                    child: child,
                  ),
                ),
              ],
            );
          },
          child: const Icon(
            Icons.favorite,
            color: FeedImmersiveTheme.likeActive,
            size: 120,
            shadows: FeedImmersiveTheme.textShadow,
          ),
        ),
      ),
    );
  }
}

class _ReadabilityScrims extends StatelessWidget {
  const _ReadabilityScrims();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        fit: StackFit.expand,
        children: [
          const Align(
            alignment: Alignment.bottomCenter,
            child: SizedBox(
              width: double.infinity,
              height: FeedImmersiveTheme.overlayBottomHeight,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: FeedImmersiveTheme.bottomScrim,
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomLeft,
            child: Container(
              height: FeedImmersiveTheme.overlayVignetteHeight,
              width: FeedImmersiveTheme.overlayVignetteWidth,
              decoration: const BoxDecoration(
                gradient: FeedImmersiveTheme.sideScrim,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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

class _OverlayBadge extends StatelessWidget {
  const _OverlayBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: FeedImmersiveTheme.glassSurface,
        borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
        border: Border.all(color: FeedImmersiveTheme.glassBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: FeedImmersiveTheme.spacingSm + 1,
          vertical: FeedImmersiveTheme.spacingXs + 1,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: FeedImmersiveTheme.onMediaMuted,
              shadows: FeedImmersiveTheme.textShadow,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: FeedImmersiveTheme.metaLabel.copyWith(fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
