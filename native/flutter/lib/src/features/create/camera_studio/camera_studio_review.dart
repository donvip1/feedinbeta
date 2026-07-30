import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import 'studio_filter_tray.dart';
import 'studio_filters.dart';
import 'studio_glass_button.dart';

/// Post-capture review. This is the one canonical Filter surface for Create.
class CameraStudioReview extends StatefulWidget {
  const CameraStudioReview({
    super.key,
    required this.file,
    required this.isVideo,
    required this.initialFilter,
    required this.onNext,
  });

  final XFile file;
  final bool isVideo;
  final StudioFilter initialFilter;
  final ValueChanged<StudioFilter> onNext;

  @override
  State<CameraStudioReview> createState() => _CameraStudioReviewState();
}

class _CameraStudioReviewState extends State<CameraStudioReview> {
  late StudioFilter _filter = widget.initialFilter;
  bool _filtersOpen = false;

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
            alignment: Alignment.topRight,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: StudioGlassButton(
                  key: const Key('review-filter-button'),
                  icon: Icons.filter_vintage_rounded,
                  semanticLabel: 'Filter',
                  caption: 'Filter',
                  active: _filtersOpen,
                  onTap: () => setState(() => _filtersOpen = !_filtersOpen),
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 92,
            child: StudioFilterTray(
              visible: _filtersOpen,
              selectedId: _filter.id,
              onSelected: (filter) => setState(() => _filter = filter),
              onClose: () => setState(() => _filtersOpen = false),
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
                    _NextButton(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        widget.onNext(_filter);
                      },
                    ),
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
    if (widget.isVideo) {
      return const ColoredBox(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.movie_creation_rounded,
                color: FeedImmersiveTheme.inkMuted,
                size: 64,
              ),
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
    final image = ColoredBox(
      color: Colors.black,
      child: Image.file(File(widget.file.path), fit: BoxFit.contain),
    );
    return _filter.filter == null
        ? image
        : ColorFiltered(colorFilter: _filter.filter!, child: image);
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
                Icon(
                  Icons.arrow_forward_rounded,
                  color: FeedImmersiveTheme.onMedia,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
