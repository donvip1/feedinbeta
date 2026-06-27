import 'dart:io';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../create_tokens.dart';
import '../create_view_models.dart';

/// In-composer multi-media preview carousel.
///
/// Parity with the web `PostDetails` media block: a single fixed-aspect preview
/// when one item is selected, or a swipeable [PageView] with a counter badge,
/// navigation dots and prev/next arrows when several are selected. Each page
/// renders an image directly from disk, or a paused first-frame video preview
/// with a centered play glyph (lazily-built [VideoPlayerController], mirroring
/// the lifecycle guards in `immersive_video_player.dart`).
///
/// Purely presentational: it owns only the [PageController] (kept in sync with
/// [currentIndex]) and surfaces user intent through [onIndexChanged] /
/// [onRemove]. It never touches Supabase, a repo, or image_picker.
class ComposerMediaCarousel extends StatefulWidget {
  const ComposerMediaCarousel({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onIndexChanged,
    required this.onRemove,
  });

  /// Ordered selected media (images + videos) to preview.
  final List<ComposerMediaItem> items;

  /// Active page index (clamped into range for the controller).
  final int currentIndex;

  /// Emitted whenever the visible page changes (swipe or arrow tap).
  final ValueChanged<int> onIndexChanged;

  /// Remove the item with this [ComposerMediaItem.id].
  final ValueChanged<String> onRemove;

  @override
  State<ComposerMediaCarousel> createState() => _ComposerMediaCarouselState();
}

class _ComposerMediaCarouselState extends State<ComposerMediaCarousel> {
  /// Fixed preview height for the multi-item PageView (the single-item case uses
  /// a 4:3 AspectRatio instead).
  static const double _pageHeight = 320;

  late final PageController _pageController;

