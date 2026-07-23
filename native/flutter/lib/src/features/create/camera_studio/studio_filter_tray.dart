import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import 'studio_filters.dart';

/// Horizontally scrolling tray of filter presets, shown above the shutter.
/// Animates in/out and highlights the active preset.
class StudioFilterTray extends StatelessWidget {
  const StudioFilterTray({
    super.key,
    required this.visible,
    required this.selectedId,
    required this.onSelected,
    required this.onClose,
  });

  final bool visible;
  final String selectedId;
  final ValueChanged<StudioFilter> onSelected;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      offset: visible ? Offset.zero : const Offset(0, 0.4),
      duration: FeedImmersiveTheme.motionFast,
      curve: FeedImmersiveTheme.premiumSettleCurve,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: FeedImmersiveTheme.motionFast,
        child: IgnorePointer(
          ignoring: !visible,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusLg),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(
                  sigmaX: FeedImmersiveTheme.blurStrong,
                  sigmaY: FeedImmersiveTheme.blurStrong,
                ),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  decoration: BoxDecoration(
                    color: FeedImmersiveTheme.glassSurfaceStrong,
                    borderRadius:
                        BorderRadius.circular(FeedImmersiveTheme.radiusLg),
                    border: Border.all(color: FeedImmersiveTheme.glassBorder),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'PRO FILTERS',
                              style: TextStyle(
                                color: FeedImmersiveTheme.ink,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ),
                          GestureDetector(
                            onTap: onClose,
                            child: const Icon(
                              Icons.close_rounded,
                              size: 16,
                              color: FeedImmersiveTheme.inkMuted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 82,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: kStudioFilters.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 12),
                          itemBuilder: (context, i) {
                            final f = kStudioFilters[i];
                            return _FilterChip(
                              filter: f,
                              selected: f.id == selectedId,
                              onTap: () {
                                HapticFeedback.selectionClick();
                                onSelected(f);
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.filter,
    required this.selected,
    required this.onTap,
  });

  final StudioFilter filter;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final swatch = Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
        gradient: FeedImmersiveTheme.brandGradient,
        border: Border.all(
          color: selected
              ? FeedImmersiveTheme.brandPink
              : FeedImmersiveTheme.glassBorder,
          width: selected ? 2 : 1,
        ),
      ),
      child: Icon(
        filter.icon,
        color: FeedImmersiveTheme.onMedia,
        size: 20,
      ),
    );
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          filter.filter == null
              ? swatch
              : ColorFiltered(colorFilter: filter.filter!, child: swatch),
          const SizedBox(height: 5),
          Text(
            filter.name,
            style: TextStyle(
              color: selected
                  ? FeedImmersiveTheme.brandPink
                  : FeedImmersiveTheme.inkMuted,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
