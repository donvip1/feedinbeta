import 'dart:io';

import 'package:flutter/material.dart';

import '../create_tokens.dart';
import '../create_view_models.dart';

/// Full-screen media gallery picker shell for the Create surface.
///
/// Ports the union of the web `MediaGalleryPicker` and `NativeGalleryPicker`
/// into a single STATELESS presentational widget. It owns no selection state and
/// performs no I/O — the screen owns `image_picker` and rebuilds [tray] on every
/// change, while this widget renders the current snapshot and emits intent via
/// the callbacks.
///
/// Layout (top to bottom):
///   * a fixed [CreateSpacing.headerHeight] header — close button, centered
///     title (from [MediaTrayView.config]), and a primary `Next (n)` action that
///     is enabled only when [MediaTrayView.canConfirm];
///   * an optional destructive inline banner when [MediaTrayView.errorMessage]
///     is non-null;
///   * the body, which is one of: a centered loading spinner, the dashed-border
///     empty state, or the selected-media grid + an `Add more` footer.
///
/// When [onCaptureMethod] is provided, the "add media" affordances route through
/// a private capture-method bottom sheet (Take Photo / Record Video / Photo
/// Library / Choose Video) instead of calling [onAddMore] directly; the screen
/// picks the behaviour by choosing whether to pass [onCaptureMethod].
///
/// Single-select configs ([MediaPickerConfig.allowMultiple] == false) never
/// render the tray or the `Add more` footer — the screen auto-confirms after a
/// single pick, so this widget only ever shows the loading / empty states for
/// those configs.
class MediaGalleryPickerSheet extends StatelessWidget {
  const MediaGalleryPickerSheet({
    super.key,
    required this.tray,
    required this.onAddMore,
    required this.onConfirm,
    required this.onClose,
    required this.onRemove,
    this.onReorder,
    this.onCaptureMethod,
  });

  /// Current picker snapshot (selected items, limits, loading & error flags).
  final MediaTrayView tray;

  /// Opens the gallery picker (or, when [onCaptureMethod] is null, is invoked
  /// directly by the empty-state / add-more affordances).
  final VoidCallback onAddMore;

  /// Confirms the current selection and advances to the composer.
  final VoidCallback onConfirm;

  /// Dismisses the whole picker.
  final VoidCallback onClose;

  /// Removes a selected item by its stable [ComposerMediaItem.id].
  final ValueChanged<String> onRemove;

  /// Optional drag-to-reorder hook for the selected-media grid.
  final void Function(int oldIndex, int newIndex)? onReorder;

  /// When provided, the add-media affordances open a capture-method chooser and
  /// emit the chosen [CaptureMethod] instead of calling [onAddMore].
  final ValueChanged<CaptureMethod>? onCaptureMethod;

  bool get _allowMultiple => tray.config.allowMultiple;

  /// Routes an "add media" tap either to the capture-method sheet (when the
  /// screen wired [onCaptureMethod]) or straight to [onAddMore].
  void _handleAdd(BuildContext context) {
    final captureCb = onCaptureMethod;
    if (captureCb == null) {
      onAddMore();
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: CreateColors.barrier,
      isScrollControlled: true,
      builder: (_) => _CaptureMethodSheet(
        acceptType: tray.config.acceptType,
        onMethod: (method) {
          Navigator.of(context).pop();
          captureCb(method);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CreateColors.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _PickerHeader(
              title: tray.config.title,
              count: tray.items.length,
              canConfirm: tray.canConfirm && _allowMultiple,
              onClose: onClose,
              onConfirm: onConfirm,
            ),
            if (tray.errorMessage != null)
              _ErrorBanner(message: tray.errorMessage!),
            Expanded(child: _buildBody(context)),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (tray.isLoading) {
      return const _MediaLoadingOverlay();
    }
    // Empty, OR a single-select config (which never shows the tray): show the
    // dashed empty state and let taps re-open the picker / capture sheet.
    if (tray.isEmpty || !_allowMultiple) {
      return _MediaPickerEmptyState(
        maxSelection: tray.config.maxSelection,
        allowMultiple: _allowMultiple,
        acceptType: tray.config.acceptType,
        onTap: () => _handleAdd(context),
      );
    }
    return _SelectedMediaGrid(
      items: tray.items,
      showAddMore: !tray.isAtLimit,
      addMoreLabel:
          'Add more (${tray.items.length}/${tray.config.maxSelection})',
      onRemove: onRemove,
      onReorder: onReorder,
      onAddMore: () => _handleAdd(context),
    );
  }
}

// ===========================================================================
// Header
// ===========================================================================

class _PickerHeader extends StatelessWidget {
  const _PickerHeader({
    required this.title,
    required this.count,
    required this.canConfirm,
    required this.onClose,
    required this.onConfirm,
  });

  final String title;
  final int count;
  final bool canConfirm;
  final VoidCallback onClose;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: CreateSpacing.headerHeight,
      padding: const EdgeInsets.symmetric(horizontal: CreateSpacing.sm),
      decoration: const BoxDecoration(
        color: CreateColors.background,
        border: Border(bottom: BorderSide(color: CreateColors.border)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: CreateSpacing.tapTarget,
            child: IconButton(
              onPressed: onClose,
              tooltip: 'Close',
              icon: const Icon(Icons.close, color: CreateColors.foreground),
              iconSize: 24,
              splashRadius: 22,
            ),
          ),
          Expanded(
            child: Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: CreateTextStyles.title,
            ),
          ),
          _NextButton(count: count, enabled: canConfirm, onConfirm: onConfirm),
        ],
      ),
    );
  }
}