  int get _clampedIndex {
    if (widget.items.isEmpty) return 0;
    return widget.currentIndex.clamp(0, widget.items.length - 1);
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _clampedIndex);
  }

  @override
  void didUpdateWidget(covariant ComposerMediaCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Keep the controller's page aligned with the externally-driven index
    // (e.g. when the screen resets it after an item is removed).
    final target = _clampedIndex;
    if (_pageController.hasClients) {
      final current =
          _pageController.page?.round() ?? _pageController.initialPage;
      if (current != target) {
        _pageController.jumpToPage(target);
      }
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _animateTo(int index) {
    if (index < 0 || index >= widget.items.length) return;
    if (_pageController.hasClients) {
      _pageController.animateToPage(
        index,
        duration: CreateMotion.normal,
        curve: CreateMotion.emphasized,
      );
    }
    widget.onIndexChanged(index);
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    if (items.isEmpty) return const SizedBox.shrink();

    // Single item: a plain 4:3 preview with only the remove button.
    if (items.length == 1) {
      final item = items.first;
      return AspectRatio(
        aspectRatio: 4 / 3,
        child: ClipRRect(
          borderRadius: CreateRadii.card,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _MediaPage(item: item),
              _RemoveButton(onTap: () => widget.onRemove(item.id)),
            ],
          ),
        ),
      );
    }

    final index = _clampedIndex;
    return SizedBox(
      height: _pageHeight,
      child: Stack(
        children: [
          Positioned.fill(
            child: PageView.builder(
              controller: _pageController,
              itemCount: items.length,
              onPageChanged: widget.onIndexChanged,
              itemBuilder: (context, i) {
                final item = items[i];
                return ClipRRect(
                  borderRadius: CreateRadii.card,
                  child: _MediaPage(item: item),
                );
              },
            ),
          ),
          // Top-right close button removes the currently visible item.
          Positioned(
            top: CreateSpacing.sm,
            right: CreateSpacing.sm,
            child: _RemoveButton(onTap: () => widget.onRemove(items[index].id)),
          ),
          // Top-left 'i/N' counter badge.
          Positioned(
            top: CreateSpacing.sm,
            left: CreateSpacing.sm,
            child: _CounterBadge(current: index + 1, total: items.length),
          ),
          // Bottom-center navigation dots.
          Positioned(
            left: 0,
            right: 0,
            bottom: CreateSpacing.md,
            child: _NavigationDots(count: items.length, activeIndex: index),
          ),
          // Prev / next arrows.
          if (index > 0)
            Positioned(
              left: CreateSpacing.sm,
              top: 0,
              bottom: 0,
              child: Center(
                child: _ArrowButton(
                  icon: Icons.chevron_left,
                  onTap: () => _animateTo(index - 1),
                ),
              ),
            ),
          if (index < items.length - 1)
            Positioned(
              right: CreateSpacing.sm,
              top: 0,
              bottom: 0,
              child: Center(
                child: _ArrowButton(
                  icon: Icons.chevron_right,
                  onTap: () => _animateTo(index + 1),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Renders a single media item: an image straight from disk, or a paused
/// first-frame video preview.
class _MediaPage extends StatelessWidget {
  const _MediaPage({required this.item});

  final ComposerMediaItem item;

  @override
  Widget build(BuildContext context) {
    if (item.isVideo) {
      return _VideoPreviewTile(item: item);
    }
    return Image.file(
      File(item.previewPath),
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) => const _MediaFallback(),
    );
  }
}

/// Lazily builds a [VideoPlayerController] to show a video's paused first frame
/// with a centered play overlay. Falls back to the placeholder gradient + play
/// glyph on init failure or when there is no usable source.
///
/// Lifecycle mirrors `immersive_video_player.dart`: init guards, dispose on
/// teardown, and `mounted` / `identical` checks across awaits.
class _VideoPreviewTile extends StatefulWidget {
  const _VideoPreviewTile({required this.item});

  final ComposerMediaItem item;

  @override
  State<_VideoPreviewTile> createState() => _VideoPreviewTileState();
}

class _VideoPreviewTileState extends State<_VideoPreviewTile> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void didUpdateWidget(covariant _VideoPreviewTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Re-initialize when the underlying source changes.
    if (oldWidget.item.path != widget.item.path ||
        oldWidget.item.thumbnailPath != widget.item.thumbnailPath) {
      _disposeController();
      _failed = false;
      _isInitialized = false;
      _initialize();
    }
  }

  @override
  void dispose() {
    _disposeController();
    super.dispose();
  }

  void _disposeController() {
    final controller = _controller;
    if (controller != null) {
      controller.dispose();
    }
    _controller = null;
  }

  Future<void> _initialize() async {
    final path = widget.item.path;
    if (path.isEmpty || !File(path).existsSync()) {
      if (mounted) setState(() => _failed = true);
      return;
    }

    final controller = VideoPlayerController.file(File(path));
    _controller = controller;

    try {
      await controller.initialize();
      // Paused first frame: keep playback stopped at the start.
      await controller.setVolume(0);
      await controller.seekTo(Duration.zero);
      await controller.pause();
    } catch (_) {
      // Init failed (bad codec / unreadable file) -> show the placeholder.
      if (!mounted) {
        await controller.dispose();
      } else if (identical(_controller, controller)) {
        _controller = null;
        setState(() => _failed = true);
        await controller.dispose();
      } else {
        await controller.dispose();
      }
      return;
    }

    // Guard against teardown / re-init mid-await.
    if (!mounted || !identical(_controller, controller)) {
      await controller.dispose();
      return;
    }

    setState(() => _isInitialized = true);
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final ready = controller != null && _isInitialized && !_failed;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (ready)
          FittedBox(
            fit: BoxFit.cover,
            child: SizedBox(
              width: controller.value.size.width,
              height: controller.value.size.height,
              child: VideoPlayer(controller),
            ),
          )
        else
          const _MediaFallback(),
        // Dim the frame slightly so the play glyph reads on bright footage.
        const DecoratedBox(
          decoration: BoxDecoration(color: CreateColors.videoScrim),
        ),
        const Center(
          child: Icon(
            Icons.play_circle_fill,
            color: CreateColors.onMedia,
            size: 56,
          ),
        ),
        // Optional duration chip in the bottom-left for context.
        if (widget.item.durationLabel != null)
          Positioned(
            left: CreateSpacing.sm,
            bottom: CreateSpacing.sm,
            child: _DurationChip(label: widget.item.durationLabel!),
          ),
      ],
    );
  }
}

/// Neutral gradient placeholder with a play glyph, used when a video has no
/// thumbnail / fails to initialize. Never a blank/white tile.
class _MediaFallback extends StatelessWidget {
  const _MediaFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(gradient: CreateGradients.mediaPlaceholder),
      child: Center(
        child: Icon(
          Icons.play_circle_fill,
          color: CreateColors.whiteSoft,
          size: 56,
        ),
      ),
    );
  }
}

/// Filled circular close button (top-right) calling back to remove the item.
class _RemoveButton extends StatelessWidget {
  const _RemoveButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topRight,
      child: Padding(
        padding: const EdgeInsets.all(CreateSpacing.sm),
        child: Material(
          color: CreateColors.barrier,
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: const SizedBox(
              width: 32,
              height: 32,
              child: Icon(Icons.close, color: CreateColors.onMedia, size: 18),
            ),
          ),
        ),
      ),
    );
  }
}

/// 'i/N' pill counter shown top-left for multi-item carousels.
class _CounterBadge extends StatelessWidget {
  const _CounterBadge({required this.current, required this.total});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: CreateSpacing.sm,
        vertical: CreateSpacing.xs,
      ),
      decoration: const BoxDecoration(
        color: CreateColors.barrier,
        borderRadius: CreateRadii.chip,
      ),
      child: Text('$current/$total', style: CreateTextStyles.badge),
    );
  }
}

/// Bottom-center page-position dots; the active dot is widened and brand-colored.
class _NavigationDots extends StatelessWidget {
  const _NavigationDots({required this.count, required this.activeIndex});

  final int count;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: List<Widget>.generate(count, (i) {
        final isActive = i == activeIndex;
        return AnimatedContainer(
          duration: CreateMotion.fast,
          curve: CreateMotion.emphasized,
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: isActive ? 16 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: isActive ? CreateColors.primary : CreateColors.whiteSoft,
            borderRadius: const BorderRadius.all(Radius.circular(3)),
          ),
        );
      }),
    );
  }
}

/// Circular prev/next arrow over the media.
class _ArrowButton extends StatelessWidget {
  const _ArrowButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CreateColors.barrier,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(icon, color: CreateColors.onMedia, size: 24),
        ),
      ),
    );
  }
}

/// Small 'm:ss' duration chip for video previews.
class _DurationChip extends StatelessWidget {
  const _DurationChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: CreateSpacing.sm,
        vertical: 2,
      ),
      decoration: const BoxDecoration(
        color: CreateColors.barrier,
        borderRadius: CreateRadii.chip,
      ),
      child: Text(label, style: CreateTextStyles.durationChip),
    );
  }
}
