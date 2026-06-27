/// Date-grouped notifications inbox/history body for the Notifications parity
/// rebuild.
///
/// This is the net-new sectioning layer: the web reference renders a flat list,
/// but this screen's scope mandates date grouping (Today / Yesterday / This Week
/// / Earlier). It renders a scrollable list built from
/// [NotificationListViewModel.sections], plus a pinned header region holding the
/// All/Unread/Read filter control and a 'Read all' affordance.
///
/// Pure presentational: it takes view-models + callbacks and never touches
/// Supabase / repositories. It composes the sibling [NotificationCard] widget
/// for each row (kept decoupled from other features).
///
/// Web parity references:
///   - src/components/notifications/NotificationItem.tsx
///   - src/components/notifications/NotificationsList.tsx
library;

import 'package:flutter/material.dart';

import '../notifications_tokens.dart';
import '../notifications_view_models.dart';
import 'notification_card.dart';

/// The date-grouped scrollable inbox/history body.
///
/// Renders, top to bottom:
///   1. A pinned header (filter row + 'Read all') when the relevant callbacks
///      are provided.
///   2. A loading spinner, an empty state, or the date-grouped card list.
class NotificationSectionList extends StatelessWidget {
  const NotificationSectionList({
    super.key,
    required this.viewModel,
    required this.onTapItem,
    this.onDeleteItem,
    this.onAcceptFriendRequest,
    this.onDeclineFriendRequest,
    this.onMarkAllRead,
    this.onSelectFilter,
    this.emptyState,
  });

  /// The whole inbox/history list state (sections, counts, filter, loading).
  final NotificationListViewModel viewModel;

  /// Fired when a notification row is tapped (deep-link target).
  final ValueChanged<NotificationCardViewModel> onTapItem;

  /// Fired with the item id when a row's delete affordance is used. When null,
  /// cards render without a delete action.
  final ValueChanged<String>? onDeleteItem;

  /// Fired with the item id when an unread friend-request card is accepted.
  final ValueChanged<String>? onAcceptFriendRequest;

  /// Fired with the item id when an unread friend-request card is declined.
  final ValueChanged<String>? onDeclineFriendRequest;

  /// Fired from the header 'Read all' affordance. When null, the affordance is
  /// hidden. Disabled when there are no unread items.
  final VoidCallback? onMarkAllRead;

  /// Fired from the All/Unread/Read filter control. When null, the filter row
  /// is hidden.
  final ValueChanged<NotificationFilter>? onSelectFilter;

  /// Widget shown when the list is empty (and not loading). Falls back to an
  /// empty [SizedBox] when null.
  final Widget? emptyState;

  bool get _hasHeader => onSelectFilter != null || onMarkAllRead != null;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        if (_hasHeader)
          SliverPersistentHeader(
            pinned: true,
            delegate: _HeaderDelegate(
              child: _HeaderBar(
                viewModel: viewModel,
                onSelectFilter: onSelectFilter,
                onMarkAllRead: onMarkAllRead,
              ),
            ),
          ),
        ..._buildBodySlivers(),
      ],
    );
  }

  List<Widget> _buildBodySlivers() {
    if (viewModel.isLoading) {
      return const [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(
                NotificationColors.primary,
              ),
            ),
          ),
        ),
      ];
    }

    if (viewModel.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: emptyState ?? const SizedBox.shrink(),
        ),
      ];
    }

    return [
      for (var i = 0; i < viewModel.sections.length; i++)
        _buildSectionSliver(viewModel.sections[i], isFirst: i == 0),
      const SliverToBoxAdapter(child: SizedBox(height: NotificationSpacing.xl)),
    ];
  }

  Widget _buildSectionSliver(
    NotificationSection section, {
    required bool isFirst,
  }) {
    final items = section.items;
    return SliverList.builder(
      // +1 leading slot for the date header.
      itemCount: items.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: EdgeInsets.fromLTRB(
              NotificationSpacing.lg,
              // xl=24 above each new section header; the first header sits
              // closer to the (pinned) filter row.
              isFirst ? NotificationSpacing.sm : NotificationSpacing.xl,
              NotificationSpacing.lg,
              NotificationSpacing.sm,
            ),
            child: Text(
              section.label.toUpperCase(),
              style: NotificationTextStyles.sectionLabel,
            ),
          );
        }

        final item = items[index - 1];
        return Padding(
          padding: EdgeInsets.only(
            left: NotificationSpacing.lg,
            right: NotificationSpacing.lg,
            // SizedBox(height: sm) gap between cards (not below the last one).
            bottom: index == items.length ? 0 : NotificationSpacing.sm,
          ),
          child: _buildCard(item),
        );
      },
    );
  }

  Widget _buildCard(NotificationCardViewModel item) {
    final wantsFriendActions = item.kind.isFriendRequest && !item.isRead;
    return NotificationCard(
      viewModel: item,
      onTap: () => onTapItem(item),
      onDelete: onDeleteItem == null ? null : () => onDeleteItem!(item.id),
      onAccept: wantsFriendActions && onAcceptFriendRequest != null
          ? () => onAcceptFriendRequest!(item.id)
          : null,
      onDecline: wantsFriendActions && onDeclineFriendRequest != null
          ? () => onDeclineFriendRequest!(item.id)
          : null,
    );
  }
}