class _NextButton extends StatelessWidget {
  const _NextButton({
    required this.count,
    required this.enabled,
    required this.onConfirm,
  });

  final int count;
  final bool enabled;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final label = count > 0 ? 'Next ($count)' : 'Next';
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 76),
      child: Align(
        alignment: Alignment.centerRight,
        child: Opacity(
          opacity: enabled ? 1 : 0.45,
          child: Material(
            color: Colors.transparent,
            borderRadius: CreateRadii.chip,
            child: InkWell(
              borderRadius: CreateRadii.chip,
              onTap: enabled ? onConfirm : null,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: enabled ? CreateGradients.primaryAction : null,
                  color: enabled ? null : CreateColors.muted,
                  borderRadius: CreateRadii.chip,
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: CreateSpacing.lg,
                    vertical: CreateSpacing.sm,
                  ),
                  child: Text(label, style: CreateTextStyles.pillLabelSelected),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ===========================================================================
// Error banner
// ===========================================================================

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(
        CreateSpacing.lg,
        CreateSpacing.md,
        CreateSpacing.lg,
        0,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: CreateSpacing.md,
        vertical: CreateSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: const Color(0x1AEF4343), // destructive @ 10%
        borderRadius: CreateRadii.field,
        border: Border.all(color: const Color(0x66EF4343)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.error_outline,
            size: 18,
            color: CreateColors.destructive,
          ),
          const SizedBox(width: CreateSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: CreateColors.destructive,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// Loading overlay
// ===========================================================================

class _MediaLoadingOverlay extends StatelessWidget {
  const _MediaLoadingOverlay();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: SizedBox(
        width: 32,
        height: 32,
        child: CircularProgressIndicator(
          strokeWidth: 2.5,
          valueColor: AlwaysStoppedAnimation<Color>(CreateColors.primary),
          backgroundColor: CreateColors.whiteFaint,
        ),
      ),
    );
  }
}

// ===========================================================================
// Empty state
// ===========================================================================

class _MediaPickerEmptyState extends StatelessWidget {
  const _MediaPickerEmptyState({
    required this.maxSelection,
    required this.allowMultiple,
    required this.acceptType,
    required this.onTap,
  });

  final int maxSelection;
  final bool allowMultiple;
  final MediaAcceptType acceptType;
  final VoidCallback onTap;

  String get _primaryLabel {
    switch (acceptType) {
      case MediaAcceptType.image:
        return 'Select Photos';
      case MediaAcceptType.video:
        return 'Select Videos';
      case MediaAcceptType.all:
        return 'Select Photos or Videos';
    }
  }

  String get _helperLabel {
    if (!allowMultiple) return 'Select one file';
    return 'Select up to $maxSelection files';
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CreateSpacing.xl),
        child: Material(
          color: Colors.transparent,
          borderRadius: CreateRadii.card,
          child: InkWell(
            borderRadius: CreateRadii.card,
            onTap: onTap,
            child: _DashedBorder(
              radius: CreateRadii.lg,
              color: CreateColors.border,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 48,
                  vertical: 48,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: CreateColors.primaryFaint,
                      ),
                      child: const Icon(
                        Icons.upload_outlined,
                        size: 32,
                        color: CreateColors.primary,
                      ),
                    ),
                    const SizedBox(height: CreateSpacing.lg),
                    Text(_primaryLabel, style: CreateTextStyles.title),
                    const SizedBox(height: CreateSpacing.xs),
                    Text(_helperLabel, style: CreateTextStyles.helper),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Lightweight dashed-rounded-rectangle border, drawn with a [CustomPaint] so we
/// don't pull in an external dashed-border package.
class _DashedBorder extends StatelessWidget {
  const _DashedBorder({
    required this.child,
    required this.radius,
    required this.color,
  });

  final Widget child;
  final double radius;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedBorderPainter(radius: radius, color: color),
      child: child,
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.radius, required this.color});

  final double radius;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);

    const dashWidth = 6.0;
    const dashGap = 5.0;
    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        final next = distance + dashWidth;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          paint,
        );
        distance = next + dashGap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter oldDelegate) =>
      oldDelegate.radius != radius || oldDelegate.color != color;
}

