/// Maps the data-layer [NotificationItem] inbox into the presentational
/// view-models consumed by the Notifications parity widgets.
///
/// This is the glue layer between `data/local` (which only stores
/// `title` / `body` / `createdAtMillis` / `isRead` / `route` plus optional
/// metadata) and the richer parity surface (typed cards, date sections, unread
/// counts). It performs CLIENT-SIDE only work:
///   - maps the optional local `rawType` field into [NotificationKind], falling
///     back to route + title/body keyword inference for older stored rows,
///   - resolves a relative time label,
///   - buckets items into Today / Yesterday / This Week / Earlier sections,
///   - applies an in-memory read-state filter.
///
/// Missing sender display names / avatar urls are rendered with graceful
/// defaults by the widgets. No Supabase calls are made.
///
/// Pure / dependency-light: imports only the data-layer model and the parity
/// view-models.
library;

import '../notification_item.dart';
import 'notifications_view_models.dart';

/// Stateless presenter turning the stored notification inbox into the parity
/// [NotificationListViewModel] (and a matching [NotificationBellViewModel]).
class NotificationPresenter {
  const NotificationPresenter._();

  /// Builds the full list view-model for the inbox/history body.
  ///
  /// [items] is the raw inbox (any order); [filter] is the active read-state
  /// filter; [now] is injectable for deterministic bucketing/time labels.
  static NotificationListViewModel buildList(
    List<NotificationItem> items, {
    NotificationFilter filter = NotificationFilter.all,
    DateTime? now,
  }) {
    final clock = now ?? DateTime.now();

    final totalCount = items.length;
    final unreadCount = items.where((item) => !item.isRead).length;

    // Reverse-chronological so the newest notification leads each section.
    final sorted = [...items]
      ..sort((a, b) => b.createdAtMillis.compareTo(a.createdAtMillis));

    final filtered = sorted
        .where((item) {
          return switch (filter) {
            NotificationFilter.all => true,
            NotificationFilter.unread => !item.isRead,
            NotificationFilter.read => item.isRead,
          };
        })
        .toList(growable: false);

    final sections = _bucketIntoSections(filtered, clock);

    return NotificationListViewModel(
      sections: sections,
      filter: filter,
      totalCount: totalCount,
      unreadCount: unreadCount,
    );
  }

  /// Convenience bell view-model from a raw inbox (unread count only).
  static NotificationBellViewModel buildBell(List<NotificationItem> items) {
    final unread = items.where((item) => !item.isRead).length;
    return NotificationBellViewModel(unreadCount: unread);
  }

  /// Maps one stored [NotificationItem] to a presentational card view-model.
  ///
  /// [now] is injectable so the relative time label is deterministic.
  static NotificationCardViewModel toCard(NotificationItem item, DateTime now) {
    return NotificationCardViewModel(
      id: item.id,
      kind: inferKind(item),
      title: item.title,
      message: item.body.trim().isEmpty ? null : item.body,
      timeLabel: relativeTimeLabel(item.createdAtMillis, now),
      isRead: item.isRead,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      route: item.route,
    );
  }

