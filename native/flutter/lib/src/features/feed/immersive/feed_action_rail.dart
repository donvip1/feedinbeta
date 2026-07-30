import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';
import 'hero_transition_layer.dart';

/// Compact, inline-expandable actions for one immersive post.
///
/// Business state is supplied by the post-scoped Riverpod controller. This
/// widget owns only presentation, semantics, and touch feedback.
class FeedActionRail extends StatelessWidget {
  const FeedActionRail({
    super.key,
    required this.likesCount,
    required this.commentsCount,
    required this.refeedsCount,
    required this.viewsCount,
    required this.isLiked,
    required this.isRefeeded,
    required this.isSaved,
    required this.isMoreExpanded,
    required this.avatarText,
    this.avatarUrl,
    required this.onLike,
    required this.onComment,
    required this.onRefeed,
    required this.onMore,
    required this.onSave,
    required this.onGift,
    required this.onShare,
    this.onAvatar,
    this.avatarHeroTag,
  });

  final int likesCount;
  final int commentsCount;
  final int refeedsCount;
  final int viewsCount;
  final bool isLiked;
  final bool isRefeeded;
  final bool isSaved;
  final bool isMoreExpanded;
  final String avatarText;
  final String? avatarUrl;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onMore;
  final VoidCallback onSave;
  final VoidCallback onGift;
  final VoidCallback onShare;
  final VoidCallback? onAvatar;
  final Object? avatarHeroTag;

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
            _RailAvatar(
              avatarText: avatarText,
              avatarUrl: avatarUrl,
              onTap: onAvatar,
              heroTag: avatarHeroTag,
            ),
            const SizedBox(height: _gap),
            _RailAction(
              key: const Key('feed-action-like'),
              icon: isLiked ? Icons.favorite_rounded : Icons.favorite_border,
              iconColor: isLiked
                  ? FeedImmersiveTheme.likeActive
                  : FeedImmersiveTheme.onMedia,
              activeColor: isLiked ? FeedImmersiveTheme.likeChip : null,
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
              activeColor: isRefeeded ? FeedImmersiveTheme.refeedChip : null,
              active: isRefeeded,
              label: 'Refeed',
              value: _compactCount(refeedsCount),
              onTap: onRefeed,
            ),
            const SizedBox(height: _gap),
            _RailMetric(value: _compactCount(viewsCount)),
            if (isMoreExpanded)
              _ExpandedActions(
                isSaved: isSaved,
                onSave: onSave,
                onGift: onGift,
                onShare: onShare,
              ),
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
  const _ExpandedActions({
    required this.isSaved,
    required this.onSave,
    required this.onGift,
    required this.onShare,
  });

  final bool isSaved;
  final VoidCallback onSave;
  final VoidCallback onGift;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _RailAction(
          key: const Key('feed-action-save'),
          icon: isSaved ? Icons.bookmark_rounded : Icons.bookmark_border,
          iconColor: isSaved
              ? FeedImmersiveTheme.saveActive
              : FeedImmersiveTheme.onMedia,
          activeColor: isSaved ? FeedImmersiveTheme.saveChip : null,
          active: isSaved,
          label: 'Save',
          onTap: onSave,
        ),
        const SizedBox(height: FeedImmersiveTheme.railGap),
        _RailAction(
          key: const Key('feed-action-gift'),
          icon: Icons.card_giftcard_rounded,
          label: 'Gift',
          onTap: onGift,
        ),
        const SizedBox(height: FeedImmersiveTheme.railGap),
        _RailAction(
          key: const Key('feed-action-share'),
          icon: Icons.ios_share_rounded,
          label: 'Share',
          onTap: onShare,
        ),
      ],
    );
  }
}

class _RailAvatar extends StatefulWidget {
  const _RailAvatar({
    required this.avatarText,
    required this.avatarUrl,
    required this.onTap,
    this.heroTag,
  });