// ===========================================================================
// Selected-media grid (inlined so the picker is self-contained and renders the
// current tray without depending on an external sibling file)
// ===========================================================================

class _SelectedMediaGrid extends StatelessWidget {
  const _SelectedMediaGrid({
    required this.items,
    required this.showAddMore,
    required this.addMoreLabel,
    required this.onRemove,
    required this.onReorder,
    required this.onAddMore,
  });

  final List<ComposerMediaItem> items;
  final bool showAddMore;
  final String addMoreLabel;
  final ValueChanged<String> onRemove;
  final void Function(int oldIndex, int newIndex)? onReorder;
  final VoidCallback onAddMore;

  @override
  Widget build(BuildContext context) {
    final grid = GridView.builder(
      padding: const EdgeInsets.all(CreateSpacing.lg),
      physics: const BouncingScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: CreateSpacing.sm,
        crossAxisSpacing: CreateSpacing.sm,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _SelectedMediaTile(
          key: ValueKey(item.id),
          item: item,
          index: index,
          onRemove: () => onRemove(item.id),
          onReorderLeft: onReorder != null && index > 0
              ? () => onReorder!(index, index - 1)
              : null,
          onReorderRight: onReorder != null && index < items.length - 1
              ? () => onReorder!(index, index + 1)
              : null,
        );
      },
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: grid),
        if (showAddMore)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              CreateSpacing.lg,
              0,
              CreateSpacing.lg,
              CreateSpacing.lg,
            ),
            child: _AddMoreButton(label: addMoreLabel, onTap: onAddMore),
          ),
      ],
    );
  }
}

class _SelectedMediaTile extends StatelessWidget {
  const _SelectedMediaTile({
    super.key,
    required this.item,
    required this.index,
    required this.onRemove,
    this.onReorderLeft,
    this.onReorderRight,
  });

