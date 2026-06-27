/// Reusable "all caught up" empty view for the Notifications surface.
///
/// Ports the web bell-panel empty state plus `NotificationHistory.tsx`
/// filter-aware copy into a single presentational widget. It is rendered by
/// both the bell quick-panel and the inbox/history empty slot (passed as
/// `NotificationSectionList.emptyState`).
///
/// Pure presentational: it takes a [NotificationFilter] for the copy and an
/// optional [onViewHistory] callback for the bell-panel "View history" link.
/// No Supabase / repo access, no other callbacks.
///
/// Web parity references:
///   - src/components/notifications/NotificationBell.tsx (panel empty state)
///   - src/components/notifications/NotificationHistory.tsx (filter copy)
library;

import 'package:flutter/material.dart';

import '../notifications_tokens.dart';
import '../notifications_view_models.dart';

/// Centered "nothing here" view whose headline/subtext vary by read-filter.
///
/// When [onViewHistory] is non-null, a trailing "View history" [TextButton] is
/// shown (the web bell-panel link); otherwise the link is omitted entirely.
class NotificationEmptyState extends StatelessWidget {
  const NotificationEmptyState({
    super.key,
    required this.filter,
    this.onViewHistory,
  });

  /// Read-state filter driving the headline + subtext copy.
  final NotificationFilter filter;

  /// Optional "View history" tap target. When null, the link is not rendered.
  final VoidCallback? onViewHistory;

  /// Headline copy per filter (ported from NotificationHistory.tsx).
  String get _headline {
    return switch (filter) {
      NotificationFilter.unread => "You're all caught up!",
      NotificationFilter.read => 'No read notifications yet',
      NotificationFilter.all => 'No notifications yet',
    };
  }

  /// Subtext copy per filter.
  String get _subtext {
    return switch (filter) {
      NotificationFilter.unread => 'No new notifications',
      NotificationFilter.read => 'Notifications you have read will appear here',
      NotificationFilter.all => 'Notifications will appear here',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: NotificationSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // (1) 64px muted circle with a bell-off icon.
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: NotificationColors.muted.withValues(alpha: 0.4),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.notifications_none,
                size: 32,
                color: NotificationColors.mutedForeground,
              ),
            ),
            // (2) gap lg=16.
            const SizedBox(height: NotificationSpacing.lg),
            // (3) headline.
            Text(
              _headline,
              textAlign: TextAlign.center,
              style: NotificationTextStyles.emptyHeadline,
            ),
            // (4) gap sm=8.
            const SizedBox(height: NotificationSpacing.sm),
            // (5) centered subtext.
            Text(
              _subtext,
              textAlign: TextAlign.center,
              style: NotificationTextStyles.emptySubtext,
            ),
            // (6) optional "View history" link (web bell-panel).
            if (onViewHistory != null) ...[
              const SizedBox(height: NotificationSpacing.md),
              TextButton(
                onPressed: onViewHistory,
                style: TextButton.styleFrom(
                  foregroundColor: NotificationColors.primary,
                  minimumSize: const Size(0, NotificationSpacing.tapTarget),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  padding: const EdgeInsets.symmetric(
                    horizontal: NotificationSpacing.md,
                    vertical: NotificationSpacing.sm,
                  ),
                ),
                child: const Text(
                  'View history',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: NotificationColors.primary,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
