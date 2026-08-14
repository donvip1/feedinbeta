import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';

/// Full-bleed horizontal carousel of photos for the immersive feed.
///
/// Mirrors the look of the React `PhotoPostSlide` (fullscreen image, page dots,
/// "1/3" counter pill) but uses native Flutter paging and graceful local-file
/// caching with network fallback.
class PhotoCarousel extends StatefulWidget {
  const PhotoCarousel({
    super.key,
    required this.urls,
    required this.localPaths,
    this.colorFilters = const [],
    this.onDoubleTapLike,
    this.onPhotoTap,
  });

  /// Remote image urls (each entry expected to be a non-empty string).
  final List<String> urls;

  /// Parallel list to [urls]; an entry may be a cached file path or null.
  final List<String?> localPaths;
  final List<ColorFilter?> colorFilters;

  /// Invoked on a double-tap anywhere over the photos (TikTok-style like).
  final VoidCallback? onDoubleTapLike;
  final ValueChanged<int>? onPhotoTap;

  @override
  State<PhotoCarousel> createState() => _PhotoCarouselState();
}

class _PhotoCarouselState extends State<PhotoCarousel> {
  late final PageController _controller;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String? _localPathFor(int index) {
    if (index < 0 || index >= widget.localPaths.length) return null;
    return widget.localPaths[index];
  }

  ColorFilter? _colorFilterFor(int index) {
    if (index < 0 || index >= widget.colorFilters.length) return null;
    return widget.colorFilters[index];
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.urls;
    final count = urls.length;
    final hasMultiple = count > 1;

    return GestureDetector(
      // Double-tap to like over the photos; single taps fall through to parent.
      onDoubleTap: widget.onDoubleTapLike,
      behavior: HitTestBehavior.opaque,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Dark backdrop so any letterboxing / loading reads as black, not white.
          const ColoredBox(color: FeedImmersiveTheme.mediaBackdrop),
          PageView.builder(
            controller: _controller,
            physics: hasMultiple
                ? const PageScrollPhysics()
                : const NeverScrollableScrollPhysics(),
            itemCount: count,
            onPageChanged: (index) {
              HapticFeedback.selectionClick();
              setState(() => _currentIndex = index);
            },
            itemBuilder: (context, index) {
              Widget image = GestureDetector(
                key: ValueKey('photo-carousel-page-$index'),
                behavior: HitTestBehavior.opaque,
                onTap: () => widget.onPhotoTap?.call(index),
                child: _CarouselImage(
                  url: urls[index],
                  localPath: _localPathFor(index),
                ),
              );
              final filter = _colorFilterFor(index);
              if (filter != null) {
                image = ColorFiltered(colorFilter: filter, child: image);
              }
              return image;
            },
          ),

          // Top-right "1/3" counter pill.
          if (hasMultiple)
            Positioned(
              top: FeedImmersiveTheme.spacingMd,
              right: FeedImmersiveTheme.spacingMd,
              child: _CounterPill(current: _currentIndex + 1, total: count),
            ),

          // Page dots, kept clear of the caption overlay that sits below.
          if (hasMultiple)
            Positioned(
              left: 0,
              right: 0,
              bottom: FeedImmersiveTheme.carouselIndicatorBottom,
              child: _PageDots(count: count, activeIndex: _currentIndex),
            ),
        ],
      ),
    );
  }
}

/// A single carousel image: prefers a valid local file, falls back to network,
/// and finally to a dark broken-image placeholder.
class _CarouselImage extends StatelessWidget {
  const _CarouselImage({required this.url, required this.localPath});

  final String url;
  final String? localPath;

  @override
  Widget build(BuildContext context) {
    final path = localPath;
    final hasLocalFile = path != null && File(path).existsSync();

    if (hasLocalFile) {
      return Image.file(
        File(path),
        fit: BoxFit.contain,
        width: double.infinity,
        height: double.infinity,
        errorBuilder: (context, error, stackTrace) => _networkImage(),
      );
    }

    return _networkImage();
  }

  Widget _networkImage() {
    return Image.network(
      url,
      fit: BoxFit.contain,
      width: double.infinity,
      height: double.infinity,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return const _PhotoPlaceholder();
      },
      errorBuilder: (context, error, stackTrace) => const _PhotoError(),
    );
  }
}

/// Subtle dark placeholder shown while a network image loads.
class _PhotoPlaceholder extends StatelessWidget {
  const _PhotoPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: FeedImmersiveTheme.mediaPlaceholder,
      child: Center(
        child: SizedBox(
          width: FeedImmersiveTheme.loadingIndicatorSm,
          height: FeedImmersiveTheme.loadingIndicatorSm,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(
              FeedImmersiveTheme.mediaGlyphMuted,
            ),
          ),
        ),
      ),
    );
  }
}

/// Dark box with a broken-image glyph when an image fails to load.
class _PhotoError extends StatelessWidget {
  const _PhotoError();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: FeedImmersiveTheme.mediaPlaceholder,
      child: const Center(
        child: Icon(
          Icons.broken_image_outlined,
          size: FeedImmersiveTheme.iconXl,
          color: FeedImmersiveTheme.mediaGlyphMuted,
        ),
      ),
    );
  }
}

/// Translucent "current/total" pill in the top-right corner.
class _CounterPill extends StatelessWidget {
  const _CounterPill({required this.current, required this.total});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: FeedImmersiveTheme.spacingSm + 2,
        vertical: FeedImmersiveTheme.spacingXs,
      ),
      decoration: BoxDecoration(
        color: FeedImmersiveTheme.glassSurfaceStrong,
        borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
        border: Border.all(color: FeedImmersiveTheme.glassBorder),
      ),
      child: Text(
        '$current/$total',
        style: FeedImmersiveTheme.chipLabel.copyWith(
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Row of page indicator dots; the active dot is wider and brand-colored.
class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.activeIndex});

  final int count;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (index) {
        final isActive = index == activeIndex;
        return AnimatedContainer(
          duration: FeedImmersiveTheme.motionCarousel,
          curve: FeedImmersiveTheme.premiumSettleCurve,
          margin: const EdgeInsets.symmetric(
            horizontal: FeedImmersiveTheme.spacingXs - 1,
          ),
          width: isActive
              ? FeedImmersiveTheme.carouselDotActiveWidth
              : FeedImmersiveTheme.carouselDotSize,
          height: FeedImmersiveTheme.carouselDotSize,
          decoration: BoxDecoration(
            color: isActive
                ? FeedImmersiveTheme.brandPink
                : FeedImmersiveTheme.indicatorInactive,
            borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
          ),
        );
      }),
    );
  }
}
