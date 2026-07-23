import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../feed/immersive/feed_immersive_theme.dart';

/// Circular glass control used throughout the camera studio (top bar, tool
/// rail). Blurred translucent surface, press scale, haptic, optional active
/// (accent) state, and an optional caption beneath it.
class StudioGlassButton extends StatefulWidget {
  const StudioGlassButton({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticLabel,
    this.caption,
    this.active = false,
    this.accent,
    this.size = 44,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String semanticLabel;
  final String? caption;
  final bool active;
  final Color? accent;
  final double size;

  @override
  State<StudioGlassButton> createState() => _StudioGlassButtonState();
}

class _StudioGlassButtonState extends State<StudioGlassButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final accent = widget.accent ?? FeedImmersiveTheme.brandPink;
    final circle = AnimatedScale(
      scale: _pressed ? 0.9 : 1,
      duration: FeedImmersiveTheme.motionPress,
      curve: FeedImmersiveTheme.premiumSettleCurve,
      child: ClipOval(
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(
            sigmaX: FeedImmersiveTheme.blurControl,
            sigmaY: FeedImmersiveTheme.blurControl,
          ),
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: widget.active ? accent : FeedImmersiveTheme.railChip,
              border: Border.all(
                color: widget.active
                    ? accent
                    : FeedImmersiveTheme.glassBorder,
              ),
            ),
            child: Icon(
              widget.icon,
              size: widget.size * 0.42,
              color: FeedImmersiveTheme.onMedia,
              shadows: FeedImmersiveTheme.textShadow,
            ),
          ),
        ),
      ),
    );

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      toggled: widget.active,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            circle,
            if (widget.caption != null) ...[
              const SizedBox(height: 4),
              Text(
                widget.caption!,
                style: FeedImmersiveTheme.pillLabel.copyWith(
                  fontSize: 10,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