  final ComposerMediaItem item;
  final int index;
  final VoidCallback onRemove;
  final VoidCallback? onReorderLeft;
  final VoidCallback? onReorderRight;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: CreateRadii.tile,
      child: Stack(
        fit: StackFit.expand,
        children: [
          _MediaThumb(item: item),
          if (item.isVideo)
            const DecoratedBox(
              decoration: BoxDecoration(color: CreateColors.videoScrim),
              child: Center(
                child: Icon(
                  Icons.play_circle_fill,
                  size: 32,
                  color: CreateColors.onMedia,
                ),
              ),
            ),
          // Numbered selection badge.
          Positioned(
            top: CreateSpacing.sm,
            right: CreateSpacing.sm,
            child: Container(
              width: CreateSpacing.trayBadge,
              height: CreateSpacing.trayBadge,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: CreateGradients.primaryAction,
              ),
              alignment: Alignment.center,
              child: Text('${index + 1}', style: CreateTextStyles.badge),
            ),
          ),
          // Remove button.
          Positioned(
            top: CreateSpacing.sm,
            left: CreateSpacing.sm,
            child: _CircleIconButton(
              icon: Icons.close,
              onTap: onRemove,
              tooltip: 'Remove',
            ),
          ),
          // Duration chip.
          if (item.durationLabel != null)
            Positioned(
              bottom: CreateSpacing.sm,
              right: CreateSpacing.sm,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: CreateSpacing.sm,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: CreateColors.scrimStrong,
                  borderRadius: BorderRadius.circular(CreateRadii.sm),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.play_arrow,
                      size: 11,
                      color: CreateColors.onMedia,
                    ),
                    const SizedBox(width: 2),
                    Text(
                      item.durationLabel!,
                      style: CreateTextStyles.durationChip,
                    ),
                  ],
                ),
              ),
            ),
          // Reorder affordances (only when a reorder hook is wired).
          if (onReorderLeft != null || onReorderRight != null)
            Positioned(
              bottom: CreateSpacing.sm,
              left: CreateSpacing.sm,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (onReorderLeft != null)
                    _CircleIconButton(
                      icon: Icons.chevron_left,
                      onTap: onReorderLeft!,
                      tooltip: 'Move left',
                    ),
                  if (onReorderRight != null) ...[
                    const SizedBox(width: CreateSpacing.xs),
                    _CircleIconButton(
                      icon: Icons.chevron_right,
                      onTap: onReorderRight!,
                      tooltip: 'Move right',
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Renders the best available preview for a media item. Images load from the
/// local file path; videos use a generated thumbnail when present, else a
/// neutral gradient placeholder (the play glyph is overlaid by the tile).
class _MediaThumb extends StatelessWidget {
  const _MediaThumb({required this.item});

  final ComposerMediaItem item;

  @override
  Widget build(BuildContext context) {
    final source = item.isVideo ? item.thumbnailPath : item.previewPath;
    if (source == null || source.isEmpty) {
      return const DecoratedBox(
        decoration: BoxDecoration(gradient: CreateGradients.mediaPlaceholder),
      );
    }
    return Image.file(
      File(source),
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => const DecoratedBox(
        decoration: BoxDecoration(gradient: CreateGradients.mediaPlaceholder),
      ),
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.onTap,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final styled = Material(
      color: CreateColors.scrimStrong,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Icon(icon, size: 14, color: CreateColors.onMedia),
        ),
      ),
    );
    return tooltip != null ? Tooltip(message: tooltip!, child: styled) : styled;
  }
}

class _AddMoreButton extends StatelessWidget {
  const _AddMoreButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: CreateRadii.field,
      child: InkWell(
        borderRadius: CreateRadii.field,
        onTap: onTap,
        child: Container(
          height: CreateSpacing.tapTarget,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: CreateRadii.field,
            border: Border.all(color: CreateColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.add_photo_alternate_outlined,
                size: 18,
                color: CreateColors.primary,
              ),
              const SizedBox(width: CreateSpacing.sm),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: CreateColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ===========================================================================
// Capture-method chooser (bottom sheet)
// ===========================================================================

class _CaptureMethodSheet extends StatelessWidget {
  const _CaptureMethodSheet({required this.acceptType, required this.onMethod});

  final MediaAcceptType acceptType;
  final ValueChanged<CaptureMethod> onMethod;

  bool get _showImageRows => acceptType != MediaAcceptType.video;
  bool get _showVideoRows => acceptType != MediaAcceptType.image;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[
      if (_showImageRows)
        _CaptureRow(
          icon: Icons.photo_camera_outlined,
          label: 'Take Photo',
          onTap: () => onMethod(CaptureMethod.takePhoto),
        ),
      if (_showVideoRows)
        _CaptureRow(
          icon: Icons.videocam_outlined,
          label: 'Record Video',
          onTap: () => onMethod(CaptureMethod.recordVideo),
        ),
      if (_showImageRows)
        _CaptureRow(
          icon: Icons.photo_library_outlined,
          label: 'Photo Library',
          onTap: () => onMethod(CaptureMethod.photoLibrary),
        ),
      if (_showVideoRows)
        _CaptureRow(
          icon: Icons.video_library_outlined,
          label: 'Choose Video',
          onTap: () => onMethod(CaptureMethod.videoLibrary),
        ),
    ];

    return SafeArea(
      top: false,
      child: Container(
        decoration: const BoxDecoration(
          color: CreateColors.card,
          borderRadius: CreateRadii.sheetTop,
          boxShadow: CreateShadows.sheet,
        ),
        padding: const EdgeInsets.only(bottom: CreateSpacing.sm),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SheetGrabber(),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CreateSpacing.lg,
                CreateSpacing.sm,
                CreateSpacing.lg,
                CreateSpacing.sm,
              ),
              child: Text('Add Media', style: CreateTextStyles.sectionLabel),
            ),
            ...rows,
            const Divider(height: 1, color: CreateColors.border),
            _CaptureRow(
              icon: Icons.close,
              label: 'Cancel',
              isDestructive: false,
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetGrabber extends StatelessWidget {
  const _SheetGrabber();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.symmetric(vertical: CreateSpacing.md),
        decoration: BoxDecoration(
          color: CreateColors.whiteSoft,
          borderRadius: BorderRadius.circular(CreateRadii.pill),
        ),
      ),
    );
  }
}

class _CaptureRow extends StatelessWidget {
  const _CaptureRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isDestructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final color = isDestructive
        ? CreateColors.destructive
        : CreateColors.foreground;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: CreateSpacing.tapTarget),
          padding: const EdgeInsets.symmetric(
            horizontal: CreateSpacing.lg,
            vertical: CreateSpacing.md,
          ),
          child: Row(
            children: [
              Icon(icon, size: 22, color: color),
              const SizedBox(width: CreateSpacing.lg),
              Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