/// Pinned header: compact segmented filter + 'Read all' affordance.
class _HeaderBar extends StatelessWidget {
  const _HeaderBar({
    required this.viewModel,
    required this.onSelectFilter,
    required this.onMarkAllRead,
  });

  final NotificationListViewModel viewModel;
  final ValueChanged<NotificationFilter>? onSelectFilter;
  final VoidCallback? onMarkAllRead;

  @override
  Widget build(BuildContext context) {
    final showFilter = onSelectFilter != null;
    final showReadAll = onMarkAllRead != null;
    final canReadAll = viewModel.unreadCount > 0;

    return Container(
      color: NotificationColors.background,
      padding: const EdgeInsets.symmetric(
        horizontal: NotificationSpacing.lg,
        vertical: NotificationSpacing.sm,
      ),
      child: Row(
        children: [
          if (showFilter)
            Expanded(
              child: _FilterRow(
                selected: viewModel.filter,
                totalCount: viewModel.totalCount,
                unreadCount: viewModel.unreadCount,
                readCount: viewModel.readCount,
                onSelectFilter: onSelectFilter!,
              ),
            )
          else
            const Spacer(),
          if (showReadAll)
            Padding(
              padding: const EdgeInsets.only(left: NotificationSpacing.sm),
              child: TextButton.icon(
                onPressed: canReadAll ? onMarkAllRead : null,
                icon: const Icon(Icons.done_all, size: 18),
                label: const Text('Read all'),
                style: TextButton.styleFrom(
                  foregroundColor: NotificationColors.primary,
                  disabledForegroundColor: NotificationColors.mutedForeground,
                  textStyle: NotificationTextStyles.filterTab,
                  padding: const EdgeInsets.symmetric(
                    horizontal: NotificationSpacing.sm,
                    vertical: NotificationSpacing.xs,
                  ),
                  minimumSize: const Size(0, NotificationSpacing.tapTarget),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Compact segmented All / Unread / Read control showing counts.
class _FilterRow extends StatelessWidget {
  const _FilterRow({
    required this.selected,
    required this.totalCount,
    required this.unreadCount,
    required this.readCount,
    required this.onSelectFilter,
  });

  final NotificationFilter selected;
  final int totalCount;
  final int unreadCount;
  final int readCount;
  final ValueChanged<NotificationFilter> onSelectFilter;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: NotificationSpacing.xs,
      runSpacing: NotificationSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _FilterPill(
          label: 'All',
          count: totalCount,
          isSelected: selected == NotificationFilter.all,
          onTap: () => onSelectFilter(NotificationFilter.all),
        ),
        _FilterPill(
          label: 'Unread',
          count: unreadCount,
          isSelected: selected == NotificationFilter.unread,
          onTap: () => onSelectFilter(NotificationFilter.unread),
        ),
        _FilterPill(
          label: 'Read',
          count: readCount,
          isSelected: selected == NotificationFilter.read,
          onTap: () => onSelectFilter(NotificationFilter.read),
        ),
      ],
    );
  }
}

/// A single filter pill: filled [NotificationColors.primarySoft] with a
/// [NotificationColors.primary] label when selected, muted otherwise.
class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.count,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = isSelected
        ? NotificationColors.primary
        : NotificationColors.mutedForeground;
    return Material(
      color: isSelected ? NotificationColors.primarySoft : Colors.transparent,
      borderRadius: NotificationRadii.chip,
      child: InkWell(
        onTap: onTap,
        borderRadius: NotificationRadii.chip,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NotificationSpacing.md,
            vertical: NotificationSpacing.xs,
          ),
          child: Text(
            '$label ($count)',
            style: NotificationTextStyles.filterTab.copyWith(color: fg),
          ),
        ),
      ),
    );
  }
}

/// Pins the header bar to the top of the scroll view and sizes it to its
/// intrinsic single-line height.
class _HeaderDelegate extends SliverPersistentHeaderDelegate {
  _HeaderDelegate({required this.child});

  final Widget child;

  // sm(8) top + sm(8) bottom padding + a tap-target-tall row.
  static const double _extent =
      NotificationSpacing.tapTarget + NotificationSpacing.sm * 2;

  @override
  double get minExtent => _extent;

  @override
  double get maxExtent => _extent;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return SizedBox(height: _extent, child: child);
  }

  @override
  bool shouldRebuild(covariant _HeaderDelegate oldDelegate) {
    return oldDelegate.child != child;
  }
}
