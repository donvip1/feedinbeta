import 'package:flutter/material.dart';

import '../../data/local/notification_repository_contract.dart';
import 'notification_item.dart';
import 'parity/notification_presenter.dart';
import 'parity/notifications_tokens.dart';
import 'parity/notifications_view_models.dart';
import 'parity/widgets/notification_empty_state.dart';
import 'parity/widgets/notification_section_list.dart';

/// Notifications inbox/history screen.
///
/// Hosts the parity surface: it loads the stored [NotificationItem] inbox from
/// [notificationRepository], maps it into the presentational view-models via
/// [NotificationPresenter], and renders the date-grouped [NotificationSectionList]
/// with a typed-card body, an All/Unread/Read filter, a 'Read all' action and a
/// filter-aware empty state.
///
/// Deep-link tap handling is unchanged: tapping a row marks it read and, when
/// the stored notification carries a route, forwards it to [onOpenRoute] (the
/// existing route handler already wired in the feed shell). No new Supabase
/// calls are made; sender name/avatar are not stored locally and fall back to
/// graceful defaults in the card widget.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({
    super.key,
    required this.notificationRepository,
    required this.onOpenRoute,
    this.onChanged,
  });

  final NotificationRepositoryContract notificationRepository;
  final ValueChanged<String> onOpenRoute;
  final VoidCallback? onChanged;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<NotificationItem>> _notificationsFuture;

  /// Active read-state filter (client-side; not persisted).
  NotificationFilter _filter = NotificationFilter.all;
  final Set<String> _deletingIds = <String>{};

  @override
  void initState() {
    super.initState();
    _notificationsFuture = widget.notificationRepository.loadNotifications();
  }

  void _reload() {
    setState(() {
      _notificationsFuture = widget.notificationRepository.loadNotifications();
    });
  }

  Future<void> _markAllRead() async {
    await widget.notificationRepository.markAllRead();
    if (!mounted) return;
    widget.onChanged?.call();
    _reload();
  }

  void _selectFilter(NotificationFilter filter) {
    if (filter == _filter) return;
    setState(() => _filter = filter);
  }

  /// Row tap: mark read, then deep-link via the existing route handler when a
  /// route is present. Falls back to a silent reload (so the unread dot clears)
  /// when the notification has no route.
  Future<void> _open(NotificationCardViewModel card) async {
    await widget.notificationRepository.markRead(card.id);
    final route = card.route;
    if (!mounted) return;
    widget.onChanged?.call();
    _reload();
    if (route != null && route.trim().isNotEmpty) {
      widget.onOpenRoute(route);
      return;
    }
  }

  Future<void> _delete(String notificationId) async {
    final repository = widget.notificationRepository;
    if (repository is! NotificationDeletionContract) return;
    final deletionRepository = repository as NotificationDeletionContract;

    setState(() => _deletingIds.add(notificationId));
    try {
      await deletionRepository.deleteNotification(notificationId);
      if (!mounted) return;
      widget.onChanged?.call();
      _reload();
    } finally {
      if (mounted) {
        setState(() => _deletingIds.remove(notificationId));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: NotificationColors.background,
      child: SafeArea(
        top: false,
        child: FutureBuilder<List<NotificationItem>>(
          future: _notificationsFuture,
          builder: (context, snapshot) {
            final items = snapshot.data;

            if (items == null) {
              return const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(
                    NotificationColors.primary,
                  ),
                ),
              );
            }

            final listViewModel = NotificationPresenter.buildList(
              items,
              filter: _filter,
            ).withDeletingIds(_deletingIds);

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ScreenHeader(unreadCount: listViewModel.unreadCount),
                Expanded(
                  child: NotificationSectionList(
                    viewModel: listViewModel,
                    onTapItem: _open,
                    onDeleteItem:
                        widget.notificationRepository
                            is NotificationDeletionContract
                        ? _delete
                        : null,
                    onMarkAllRead: _markAllRead,
                    onSelectFilter: _selectFilter,
                    emptyState: NotificationEmptyState(filter: _filter),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

extension on NotificationListViewModel {
  NotificationListViewModel withDeletingIds(Set<String> deletingIds) {
    if (deletingIds.isEmpty) return this;
    return NotificationListViewModel(
      sections: [
        for (final section in sections)
          NotificationSection(
            label: section.label,
            items: [
              for (final item in section.items)
                item.copyWith(isDeleting: deletingIds.contains(item.id)),
            ],
          ),
      ],
      filter: filter,
      totalCount: totalCount,
      unreadCount: unreadCount,
      isLoading: isLoading,
    );
  }
}

/// Title row with an optional unread-count pill ('Notifications  •  3 new').
class _ScreenHeader extends StatelessWidget {
  const _ScreenHeader({required this.unreadCount});

  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        NotificationSpacing.lg,
        NotificationSpacing.lg,
        NotificationSpacing.lg,
        NotificationSpacing.xs,
      ),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              'Notifications',
              style: NotificationTextStyles.screenTitle,
            ),
          ),
          if (unreadCount > 0) _UnreadPill(count: unreadCount),
        ],
      ),
    );
  }
}

/// Small primary-tinted `n new` pill shown beside the screen title.
class _UnreadPill extends StatelessWidget {
  const _UnreadPill({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+ new' : '$count new';
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NotificationSpacing.md,
        vertical: NotificationSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: NotificationColors.primarySoft,
        borderRadius: NotificationRadii.chip,
      ),
      child: Text(
        label,
        style: NotificationTextStyles.filterTab.copyWith(
          color: NotificationColors.primary,
        ),
      ),
    );
  }
}