  /// Infers a presentational [NotificationKind] from the locally-available
  /// fields. Newer local rows may carry a raw server `type`; older rows fall
  /// back to legacy [NotificationItem.type]-style route/title/body heuristics
  /// while resolving the richer parity kinds (like / comment / follow / badge).
  ///
  /// Resolution order (most specific first):
  ///   1. raw type,
  ///   2. route scheme/path hints (conversation/message),
  ///   3. title + body keyword hints,
  ///   4. fallback to [NotificationKind.system].
  static NotificationKind inferKind(NotificationItem item) {
    final typedKind = NotificationKind.parse(item.rawType);
    if (typedKind != NotificationKind.system) return typedKind;

    final route = (item.route ?? '').toLowerCase();
    final haystack = '${item.title} ${item.body}'.toLowerCase();

    // (1) Route-driven hints are the strongest signal.
    if (route.contains('message') || route.contains('conversation')) {
      return NotificationKind.message;
    }

    // (2) Keyword hints, ordered so the more specific feed reactions win before
    // the generic message/chat fallbacks.
    bool has(String needle) => haystack.contains(needle);

    if (has('badge') ||
        has('promoted') ||
        has('promotion') ||
        has('upgrade') ||
        has('unlocked') ||
        has('achievement')) {
      return NotificationKind.badge;
    }
    if (has('mention') || has('mentioned') || has('tagged you')) {
      return NotificationKind.mention;
    }
    if (has('replied') || has('reply')) {
      return NotificationKind.reply;
    }
    if (has('comment')) {
      return NotificationKind.comment;
    }
    if (has('liked') || has('like') || has('reacted') || has('reaction')) {
      return NotificationKind.like;
    }
    if (has('friend request') || has('wants to connect')) {
      return NotificationKind.friendRequest;
    }
    if (has('accepted your') || has('you are now friends')) {
      return NotificationKind.friendRequestAccepted;
    }
    if (has('started following') ||
        has('followed you') ||
        has('new follower') ||
        has('follow')) {
      return NotificationKind.follow;
    }
    if (has('story')) {
      return NotificationKind.story;
    }
    if (route.contains('post') ||
        has('refeed') ||
        has('reposted') ||
        has('quoted')) {
      return NotificationKind.comment;
    }
    if (has('message') || has('chat') || has('messaged you')) {
      return NotificationKind.message;
    }

    // (3) Anything else (welcome / system / sync) -> system bell.
    return NotificationKind.system;
  }

  /// Relative time label (e.g. "Just now", "5m ago", "3h ago", "2d ago", or a
  /// short date). Mirrors the legacy `_friendlyNotificationTime` helper so the
  /// copy stays identical across the rewire.
  static String relativeTimeLabel(int millis, DateTime now) {
    final date = DateTime.fromMillisecondsSinceEpoch(millis);
    final difference = now.difference(date);
    if (difference.isNegative) return 'Just now';
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inHours < 1) return '${difference.inMinutes}m ago';
    if (difference.inDays < 1) return '${difference.inHours}h ago';
    if (difference.inDays < 7) return '${difference.inDays}d ago';
    return '${date.month}/${date.day}/${date.year}';
  }

  /// Buckets reverse-chronological [items] into Today / Yesterday / This Week /
  /// Earlier sections, preserving order and omitting empty buckets.
  static List<NotificationSection> _bucketIntoSections(
    List<NotificationItem> items,
    DateTime now,
  ) {
    if (items.isEmpty) return const [];

    final today = <NotificationCardViewModel>[];
    final yesterday = <NotificationCardViewModel>[];
    final thisWeek = <NotificationCardViewModel>[];
    final earlier = <NotificationCardViewModel>[];

    final startOfToday = DateTime(now.year, now.month, now.day);
    final startOfYesterday = startOfToday.subtract(const Duration(days: 1));
    final startOfWeek = startOfToday.subtract(const Duration(days: 7));

    for (final item in items) {
      final date = DateTime.fromMillisecondsSinceEpoch(item.createdAtMillis);
      final card = toCard(item, now);
      if (!date.isBefore(startOfToday)) {
        today.add(card);
      } else if (!date.isBefore(startOfYesterday)) {
        yesterday.add(card);
      } else if (!date.isBefore(startOfWeek)) {
        thisWeek.add(card);
      } else {
        earlier.add(card);
      }
    }

    return [
      if (today.isNotEmpty) NotificationSection(label: 'Today', items: today),
      if (yesterday.isNotEmpty)
        NotificationSection(label: 'Yesterday', items: yesterday),
      if (thisWeek.isNotEmpty)
        NotificationSection(label: 'This Week', items: thisWeek),
      if (earlier.isNotEmpty)
        NotificationSection(label: 'Earlier', items: earlier),
    ];
  }
}
