import 'package:flutter/material.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import 'studio_glass_button.dart';

/// Right-side creative tool rail: Beauty, Filters, and Timer — mirroring the
/// prototype's BeautyPlus-style tool column.
class StudioToolRail extends StatelessWidget {
  const StudioToolRail({
    super.key,
    required this.beautyOn,
    required this.filtersOpen,
    required this.timerSeconds,
    required this.onToggleBeauty,
    required this.onToggleFilters,
    required this.onCycleTimer,
  });

  final bool beautyOn;
  final bool filtersOpen;

  /// 0 = off, otherwise the countdown length in seconds.
  final int timerSeconds;

  final VoidCallback onToggleBeauty;
  final VoidCallback onToggleFilters;
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
          icon: Icons.filter_vintage_rounded,
          semanticLabel: 'Filters',
          caption: 'Filters',
          active: filtersOpen,
          accent: FeedImmersiveTheme.brandViolet,
          onTap: onToggleFilters,
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
