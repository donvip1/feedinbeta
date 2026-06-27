/// A single typed notification row for the Notifications inbox/history.
///
/// Port of `src/components/notifications/NotificationItem.tsx`. Handles BOTH
/// the standard notification card and the inline friend-request
/// Accept/Decline variant in one widget; the variant is selected from
/// [NotificationCardViewModel.kind] + [NotificationCardViewModel.isRead].
///
/// Pure presentational: it renders a view-model and emits [onTap], [onDelete],
/// [onAccept] and [onDecline] only. It never resolves routes, marks read, or
/// touches Supabase / repositories — the host wires those behind the callbacks.
///
/// Web parity reference:
///   - src/components/notifications/NotificationItem.tsx
///
/// Styling comes exclusively from the screen-local tokens in
/// `notifications_tokens.dart`; types come from `notifications_view_models.dart`.
library;

import 'package:flutter/material.dart';

import '../notifications_tokens.dart';
import '../notifications_view_models.dart';

/// One typed notification row (standard or inline friend-request variant).
///
/// LAYOUT (port of the web `p-4 flex items-start gap-3` row):
///   [leading avatar+type-badge stack] [title/message/timestamp/(actions)]
///   [trailing delete-X / spinner + unread dot]
///
/// STATES:
///   - read vs unread: tinted background, title weight, and trailing unread dot
///   - deleting: the delete X is replaced by a small spinner
///   - friend-request inline: when [NotificationKind.isFriendRequest] && unread
///     && [onAccept] != null, Accept/Decline buttons render under the timestamp
class NotificationCard extends StatelessWidget {
  const NotificationCard({
    super.key,
    required this.viewModel,
    required this.onTap,
    this.onDelete,
    this.onAccept,
    this.onDecline,
  });

  /// The fully-resolved notification to render.
  final NotificationCardViewModel viewModel;

  /// Tapping the row (host marks read + deep-links / opens celebration).
  final VoidCallback onTap;

  /// Per-row delete. When null, the trailing delete affordance is omitted.
  final VoidCallback? onDelete;

  /// Accept a pending friend request (inline variant only). When null, the
  /// inline Accept/Decline buttons are not rendered.
  final VoidCallback? onAccept;

  /// Decline a pending friend request (inline variant only).
  final VoidCallback? onDecline;

  /// Maps the presentational [NotificationKind] onto the token-layer
  /// [NotificationKindToken] (identical names + order -> 1:1 by index).
  NotificationKindToken get _kindToken =>
      NotificationKindToken.values[viewModel.kind.index];

  /// True when this row should render the inline Accept/Decline variant.
  bool get _isFriendRequestVariant =>
      viewModel.kind.isFriendRequest && !viewModel.isRead && onAccept != null;

