import 'package:flutter/material.dart';

import '../create_tokens.dart';
import '../create_view_models.dart';

/// Drafts + upload-queue panel for the Create surface.
///
/// Fully presentational: it renders an immutable list of [UploadQueueItemView]
/// rows and surfaces per-row intent through [callbacks]. It NEVER touches a
/// repository, Supabase, or `image_picker` — the screen maps `PostDraft` /
/// `UploadQueueItem` records into the views and rebuilds this panel on every
/// change.
///
/// Layout (top -> bottom):
///   1. a section header ('Drafts and uploads') with an optional refresh action,
///   2. an optional aggregate [QueueSummaryView] banner (the post-process
///      result handed back from the queue service),
///   3. either the dashed empty-state card or one [_QueueRow] per item.
///
/// Per-row state comes straight from [UploadQueueItemView.status]
/// ([DraftStatus]) — the existing upload-queue service exposes no streaming
/// per-file progress, so the row shows pending / uploading / done states from
/// the draft's upload-state enum: a status pill, an indeterminate progress bar
/// while uploading (or a determinate one when [UploadQueueItemView.progress] is
/// non-null), and the contextual retry / cancel / queue / delete actions.
class UploadQueuePanel extends StatelessWidget {
  const UploadQueuePanel({
    super.key,
    required this.items,
    required this.callbacks,
    this.summary,
  });

  /// Ordered draft/queue rows (newest first is the screen's responsibility).
  final List<UploadQueueItemView> items;

  /// Bundle of per-row + refresh intents emitted back to the screen.
  final UploadQueueCallbacks callbacks;

  /// Optional aggregate banner mapped from the last `UploadQueueSummary`.
  final QueueSummaryView? summary;

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[
      _PanelHeader(onRefresh: callbacks.onRefresh),
      const SizedBox(height: CreateSpacing.sm),
    ];

    if (summary != null) {
      children.add(_SummaryBanner(summary: summary!));
      children.add(const SizedBox(height: CreateSpacing.md));
    }

    if (items.isEmpty) {
      children.add(const _EmptyQueueCard());
    } else {
      for (var i = 0; i < items.length; i++) {
        if (i > 0) children.add(const SizedBox(height: CreateSpacing.sm));
        children.add(_QueueRow(item: items[i], callbacks: callbacks));
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: children,
    );
  }
}

// ===========================================================================
// Header
// ===========================================================================

class _PanelHeader extends StatelessWidget {
  const _PanelHeader({this.onRefresh});

  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Text('Drafts and uploads', style: CreateTextStyles.title),
        ),
        if (onRefresh != null)
          IconButton(
            onPressed: onRefresh,
            tooltip: 'Refresh queue',
            icon: const Icon(
              Icons.refresh,
              color: CreateColors.mutedForeground,
            ),
          ),
      ],
    );
  }
}

// ===========================================================================
// Aggregate summary banner
// ===========================================================================

class _SummaryBanner extends StatelessWidget {
  const _SummaryBanner({required this.summary});

  final QueueSummaryView summary;

  @override
  Widget build(BuildContext context) {
    final isError = summary.isError;
    final background = isError
        ? const Color(0x1AEF4343) // destructive @ 10%
        : CreateColors.primaryFaint;
    final borderColor = isError
        ? const Color(0x66EF4343)
        : CreateColors.primarySoft;
    final foreground = isError ? CreateColors.destructive : CreateColors.primary;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: CreateSpacing.md,
        vertical: CreateSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: CreateRadii.field,
        border: Border.all(color: borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            size: 18,
            color: foreground,
          ),
          const SizedBox(width: CreateSpacing.sm),
          Expanded(
            child: Text(
              summary.message,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: foreground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// Empty state
// ===========================================================================

class _EmptyQueueCard extends StatelessWidget {
  const _EmptyQueueCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CreateSpacing.lg),
      decoration: BoxDecoration(
        color: CreateColors.card,
        borderRadius: CreateRadii.card,
        border: Border.all(color: CreateColors.border),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.post_add_outlined,
            color: CreateColors.primary,
          ),
          const SizedBox(width: CreateSpacing.md),
          Expanded(
            child: Text(
              'Drafts and queued uploads will appear here.',
              style: CreateTextStyles.helper,
            ),
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// Queue row
// ===========================================================================

/// One draft/queue card: leading media glyph, title + status chips, an
/// upload-progress bar while uploading, and the contextual trailing actions.
class _QueueRow extends StatelessWidget {
  const _QueueRow({required this.item, required this.callbacks});

  final UploadQueueItemView item;
  final UploadQueueCallbacks callbacks;

  IconData get _leadingIcon {
    switch (item.mediaType) {
      case 'video':
        return Icons.play_circle_outline;
      case 'image':
        return Icons.image_outlined;
      default:
        return Icons.notes;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CreateSpacing.md),
      decoration: BoxDecoration(
        color: CreateColors.card,
        borderRadius: CreateRadii.card,
        border: Border.all(color: CreateColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                _leadingIcon,
                size: 22,
                color: CreateColors.mutedForeground,
              ),
              const SizedBox(width: CreateSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: CreateTextStyles.uploadStatus,
                    ),
                    const SizedBox(height: CreateSpacing.xs),
                    _StatusChips(item: item),
                  ],
                ),
              ),
              _RowActions(item: item, callbacks: callbacks),
            ],
          ),
          if (item.isUploading) ...[
            const SizedBox(height: CreateSpacing.sm),
            _UploadProgressBar(progress: item.progress),
          ],
          if (item.isFailed && item.errorMessage != null) ...[
            const SizedBox(height: CreateSpacing.sm),
            Text(item.errorMessage!, style: CreateTextStyles.warning),
          ],
        ],
      ),
    );
  }
}

