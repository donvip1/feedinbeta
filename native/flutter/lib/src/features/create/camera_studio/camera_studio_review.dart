import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import 'studio_glass_button.dart';

/// Post-capture review: shows the captured shot (photo with the active filter
/// baked into the preview, or a video placeholder) with Retake and a gradient
/// Next that continues into the existing composer.
class CameraStudioReview extends StatelessWidget {
  const CameraStudioReview({
    super.key,
    required this.file,
    required this.isVideo,
    required this.filter,
    required this.onNext,
  });

  final XFile file;
  final bool isVideo;
  final ColorFilter? filter;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          _preview(),
          const Positioned.fill(child: _ReviewScrims()),
          Align(
            alignment: Alignment.topLeft,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: StudioGlassButton(
                  icon: Icons.replay_rounded,
                  semanticLabel: 'Retake',
                  caption: 'Retake',
                  onTap: () => Navigator.of(context).maybePop(),
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Ready to share',
                        style: TextStyle(
                          color: FeedImmersiveTheme.ink,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                          shadows: FeedImmersiveTheme.textShadow,
                        ),
                      ),
                    ),
                    _NextButton(onTap: () {
                      HapticFeedback.selectionClick();
                      onNext();
                    }),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _preview() {
    if (isVideo) {
      return const ColoredBox(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.movie_creation_rounded,
                  color: FeedImmersiveTheme.inkMuted, size: 64),
              SizedBox(height: 12),
              Text(
                'Video captured',
                style: TextStyle(color: FeedImmersiveTheme.inkMuted),
              ),
            ],
          ),
        ),
      );
    }
    final image = Image.file(File(file.path), fit: BoxFit.cover);
    return filter == null
        ? image
        : ColorFiltered(colorFilter: filter!, child: image);
  }
}

class _ReviewScrims extends StatelessWidget {
  const _ReviewScrims();

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              FeedImmersiveTheme.overlayTopStrong,
              Colors.transparent,
              FeedImmersiveTheme.overlayBottomStrong,
            ],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
      ),
    );
  }
}

class _NextButton extends StatelessWidget {
  const _NextButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: FeedImmersiveTheme.createPillGradient,
        borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
        boxShadow: FeedImmersiveTheme.createPillGlow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
          onTap: onTap,
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 22, vertical: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Next',
                  style: TextStyle(
                    color: FeedImmersiveTheme.onMedia,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(width: 6),
                Icon(Icons.arrow_forward_rounded,
                    color: FeedImmersiveTheme.onMedia, size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