  final String avatarText;
  final String? avatarUrl;
  final VoidCallback? onTap;
  final Object? heroTag;

  @override
  State<_RailAvatar> createState() => _RailAvatarState();
}

class _RailAvatarState extends State<_RailAvatar> {
  bool _pressed = false;

  void _activate() {
    if (widget.onTap == null) return;
    HapticFeedback.selectionClick();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.avatarText.trim();
    final initial = name.isEmpty ? '?' : name.characters.first.toUpperCase();
    final hasImage = widget.avatarUrl?.trim().isNotEmpty == true;
    Widget surface = Container(
      width: FeedImmersiveTheme.avatarSize,
      height: FeedImmersiveTheme.avatarSize,
      padding: const EdgeInsets.all(2),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: FeedImmersiveTheme.brandGradient,
      ),
      child: ClipOval(
        child: hasImage
            ? Image.network(
                widget.avatarUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _AvatarFallback(initial),
              )
            : _AvatarFallback(initial),
      ),
    );
    if (widget.heroTag != null) {
      surface = CreatorAvatarHero(tag: widget.heroTag!, child: surface);
    }
    return Semantics(
      button: widget.onTap != null,
      label: 'Open ${name.isEmpty ? 'creator' : name} preview',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap == null ? null : _activate,
        onTapDown: widget.onTap == null
            ? null
            : (_) => setState(() => _pressed = true),
        onTapUp: widget.onTap == null
            ? null
            : (_) => setState(() => _pressed = false),
        onTapCancel: widget.onTap == null
            ? null
            : () => setState(() => _pressed = false),
        child: SizedBox(
          width: FeedImmersiveTheme.touchTargetMin,
          height: FeedImmersiveTheme.touchTargetMin,
          child: Center(
            child: AnimatedScale(
              scale: _pressed ? FeedImmersiveTheme.pressScale : 1,
              duration: FeedImmersiveTheme.motionPress,
              child: surface,
            ),
          ),
        ),
      ),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback(this.initial);

  final String initial;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      shape: BoxShape.circle,
      gradient: FeedImmersiveTheme.brandGradient,
    ),
    child: Center(
      child: Text(
        initial,
        style: const TextStyle(
          color: FeedImmersiveTheme.onMedia,
          fontSize: 16,
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
  );
}

class _RailAction extends StatefulWidget {
  const _RailAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.value,
    this.iconColor = FeedImmersiveTheme.onMedia,
    this.activeColor,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;
  final Color iconColor;
  final Color? activeColor;
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
                    child: _GlassActionSurface(
                      background: widget.active && widget.activeColor != null
                          ? widget.activeColor!
                          : FeedImmersiveTheme.railChip,
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

class _GlassActionSurface extends StatelessWidget {
  const _GlassActionSurface({
    required this.background,
    required this.icon,
    required this.iconColor,
  });

  final Color background;
  final IconData icon;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(
          sigmaX: FeedImmersiveTheme.blurControl,
          sigmaY: FeedImmersiveTheme.blurControl,
        ),
        child: AnimatedContainer(
          duration: FeedImmersiveTheme.motionFast,
          width: FeedImmersiveTheme.railChipSize,
          height: FeedImmersiveTheme.railChipSize,
          decoration: BoxDecoration(
            color: background,
            shape: BoxShape.circle,
            border: Border.all(color: FeedImmersiveTheme.glassBorder),
            boxShadow: FeedImmersiveTheme.controlShadow,
          ),
          child: AnimatedSwitcher(
            duration: FeedImmersiveTheme.motionPress,
            child: Icon(
              icon,
              key: ValueKey<IconData>(icon),
              size: FeedImmersiveTheme.railIconSize,
              color: iconColor,
              shadows: FeedImmersiveTheme.textShadow,
            ),
          ),
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
              child: _GlassActionSurface(
                background: FeedImmersiveTheme.railChip,
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
