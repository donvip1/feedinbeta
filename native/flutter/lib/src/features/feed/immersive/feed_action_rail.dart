import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';

/// Premium vertical actions for an immersive post.
///
/// This widget is intentionally presentation-only. The callbacks and state
/// supplied by [ImmersivePostCard] remain the source of truth for all writes.
/// The rail owns only touch feedback, motion, semantics, and composition.
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
  final int viewsCount;
  final bool isLiked;
  final bool isRefeeded;
  final bool isSaved;
  final String avatarText;
  final String? avatarUrl;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onRefeed;
  final VoidCallback onSave;
  final VoidCallback onShare;
  final VoidCallback? onAvatar;

  static const double _actionSize = FeedImmersiveTheme.touchTargetAction;
  static const double _verticalGap = FeedImmersiveTheme.railGap;

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
            ),
            const SizedBox(height: _verticalGap + 5),
            _RailAction(
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
            const SizedBox(height: _verticalGap),
            _RailAction(
              icon: Icons.mode_comment_outlined,
              label: 'Comment',
              value: _compactCount(commentsCount),
              onTap: onComment,
            ),
            const SizedBox(height: _verticalGap),
            _RailAction(
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
            const SizedBox(height: _verticalGap),
            _RailAction(
              icon: Icons.ios_share_rounded,
              label: 'Share',
              onTap: onShare,
            ),
            const SizedBox(height: _verticalGap),
            _RailAction(
              icon: isSaved ? Icons.bookmark_rounded : Icons.bookmark_border,
              iconColor: isSaved
                  ? FeedImmersiveTheme.saveActive
                  : FeedImmersiveTheme.onMedia,
              activeColor: isSaved ? FeedImmersiveTheme.saveChip : null,
              active: isSaved,
              label: 'Bookmark',
              onTap: onSave,
            ),
            if (viewsCount > 0) ...[
              const SizedBox(height: _verticalGap),
              _RailMetric(label: 'Views', value: _compactCount(viewsCount)),
            ],
            const SizedBox(height: _verticalGap),
            const _AudioDisc(),
          ],
        ),
      ),
    );
  }
}

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
  bool _pressed = false;
  bool _hovered = false;
  bool _focused = false;

  void _activate() {
    if (widget.onTap == null) return;
    HapticFeedback.selectionClick();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    const size = FeedImmersiveTheme.avatarSize;
    final label = widget.onTap == null
        ? 'Profile picture of ${widget.avatarText}'
        : 'Open ${widget.avatarText} profile';

    return Semantics(
      button: widget.onTap != null,
      label: label,
      child: FocusableActionDetector(
        enabled: widget.onTap != null,
        mouseCursor: widget.onTap == null
            ? SystemMouseCursors.basic
            : SystemMouseCursors.click,
        onShowHoverHighlight: (value) => setState(() => _hovered = value),
        onShowFocusHighlight: (value) => setState(() => _focused = value),
        shortcuts: const <ShortcutActivator, Intent>{
          SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
          SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
        },
        actions: <Type, Action<Intent>>{
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              _activate();
              return null;
            },
          ),
        },
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
          child: AnimatedScale(
            scale: _pressed ? 0.92 : (_hovered || _focused ? 1.04 : 1),
            duration: FeedImmersiveTheme.motionFast,
            curve: FeedImmersiveTheme.premiumSettleCurve,
            child: SizedBox(
              width: size,
              height: size + 12,
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.topCenter,
                children: [
                  _AvatarSurface(
                    size: size,
                    url: widget.avatarUrl,
                    fallbackText: widget.avatarText,
                    emphasized: _hovered || _focused,
                  ),
                  Positioned(
                    bottom: 0,
                    child: ExcludeSemantics(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: FeedImmersiveTheme.brandGradient,
                          border: Border.all(
                            color: FeedImmersiveTheme.onMedia,
                            width: 1.5,
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: FeedImmersiveTheme.overlayControl,
                              blurRadius: 6,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const SizedBox(
                          width: 22,
                          height: 22,
                          child: Icon(Icons.add_rounded, size: 14),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AvatarSurface extends StatelessWidget {
  const _AvatarSurface({
    required this.size,
    required this.url,
    required this.fallbackText,
    required this.emphasized,
  });

  final double size;
  final String? url;
  final String fallbackText;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final hasImage = url?.trim().isNotEmpty == true;
    return AnimatedContainer(
      duration: FeedImmersiveTheme.motionFast,
      curve: FeedImmersiveTheme.premiumSettleCurve,
      width: size,
      height: size,
      padding: EdgeInsets.all(emphasized ? 2.5 : 2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: FeedImmersiveTheme.brandGradient,
        boxShadow: [
          BoxShadow(
            color: FeedImmersiveTheme.overlayBottomSoft,
            blurRadius: emphasized ? 16 : 10,
            offset: const Offset(0, 3),
          ),
          if (emphasized) ...FeedImmersiveTheme.brandGlow,
        ],
      ),
      child: ClipOval(
        child: hasImage
            ? Image.network(
                url!,
                fit: BoxFit.cover,
                filterQuality: FilterQuality.medium,
                errorBuilder: (_, _, _) => _AvatarFallback(text: fallbackText),
              )
            : _AvatarFallback(text: fallbackText),
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
            color: FeedImmersiveTheme.onMedia,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class _RailAction extends StatefulWidget {
  const _RailAction({
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

class _RailActionState extends State<_RailAction>
    with SingleTickerProviderStateMixin {
  late final AnimationController _popController;
  late final Animation<double> _popScale;
  bool _pressed = false;
  bool _hovered = false;
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _popController = AnimationController(
      vsync: this,
      duration: FeedImmersiveTheme.motionPop,
    );
    _popScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(
          begin: 1.0,
          end: 1.14,
        ).chain(CurveTween(curve: FeedImmersiveTheme.popCurve)),
        weight: 42,
      ),
      TweenSequenceItem(
        tween: Tween(
          begin: 1.14,
          end: 1.0,
        ).chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve)),
        weight: 58,
      ),
    ]).animate(_popController);
  }

  @override
  void didUpdateWidget(covariant _RailAction oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) _pop();
  }

  @override
  void dispose() {
    _popController.dispose();
    super.dispose();
  }

  void _pop() => _popController.forward(from: 0);

  void _activate() {
    HapticFeedback.selectionClick();
    _pop();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final highlighted = _hovered || _focused;
    final background = widget.active && widget.activeColor != null
        ? widget.activeColor!
        : FeedImmersiveTheme.railChip;
    final semanticValue = widget.value == null
        ? null
        : '${widget.value} ${widget.label.toLowerCase()}';

    return Semantics(
      button: true,
      label: widget.label,
      value: semanticValue,
      toggled: widget.active,
      hint: 'Double tap to activate',
      child: FocusableActionDetector(
        mouseCursor: SystemMouseCursors.click,
        onShowHoverHighlight: (value) => setState(() => _hovered = value),
        onShowFocusHighlight: (value) => setState(() => _focused = value),
        shortcuts: const <ShortcutActivator, Intent>{
          SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
          SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
        },
        actions: <Type, Action<Intent>>{
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              _activate();
              return null;
            },
          ),
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _activate,
          onTapDown: (_) => setState(() => _pressed = true),
          onTapUp: (_) => setState(() => _pressed = false),
          onTapCancel: () => setState(() => _pressed = false),
          child: SizedBox(
            width: _RailActionSize.width,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedScale(
                  scale: _pressed ? 0.91 : (highlighted ? 1.04 : 1),
                  duration: FeedImmersiveTheme.motionPress,
                  curve: FeedImmersiveTheme.premiumSettleCurve,
                  child: ScaleTransition(
                    scale: _popScale,
                    child: _GlassActionSurface(
                      background: background,
                      highlighted: highlighted,
                      icon: widget.icon,
                      iconColor: widget.iconColor,
                    ),
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  widget.value ?? widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: FeedImmersiveTheme.countLabel.copyWith(
                    color: highlighted
                        ? Colors.white
                        : FeedImmersiveTheme.onMedia,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RailActionSize {
  const _RailActionSize._();

  static const double width = FeedImmersiveTheme.railWidth;
}

class _GlassActionSurface extends StatelessWidget {
  const _GlassActionSurface({
    required this.background,
    required this.highlighted,
    required this.icon,
    required this.iconColor,
  });

  final Color background;
  final bool highlighted;
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
          curve: FeedImmersiveTheme.premiumSettleCurve,
          width: _RailActionSize.width,
          height: FeedActionRail._actionSize,
          decoration: BoxDecoration(
            color: background,
            shape: BoxShape.circle,
            border: Border.all(
              color: highlighted
                  ? FeedImmersiveTheme.glassFocusBorder
                  : FeedImmersiveTheme.glassBorder,
              width: highlighted ? 1.2 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: FeedImmersiveTheme.overlayControl,
                blurRadius: highlighted ? 14 : 9,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Center(
            child: AnimatedSwitcher(
              duration: FeedImmersiveTheme.motionPress,
              switchInCurve: FeedImmersiveTheme.popCurve,
              switchOutCurve: FeedImmersiveTheme.sheetReverseCurve,
              transitionBuilder: (child, animation) => ScaleTransition(
                scale: animation,
                child: FadeTransition(opacity: animation, child: child),
              ),
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
      ),
    );
  }
}

class _RailMetric extends StatelessWidget {
  const _RailMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: label,
      value: value,
      child: SizedBox(
        width: _RailActionSize.width,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _GlassActionSurface(
              background: FeedImmersiveTheme.railChip,
              highlighted: false,
              icon: Icons.visibility_outlined,
              iconColor: FeedImmersiveTheme.onMediaMuted,
            ),
            const SizedBox(height: 5),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: FeedImmersiveTheme.countLabel.copyWith(
                color: FeedImmersiveTheme.onMediaMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A compact non-interactive record that gives the rail a recognizable audio
/// endpoint without inventing a new business callback.
class _AudioDisc extends StatelessWidget {
  const _AudioDisc();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Original audio',
      child: SizedBox(
        width: _RailActionSize.width,
        height: _RailActionSize.width,
        child: Center(
          child: Container(
            width: FeedImmersiveTheme.audioDiscSize,
            height: FeedImmersiveTheme.audioDiscSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: FeedImmersiveTheme.audioDiscGradient,
              boxShadow: const [
                BoxShadow(
                  color: FeedImmersiveTheme.overlayControl,
                  blurRadius: 10,
                  offset: Offset(0, 3),
                ),
              ],
            ),
            padding: const EdgeInsets.all(FeedImmersiveTheme.audioDiscInset),
            child: DecoratedBox(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: FeedImmersiveTheme.audioDiscSurface,
              ),
              child: const Icon(
                Icons.music_note_rounded,
                size: FeedImmersiveTheme.iconSm,
                color: FeedImmersiveTheme.onMedia,
              ),
            ),
          ),
        ),
      ),
    );
  }
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
