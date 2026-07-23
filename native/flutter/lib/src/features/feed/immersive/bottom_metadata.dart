import 'package:flutter/material.dart';

import 'feed_immersive_theme.dart';

/// Compact, pill-shaped glass chip for a single line of post metadata
/// (re-share attribution, location, audio, …).
///
/// Reads as contextual chrome rather than a second caption block: a small muted
/// icon, one line of truncating text, on a translucent glass surface. Extracted
/// from [ImmersivePostCard] as the shared `OverlayBadge` so every overlay row
/// stays visually identical.
class OverlayBadge extends StatelessWidget {
  const OverlayBadge({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
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
            Icon(
              icon,
              size: 14,
              color: FeedImmersiveTheme.onMediaMuted,
              shadows: FeedImmersiveTheme.textShadow,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: FeedImmersiveTheme.metaLabel.copyWith(fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
