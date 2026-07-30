import 'package:flutter/material.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import 'studio_glass_button.dart';

/// Right-side creative tool rail. Filters intentionally live only on the
/// post-capture review screen so Create exposes one unambiguous entry point.
class StudioToolRail extends StatelessWidget {
  const StudioToolRail({
    super.key,
    required this.beautyOn,
    required this.timerSeconds,
    required this.onToggleBeauty,
    required this.onCycleTimer,
  });

  final bool beautyOn;

  /// 0 = off, otherwise the countdown length in seconds.
  final int timerSeconds;

  final VoidCallback onToggleBeauty;
  final VoidCallback onCycleTimer;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        StudioGlassButton(
          icon: Icons.auto_fix_high_rounded,
          semanticLabel: 'Beauty enhance',
          caption: 'Beauty',
          active: beautyOn,
          onTap: onToggleBeauty,
        ),
        const SizedBox(height: 16),
        StudioGlassButton(
          icon: timerSeconds == 0
              ? Icons.timer_off_rounded
              : Icons.timer_rounded,
          semanticLabel: 'Timer',
          caption: timerSeconds == 0 ? 'Timer' : '${timerSeconds}s',
          active: timerSeconds != 0,
          accent: FeedImmersiveTheme.brandOrange,
          onTap: onCycleTimer,
        ),
      ],
    );
  }
}