/// Status pill (+ optional media-type pill) row.
class _StatusChips extends StatelessWidget {
  const _StatusChips({required this.item});

  final UploadQueueItemView item;

  ({String label, Color color, IconData icon}) get _statusStyle {
    switch (item.status) {
      case DraftStatus.uploading:
        return (
          label: 'uploading',
          color: CreateColors.primary,
          icon: Icons.cloud_upload_outlined,
        );
      case DraftStatus.queued:
        return (
          label: 'queued',
          color: CreateColors.amberWarning,
          icon: Icons.schedule,
        );
      case DraftStatus.uploaded:
        return (
          label: 'done',
          color: CreateColors.success,
          icon: Icons.check_circle_outline,
        );
      case DraftStatus.failed:
        return (
          label: 'failed',
          color: CreateColors.destructive,
          icon: Icons.error_outline,
        );
      case DraftStatus.local:
        return (
          label: 'draft',
          color: CreateColors.mutedForeground,
          icon: Icons.edit_outlined,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = _statusStyle;
    return Wrap(
      spacing: CreateSpacing.xs,
      runSpacing: CreateSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _StatusPill(label: style.label, color: style.color, icon: style.icon),
        if (item.mediaType != null)
          _StatusPill(
            label: item.mediaType!,
            color: CreateColors.mutedForeground,
            icon: item.mediaType == 'video'
                ? Icons.videocam_outlined
                : Icons.photo_outlined,
          ),
        if (item.retryCount > 0)
          _StatusPill(
            label: 'retry x${item.retryCount}',
            color: CreateColors.mutedForeground,
            icon: Icons.replay,
          ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.color,
    required this.icon,
  });

  final String label;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: CreateSpacing.sm,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: CreateColors.muted,
        borderRadius: CreateRadii.chip,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: CreateSpacing.xs),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Indeterminate (or determinate when [progress] is known) brand-colored bar
/// shown while a row is uploading.
class _UploadProgressBar extends StatelessWidget {
  const _UploadProgressBar({this.progress});

  /// 0..100 — null renders an indeterminate bar (the service exposes no
  /// streaming progress, so this is typically null).
  final int? progress;

  @override
  Widget build(BuildContext context) {
    final value = progress == null ? null : (progress!.clamp(0, 100) / 100);
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(CreateRadii.pill),
            child: LinearProgressIndicator(
              value: value,
              minHeight: 4,
              backgroundColor: CreateColors.muted,
              valueColor: const AlwaysStoppedAnimation<Color>(
                CreateColors.primary,
              ),
            ),
          ),
        ),
        if (progress != null) ...[
          const SizedBox(width: CreateSpacing.sm),
          Text('$progress%', style: CreateTextStyles.uploadPercent),
        ],
      ],
    );
  }
}

/// Trailing contextual actions, mirroring the legacy screen's per-state set:
///   * queued     -> cancel (pause)
///   * failed     -> retry + delete
///   * uploaded   -> delete only
///   * local      -> queue + delete
///   * uploading  -> delete only (no toggling mid-flight)
class _RowActions extends StatelessWidget {
  const _RowActions({required this.item, required this.callbacks});

  final UploadQueueItemView item;
  final UploadQueueCallbacks callbacks;

  @override
  Widget build(BuildContext context) {
    final actions = <Widget>[];

    if (item.isQueued) {
      actions.add(
        _ActionButton(
          icon: Icons.pause_circle_outline,
          tooltip: 'Cancel upload',
          onTap: () => callbacks.onCancel(item.draftId),
        ),
      );
    } else if (item.isFailed) {
      actions.add(
        _ActionButton(
          icon: Icons.refresh,
          tooltip: 'Retry upload',
          color: CreateColors.primary,
          onTap: () => callbacks.onRetry(item.draftId),
        ),
      );
    } else if (item.isLocal) {
      actions.add(
        _ActionButton(
          icon: Icons.cloud_upload_outlined,
          tooltip: 'Queue upload',
          color: CreateColors.primary,
          onTap: () => callbacks.onQueue(item.draftId),
        ),
      );
    }

    actions.add(
      _ActionButton(
        icon: Icons.delete_outline,
        tooltip: 'Delete draft',
        onTap: () => callbacks.onDelete(item.draftId),
      ),
    );

    return Row(mainAxisSize: MainAxisSize.min, children: actions);
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.color = CreateColors.mutedForeground,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      visualDensity: VisualDensity.compact,
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(icon, size: 20, color: color),
    );
  }
}