  @override
  Widget build(BuildContext context) {
    final isRead = viewModel.isRead;

    return Material(
      color: isRead ? Colors.transparent : NotificationColors.unreadTint,
      borderRadius: NotificationRadii.tile,
      child: InkWell(
        onTap: onTap,
        borderRadius: NotificationRadii.tile,
        child: Padding(
          padding: const EdgeInsets.all(NotificationSpacing.lg),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // (1) Leading avatar + corner type-badge stack.
              _AvatarStack(viewModel: viewModel, kindToken: _kindToken),
              // (2) Gap.
              const SizedBox(width: NotificationSpacing.md),
              // (3) Title / message / timestamp / inline actions.
              Expanded(child: _buildBody()),
              // (4) Trailing delete affordance + unread dot.
              _buildTrailing(),
            ],
          ),
        ),
      ),
    );
  }

  /// The middle column: title, optional message, timestamp, and (for the
  /// inline friend-request variant) the Accept/Decline button row.
  Widget _buildBody() {
    final isRead = viewModel.isRead;
    final message = viewModel.message;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Title (semibold when unread).
        Text(
          viewModel.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: isRead
              ? NotificationTextStyles.cardTitleRead
              : NotificationTextStyles.cardTitleUnread,
        ),
        // Optional muted message body.
        if (message != null && message.isNotEmpty) ...[
          const SizedBox(height: NotificationSpacing.xs),
          Text(
            message,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: NotificationTextStyles.cardMessage,
          ),
        ],
        // Relative timestamp.
        const SizedBox(height: NotificationSpacing.xs),
        Text(viewModel.timeLabel, style: NotificationTextStyles.timestamp),
        // Inline Accept/Decline (friend-request variant only).
        if (_isFriendRequestVariant) ...[
          const SizedBox(height: NotificationSpacing.md),
          _FriendRequestActions(onAccept: onAccept!, onDecline: onDecline),
        ],
      ],
    );
  }

  /// The trailing column: delete X (or spinner while deleting) and, when the
  /// row is unread, a small primary dot beneath it.
  Widget _buildTrailing() {
    // Nothing to show: read row with no delete affordance.
    if (onDelete == null && viewModel.isRead) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(left: NotificationSpacing.sm),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (onDelete != null)
            if (viewModel.isDeleting)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    NotificationColors.mutedForeground,
                  ),
                ),
              )
            else
              IconButton(
                onPressed: onDelete,
                icon: const Icon(Icons.close),
                iconSize: 18,
                color: NotificationColors.mutedForeground,
                tooltip: 'Delete',
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(
                  minWidth: NotificationSpacing.tapTarget,
                  minHeight: NotificationSpacing.tapTarget,
                ),
                splashRadius: 18,
              ),
          if (!viewModel.isRead) ...[
            const SizedBox(height: NotificationSpacing.xs),
            Container(
              width: NotificationSpacing.unreadDot,
              height: NotificationSpacing.unreadDot,
              decoration: const BoxDecoration(
                color: NotificationColors.primary,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 40px circular avatar with a corner type-badge.
///
/// The avatar shows the sender image (when present) over a gradient initial
/// fallback; the bottom-right 18px badge carries the per-kind accent + icon
/// with a 2px background ring (so it reads cleanly over a tinted row).
class _AvatarStack extends StatelessWidget {
  const _AvatarStack({required this.viewModel, required this.kindToken});

  final NotificationCardViewModel viewModel;
  final NotificationKindToken kindToken;

  @override
  Widget build(BuildContext context) {
    final accent = NotificationTypePalette.accentFor(kindToken);
    final icon = NotificationTypePalette.iconFor(kindToken);

    return SizedBox(
      width: NotificationSpacing.avatarMd,
      height: NotificationSpacing.avatarMd,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Base avatar (image over gradient-initial fallback).
          _Avatar(viewModel: viewModel),
          // Corner type-badge.
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              width: NotificationSpacing.typeBadge,
              height: NotificationSpacing.typeBadge,
              decoration: BoxDecoration(
                color: accent,
                shape: BoxShape.circle,
                border: Border.all(
                  color: NotificationColors.background,
                  width: 2,
                ),
              ),
              alignment: Alignment.center,
              child: Icon(
                icon,
                size: 11,
                color: NotificationColors.primaryForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The 40px circular sender avatar: network image when available, otherwise a
/// gradient fill carrying the uppercased initial.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.viewModel});

  final NotificationCardViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    final url = viewModel.avatarUrl?.trim() ?? '';

    final fallback = Container(
      width: NotificationSpacing.avatarMd,
      height: NotificationSpacing.avatarMd,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: NotificationGradients.avatarFallback,
        shape: BoxShape.circle,
      ),
      child: Text(
        viewModel.initial,
        style: NotificationTextStyles.avatarInitial,
      ),
    );

    if (url.isEmpty) return fallback;

    return ClipOval(
      child: Image.network(
        url,
        width: NotificationSpacing.avatarMd,
        height: NotificationSpacing.avatarMd,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => fallback,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return fallback;
        },
      ),
    );
  }
}

/// Inline Accept / Decline buttons for an unread friend-request notification.
///
/// Accept is a filled primary button; Decline is an outlined neutral button.
/// Both are 32px tall with a leading icon, matching the web `size="sm" h-8`.
class _FriendRequestActions extends StatelessWidget {
  const _FriendRequestActions({required this.onAccept, this.onDecline});

  final VoidCallback onAccept;
  final VoidCallback? onDecline;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Accept (filled primary).
        SizedBox(
          height: 32,
          child: FilledButton.icon(
            onPressed: onAccept,
            icon: const Icon(Icons.check, size: 16),
            label: const Text('Accept'),
            style: FilledButton.styleFrom(
              backgroundColor: NotificationColors.primary,
              foregroundColor: NotificationColors.primaryForeground,
              minimumSize: const Size(0, 32),
              padding: const EdgeInsets.symmetric(
                horizontal: NotificationSpacing.lg,
              ),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              textStyle: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
              shape: const RoundedRectangleBorder(
                borderRadius: NotificationRadii.tile,
              ),
            ),
          ),
        ),
        const SizedBox(width: NotificationSpacing.sm),
        // Decline (outlined neutral).
        SizedBox(
          height: 32,
          child: OutlinedButton.icon(
            onPressed: onDecline,
            icon: const Icon(Icons.close, size: 16),
            label: const Text('Decline'),
            style: OutlinedButton.styleFrom(
              foregroundColor: NotificationColors.foreground,
              minimumSize: const Size(0, 32),
              padding: const EdgeInsets.symmetric(
                horizontal: NotificationSpacing.lg,
              ),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              side: const BorderSide(color: NotificationColors.border),
              textStyle: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
              shape: const RoundedRectangleBorder(
                borderRadius: NotificationRadii.tile,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
