import 'package:flutter/material.dart';

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
    required this.isSaved,
    required this.onLike,
    required this.onComment,
    required this.onRefeed,
    required this.onSave,
    required this.onShare,
    this.onAvatar,
    this.onOpenDetail,
  });

  /// The post to render.
  final FeedPost post;

  /// Whether this card is the on-screen page; drives video autoplay.
  final bool isActive;

  final bool isLiked;
  final bool isSaved;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onSave;
  final VoidCallback onShare;

  /// Tapping the avatar in the action rail.
  final VoidCallback? onAvatar;

  /// Single-tap on a non-interactive area; opens the full post detail.
  final VoidCallback? onOpenDetail;

  @override
  State<ImmersivePostCard> createState() => _ImmersivePostCardState();
}

class _ImmersivePostCardState extends State<ImmersivePostCard>
    with SingleTickerProviderStateMixin {
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
        ).chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 45,
      ),
      TweenSequenceItem(tween: ConstantTween(1.15), weight: 25),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.15,
          end: 1.45,
        ).chain(CurveTween(curve: Curves.easeIn)),
        weight: 30,
      ),
    ]).animate(_burstController);
    _burstOpacity = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(
          begin: 0.0,
          end: 1.0,
        ).chain(CurveTween(curve: Curves.easeOut)),
        weight: 25,
      ),
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 40),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.0,
          end: 0.0,
        ).chain(CurveTween(curve: Curves.easeIn)),
        weight: 35,
      ),
    ]).animate(_burstController);

    // A soft ring that expands outward from the heart and fades — adds a
    // "pop" of energy without a second widget tree to manage.
    _ringScale = Tween(begin: 0.2, end: 1.9)
        .chain(CurveTween(curve: Curves.easeOutCubic))
        .animate(
          CurvedAnimation(
            parent: _burstController,
            curve: const Interval(0.0, 0.6),
          ),
        );
    _ringOpacity = Tween(begin: 0.55, end: 0.0)
        .chain(CurveTween(curve: Curves.easeOut))
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
    _burstController.forward(from: 0);
    widget.onLike();
  }

  // ----- Media resolution -------------------------------------------------

  String? get _primaryMediaType {
    final type = widget.post.mediaType;
    if (type != null && type.isNotEmpty) return type;
    final types = widget.post.mediaTypes;
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

    add(widget.post.mediaUrl);
    for (final url in widget.post.mediaUrls) {
      add(url);
    }
    return urls;
  }

  bool get _isVerified =>
      widget.post.postType?.toLowerCase().contains('verified') ?? false;

  // ----- Build ------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final bottomInset = media.padding.bottom;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onOpenDetail,
      child: ColoredBox(
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. Background media layer.
            Positioned.fill(child: _buildMedia()),

            // 2. The shared top scrim is drawn once by FeedScreen's overlay
            //    (above the pager), so the card omits its own to avoid the
            //    over-darkened "double scrim" at the top of the media.

            // 3. Bottom scrim for overlay legibility.
            const Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 320,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: FeedImmersiveTheme.bottomScrim,
                  ),
                ),
              ),
            ),

            // 4. Bottom-left text overlay.
            Positioned(
              left: 16,
              right: 78,
              bottom: 28 + bottomInset,
              child: _buildOverlay(context),
            ),

            // 5. Right action rail.
            Positioned(
              right: 8,
              bottom: 28 + bottomInset,
              child: FeedActionRail(
                likesCount: widget.post.likesCount,
                commentsCount: widget.post.commentsCount,
                refeedsCount: widget.post.refeedsCount,
                viewsCount: widget.post.viewsCount,
                isLiked: widget.isLiked,
                isSaved: widget.isSaved,
                avatarText: widget.post.authorName,
                avatarUrl: widget.post.avatarUrl,
                onLike: widget.onLike,
                onComment: widget.onComment,
                onRefeed: widget.onRefeed,
                onSave: widget.onSave,
                onShare: widget.onShare,
                onAvatar: widget.onAvatar,
              ),
            ),

            // 6. Double-tap heart burst.
            Positioned.fill(child: _buildHeartBurst()),
          ],
        ),
      ),
    );
  }

  Widget _buildMedia() {
    if (_isVideo) {
      final url =
          widget.post.mediaUrl ??
          (widget.post.mediaUrls.isNotEmpty
              ? widget.post.mediaUrls.first
              : null);
      return ImmersiveVideoPlayer(
        url: url,
        localPath: widget.post.localMediaPath,
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
          i == 0 ? widget.post.localMediaPath : null,
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
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: FeedImmersiveTheme.brandGradient,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 0, 88, 0),
          child: Center(
            child: Text(
              widget.post.body,
              textAlign: TextAlign.center,
              maxLines: 8,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                height: 1.25,
                fontWeight: FontWeight.w800,
                shadows: FeedImmersiveTheme.textShadow,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOverlay(BuildContext context) {
    final post = widget.post;
    final handle = post.meta.trim();
    final hasLocation = post.location?.trim().isNotEmpty ?? false;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Author row.
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
                Icons.verified,
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
          const SizedBox(height: 10),
          ExpandableCaption(
            text: post.body,
            collapsedLines: 2,
            linkColor: FeedImmersiveTheme.brandPink,
          ),
        ],

        // Meta row(s): location and audio.
        const SizedBox(height: 12),
        if (hasLocation) ...[
          _MetaRow(icon: Icons.place, label: post.location!.trim()),
          const SizedBox(height: 7),
        ],
        _MetaRow(
          icon: Icons.music_note,
          label: 'Original audio · ${post.authorName}',
        ),
      ],
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
                  child: Transform.scale(scale: _burstScale.value, child: child),
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

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 15,
          color: FeedImmersiveTheme.onMediaMuted,
          shadows: FeedImmersiveTheme.textShadow,
        ),
        const SizedBox(width: 7),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: FeedImmersiveTheme.metaLabel,
          ),
        ),
      ],
    );
  }
}
