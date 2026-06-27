import 'package:flutter/material.dart';

import 'feed_immersive_theme.dart';

/// The right-side vertical action rail for the immersive (TikTok-style) feed.
///
/// Mirrors the web `ImmersivePostCard` sidebar: a tappable avatar followed by
/// like / comment / refeed / save / share controls stacked vertically and
/// centered. All glyphs render white with [FeedImmersiveTheme.textShadow] for
/// legibility over arbitrary media; the like heart switches to
/// [FeedImmersiveTheme.likeActive] when active.
class FeedActionRail extends StatelessWidget {
  const FeedActionRail({
    super.key,
    required this.likesCount,
    required this.commentsCount,
    required this.refeedsCount,
    required this.isLiked,
    required this.isSaved,
    required this.avatarText,
    this.avatarUrl,
    required this.onLike,
    required this.onComment,
    required this.onRefeed,
    required this.onSave,
    required this.onShare,
    this.onAvatar,
  });

  final int likesCount;
  final int commentsCount;
  final int refeedsCount;
  final bool isLiked;
  final bool isSaved;
  final String avatarText;
  final String? avatarUrl;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onSave;
  final VoidCallback onShare;
  final VoidCallback? onAvatar;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _RailAvatar(
          avatarText: avatarText,
          avatarUrl: avatarUrl,
          onTap: onAvatar,
        ),
        const SizedBox(height: FeedImmersiveTheme.railGap),
        _RailButton(
          icon: isLiked ? Icons.favorite : Icons.favorite_border,
          color: isLiked ? FeedImmersiveTheme.likeActive : Colors.white,
          active: isLiked,
          iconSize: 32,
          label: _compactCount(likesCount),
          onTap: onLike,
        ),
        const SizedBox(height: FeedImmersiveTheme.railGap),
        _RailButton(
          icon: Icons.mode_comment_outlined,
          label: _compactCount(commentsCount),
          onTap: onComment,
        ),
        const SizedBox(height: FeedImmersiveTheme.railGap),
        _RailButton(
          icon: Icons.repeat,
          iconSize: 32,
          label: _compactCount(refeedsCount),
          onTap: onRefeed,
        ),
        const SizedBox(height: FeedImmersiveTheme.railGap),
        _RailButton(
          icon: isSaved ? Icons.bookmark : Icons.bookmark_border,
          color: isSaved ? FeedImmersiveTheme.saveActive : Colors.white,
          active: isSaved,
          label: 'Save',
          onTap: onSave,
        ),
        const SizedBox(height: FeedImmersiveTheme.railGap),
        _RailButton(icon: Icons.ios_share, label: 'Share', onTap: onShare),
      ],
    );
  }
}

/// Circular avatar at the top of the rail. Shows a network image when
/// [avatarUrl] is provided, otherwise a brand-gradient circle with the first
/// character of [avatarText]. A brand-gradient ring frames the avatar and a
/// small "+" follow badge overlaps the bottom-center. Presses scale down for
/// tactile feedback (mirrors `active:scale-95` in the web app).
class _RailAvatar extends StatefulWidget {
  const _RailAvatar({
    required this.avatarText,
    required this.avatarUrl,
    required this.onTap,
  });

  final String avatarText;
  final String? avatarUrl;
  final VoidCallback? onTap;

  @override
  State<_RailAvatar> createState() => _RailAvatarState();
}

class _RailAvatarState extends State<_RailAvatar> {
  bool _held = false;

