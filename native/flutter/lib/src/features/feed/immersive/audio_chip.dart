import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';

/// Glass audio pill shown in the post overlay: a softly pulsing pink music note
/// beside the track name, mirroring the prototype's `animate-pulse` music icon.
///
/// The pulse is confined to the icon (wrapped in a [RepaintBoundary]) so it
/// never repaints the caption or media beneath it. Optional [onTap] lets a host
/// present audio-track details without this widget owning any business logic.
class AudioChip extends StatefulWidget {
  const AudioChip({super.key, required this.label, this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  State<AudioChip> createState() => _AudioChipState();
}

class _AudioChipState extends State<AudioChip>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: FeedImmersiveTheme.motionLivePulse,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final interactive = widget.onTap != null;
    final pill = AnimatedScale(
      scale: _pressed ? 0.96 : 1,
      duration: FeedImmersiveTheme.motionPress,
      curve: FeedImmersiveTheme.premiumSettleCurve,
      child: DecoratedBox(
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
              RepaintBoundary(
                child: AnimatedBuilder(
                  animation: _pulse,
                  builder: (context, child) {
                    final t = Curves.easeInOut.transform(_pulse.value);
                    return Opacity(
                      opacity: 0.62 + (0.38 * t),
                      child: Transform.scale(scale: 0.88 + (0.12 * t), child: child),
                    );
                  },
                  child: const Icon(
                    Icons.music_note_rounded,
                    size: 14,
                    color: FeedImmersiveTheme.brandPink,
                    shadows: FeedImmersiveTheme.textShadow,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  widget.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: FeedImmersiveTheme.metaLabel.copyWith(fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (!interactive) {
      return Semantics(container: true, label: widget.label, child: pill);
    }
    return Semantics(
      button: true,
      label: 'Audio: ${widget.label}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap!();
        },
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: pill,
      ),
    );
  }
}
