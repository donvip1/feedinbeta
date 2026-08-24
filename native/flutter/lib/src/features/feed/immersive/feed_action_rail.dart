import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';

/// Compact, inline-expandable actions for one immersive post.
///
/// Business state is supplied by the post-scoped Riverpod controller. This
/// widget owns only presentation, semantics, and touch feedback. Save and
/// Share are consolidated into one Share action that opens the share drawer
/// (Save lives inside the drawer); the icons sit on a transparent background.
class FeedActionRail extends StatelessWidget {
  const FeedActionRail({
    super.key,
    required this.likesCount,
    required this.commentsCount,
    required this.refeedsCount,
    required this.viewsCount,
    required this.isLiked,
    required this.isRefeeded,
    required this.isMoreExpanded,
    required this.onLike,
    required this.onComment,
    required this.onRefeed,
    required this.onMore,
    required this.onGift,
    required this.onShare,
  });

  final int likesCount;
  final int commentsCount;
  final int refeedsCount;
  final int viewsCount;
  final bool isLiked;
  final bool isRefeeded;
  final bool isMoreExpanded;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onMore;
  final VoidCallback onGift;
  final VoidCallback onShare;

  static const double _gap = FeedImmersiveTheme.railGap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Post actions',
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minWidth: FeedImmersiveTheme.railWidth,
          maxWidth: FeedImmersiveTheme.railMaxWidth,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _RailAction(
              key: const Key('feed-action-like'),
              icon: isLiked ? Icons.favorite_rounded : Icons.favorite_border,
              iconColor: isLiked
                  ? FeedImmersiveTheme.likeActive
                  : FeedImmersiveTheme.onMedia,
              active: isLiked,
              label: 'Like',
              value: _compactCount(likesCount),
              onTap: onLike,
            ),
            const SizedBox(height: _gap),
            _RailAction(
              key: const Key('feed-action-comment'),
              icon: Icons.mode_comment_outlined,
              label: 'Comment',
              value: _compactCount(commentsCount),
              onTap: onComment,
            ),
            const SizedBox(height: _gap),
            _RailAction(
              key: const Key('feed-action-refeed'),
              icon: Icons.repeat_rounded,
              iconColor: isRefeeded
                  ? FeedImmersiveTheme.refeedActive
                  : FeedImmersiveTheme.onMedia,
              active: isRefeeded,
              label: 'Refeed',
              value: _compactCount(refeedsCount),
              onTap: onRefeed,
            ),
            const SizedBox(height: _gap),
            // Gift is now a default action (it took the slot the Views metric
            // used to occupy). Views moved behind "More".
            _RailAction(
              key: const Key('feed-action-gift'),
              icon: Icons.card_giftcard_rounded,
              label: 'Gift',
              onTap: onGift,
            ),
            const SizedBox(height: _gap),
            // Save + Share are consolidated here: this opens the share drawer,
            // which contains Save alongside Story/Friends/Groups/Copy/Download.
            _RailAction(
              key: const Key('feed-action-share'),
              icon: Icons.ios_share_rounded,
              label: 'Share',
              onTap: onShare,
            ),
            if (isMoreExpanded) _ExpandedActions(viewsLabel: _compactCount(viewsCount)),
            const SizedBox(height: _gap),
            _RailAction(
              key: const Key('feed-action-more'),
              icon: isMoreExpanded
                  ? Icons.close_rounded
                  : Icons.more_horiz_rounded,
              label: isMoreExpanded ? 'Close more actions' : 'More',
              active: isMoreExpanded,
              onTap: onMore,
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpandedActions extends StatelessWidget {
  const _ExpandedActions({required this.viewsLabel});

  final String viewsLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: FeedImmersiveTheme.railGap),
        // Views: still available, just no longer a default-visible metric.
        _RailMetric(value: viewsLabel),
      ],
    );
  }
}

class _RailAction extends StatefulWidget {
  const _RailAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.value,
    this.iconColor = FeedImmersiveTheme.onMedia,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;
  final Color iconColor;
  final bool active;

  @override
  State<_RailAction> createState() => _RailActionState();
}

class _RailActionState extends State<_RailAction> {
  bool _pressed = false;

  void _activate() {
    HapticFeedback.selectionClick();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      value: widget.value,
      toggled: widget.active,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _activate,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: SizedBox(
          width: FeedImmersiveTheme.touchTargetMin,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: FeedImmersiveTheme.touchTargetMin,
                height: FeedImmersiveTheme.touchTargetMin,
                child: Center(
                  child: AnimatedScale(
                    scale: _pressed ? FeedImmersiveTheme.pressScale : 1,
                    duration: FeedImmersiveTheme.motionPress,
                    child: _RailGlyph(
                      icon: widget.icon,
                      iconColor: widget.iconColor,
                    ),
                  ),
                ),
              ),
              if (widget.value != null) ...[
                const SizedBox(height: 1),
                Text(
                  widget.value!,
                  maxLines: 1,
                  style: FeedImmersiveTheme.countLabel,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A bare action glyph on a transparent background. Legibility over media
/// comes from the icon's drop shadow rather than a filled chip, matching the
/// requested clutter-free styling.
class _RailGlyph extends StatelessWidget {
  const _RailGlyph({required this.icon, required this.iconColor});

  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: FeedImmersiveTheme.railChipSize,
      height: FeedImmersiveTheme.railChipSize,
      child: AnimatedSwitcher(
        duration: FeedImmersiveTheme.motionPress,
        child: Icon(
          icon,
          key: ValueKey<IconData>(icon),
          size: FeedImmersiveTheme.iconLg,
          color: iconColor,
          shadows: FeedImmersiveTheme.textShadow,
        ),
      ),
    );
  }
}

class _RailMetric extends StatelessWidget {
  const _RailMetric({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Views',
    value: value,
    child: SizedBox(
      width: FeedImmersiveTheme.touchTargetMin,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: FeedImmersiveTheme.touchTargetMin,
            height: FeedImmersiveTheme.touchTargetMin,
            child: Center(
              child: _RailGlyph(
                icon: Icons.visibility_outlined,
                iconColor: FeedImmersiveTheme.onMediaMuted,
              ),
            ),
          ),
          const SizedBox(height: 1),
          Text(value, style: FeedImmersiveTheme.countLabel),
        ],
      ),
    ),
  );
}

String _compactCount(int value) {
  if (value <= 0) return '0';
  if (value >= 1000000) return '${_trim(value / 1000000)}M';
  if (value >= 1000) return '${_trim(value / 1000)}K';
  return value.toString();
}

String _trim(double value) {
  final fixed = value.toStringAsFixed(1);
  return fixed.endsWith('.0') ? fixed.substring(0, fixed.length - 2) : fixed;
}
