import 'package:flutter/material.dart';

import 'feed_immersive_theme.dart';

/// Layered legibility treatment drawn over immersive media.
///
/// A vertical bottom scrim protects the caption/author overlay and a restrained
/// bottom-left vignette adds depth without blurring the video. Extracted from
/// [ImmersivePostCard] so the same scrim system can be reused by any full-bleed
/// media surface (feed card, creator preview, story viewer).
///
/// Presentation-only and const-friendly; wrap in [IgnorePointer] internally so
/// it never intercepts gestures meant for the media beneath it.
class ReadabilityScrims extends StatelessWidget {
  const ReadabilityScrims({super.key});

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: Stack(
        fit: StackFit.expand,
        children: [
          Align(
            alignment: Alignment.bottomCenter,
            child: SizedBox(
              width: double.infinity,
              height: FeedImmersiveTheme.overlayBottomHeight,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: FeedImmersiveTheme.bottomScrim,
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomLeft,
            child: SizedBox(
              height: FeedImmersiveTheme.overlayVignetteHeight,
              width: FeedImmersiveTheme.overlayVignetteWidth,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: FeedImmersiveTheme.sideScrim,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