  @override
  Widget build(BuildContext context) {
    const size = FeedImmersiveTheme.avatarSize;
    final url = widget.avatarUrl;
    final hasImage = url != null && url.isNotEmpty;

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _held = true),
      onTapUp: (_) => setState(() => _held = false),
      onTapCancel: () => setState(() => _held = false),
      child: AnimatedScale(
        scale: _held ? 0.92 : 1.0,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: SizedBox(
          // Extra height so the overlapping follow badge isn't clipped.
          width: size,
          height: size + 10,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              // Gradient ring framing the avatar.
              Container(
                width: size,
                height: size,
                padding: const EdgeInsets.all(2),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: FeedImmersiveTheme.brandGradient,
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x59000000),
                      blurRadius: 10,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.black, width: 1.5),
                    gradient: hasImage
                        ? null
                        : FeedImmersiveTheme.brandGradient,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: hasImage
                      ? Image.network(
                          url,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              _AvatarFallback(text: widget.avatarText),
                        )
                      : _AvatarFallback(text: widget.avatarText),
                ),
              ),
              Positioned(
                bottom: 0,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: FeedImmersiveTheme.brandGradient,
                    border: Border.all(color: Colors.white, width: 1.5),
                    boxShadow: const [
                      BoxShadow(color: Color(0x4D000000), blurRadius: 4),
                    ],
                  ),
                  child: const Icon(Icons.add, size: 14, color: Colors.white),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final trimmed = text.trim();
    final initial = trimmed.isEmpty
        ? '?'
        : trimmed.characters.first.toUpperCase();
    return DecoratedBox(
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: FeedImmersiveTheme.brandGradient,
      ),
      child: Center(
        child: Text(
          initial,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

/// A single icon + label entry in the action rail.
///
/// Provides three layered micro-interactions:
/// * a subtle press-in scale-down while the finger is held (`active:scale-95`
///   in the web app),
/// * a springy "pop" on release, and
/// * a one-shot thump + smooth color cross-fade when the control toggles to its
///   [active] state (like / save).
class _RailButton extends StatefulWidget {
  const _RailButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = Colors.white,
    this.iconSize = FeedImmersiveTheme.railIconSize,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;
  final double iconSize;

  /// Whether the control is in its highlighted state (liked / saved). Drives
  /// the color cross-fade and a one-shot pop when it flips to true.
  final bool active;

  @override
  State<_RailButton> createState() => _RailButtonState();
}

class _RailButtonState extends State<_RailButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _popController;
  late final Animation<double> _popScale;

  // Finger-held press state (cheap, rebuilds via AnimatedScale only).
  bool _held = false;

  @override
  void initState() {
    super.initState();
    _popController = AnimationController(
      vsync: this,
      duration: FeedImmersiveTheme.motionPop,
      reverseDuration: const Duration(milliseconds: 220),
    );
    _popScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: FeedImmersiveTheme.pressPopScale)
            .chain(CurveTween(curve: FeedImmersiveTheme.popCurve)),
        weight: 45,
      ),
      TweenSequenceItem(
        tween: Tween(begin: FeedImmersiveTheme.pressPopScale, end: 1.0)
            .chain(CurveTween(curve: Curves.easeOutCubic)),
        weight: 55,
      ),
    ]).animate(_popController);
  }

  @override
  void didUpdateWidget(covariant _RailButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Thump only on the off -> on transition so toggling off is calm.
    if (widget.active && !oldWidget.active) {
      _pop();
    }
  }

  @override
  void dispose() {
    _popController.dispose();
    super.dispose();
  }

  void _pop() => _popController.forward(from: 0);

  void _handleTap() {
    _pop();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _handleTap,
      onTapDown: (_) => setState(() => _held = true),
      onTapUp: (_) => setState(() => _held = false),
      onTapCancel: () => setState(() => _held = false),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedScale(
            scale: _held ? 0.9 : 1.0,
            duration: const Duration(milliseconds: 90),
            curve: Curves.easeOut,
            child: ScaleTransition(
              scale: _popScale,
              child: TweenAnimationBuilder<Color?>(
                duration: FeedImmersiveTheme.motionFast,
                curve: FeedImmersiveTheme.settleCurve,
                tween: ColorTween(end: widget.color),
                builder: (context, color, child) => Icon(
                  widget.icon,
                  size: widget.iconSize,
                  color: color ?? widget.color,
                  shadows: FeedImmersiveTheme.textShadow,
                ),
              ),
            ),
          ),
          const SizedBox(height: 5),
          Text(widget.label, style: FeedImmersiveTheme.countLabel),
        ],
      ),
    );
  }
}

/// Formats a count compactly (e.g. 1.2K, 3.4M). Returns "0" for non-positive.
String _compactCount(int value) {
  if (value <= 0) return '0';
  if (value >= 1000000) {
    return '${_trim(value / 1000000)}M';
  }
  if (value >= 1000) {
    return '${_trim(value / 1000)}K';
  }
  return value.toString();
}

/// Drops a trailing ".0" so 1.0K renders as "1K" while 1.2K stays "1.2K".
String _trim(double value) {
  final fixed = value.toStringAsFixed(1);
  return fixed.endsWith('.0') ? fixed.substring(0, fixed.length - 2) : fixed;
}
