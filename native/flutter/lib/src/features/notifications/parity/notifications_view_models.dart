/// Plain immutable view-models + enums consumed by the Notifications parity
/// widgets. No Supabase / repo access; widgets receive these + callbacks only.
///
/// These types are presentational. A host/container maps the data-layer
/// `NotificationItem` (and a future `NotificationPreferences` row) into these,
/// resolving deep-link routes and date buckets BEFORE handing them to widgets.
///
/// Only the Flutter SDK (`widgets` -> `@immutable`, `String.characters`) is
/// imported so this file analyzes cleanly on its own.
library;

import 'package:flutter/widgets.dart';

/// Presentational notification kind, parsed from the raw server `type` string.
///
/// Replaces the brittle title-substring inference in the legacy
/// `NotificationType { message, feed, system }`. Names mirror
/// `NotificationKindToken` in notifications_tokens.dart so the per-type
/// icon/color map maps 1:1.
enum NotificationKind {
  like,
  comment,
  reply,
  mention,
  follow,
  message,
  friendRequest,
  friendRequestAccepted,
  story,
  badge, // role_promotion / plan_upgrade -> celebration
  system;

  /// Parses a raw server `type` string into a presentational kind.
  ///
  /// Excluded/monetization/live types (gift, gift_received, credit_received,
  /// live_gift, live_invite) intentionally fall through to [system] so no
  /// excluded surface is reachable.
  static NotificationKind parse(String? raw) {
    switch ((raw ?? '').trim().toLowerCase()) {
      case 'like':
        return NotificationKind.like;
      case 'comment':
        return NotificationKind.comment;
      case 'reply':
        return NotificationKind.reply;
      case 'mention':
        return NotificationKind.mention;
      case 'follow':
        return NotificationKind.follow;
      case 'message':
        return NotificationKind.message;
      case 'friend_request':
        return NotificationKind.friendRequest;
      case 'friend_request_accepted':
        return NotificationKind.friendRequestAccepted;
      case 'story_reply':
      case 'story_reaction':
        return NotificationKind.story;
      case 'role_promotion':
      case 'plan_upgrade':
        return NotificationKind.badge;
      // refeed / quote read as feed activity; treat as comment-style accent.
      case 'refeed':
      case 'quote':
        return NotificationKind.comment;
      default:
        return NotificationKind.system;
    }
  }

  /// True when this kind opens the [BadgeCelebrationViewModel] overlay instead
  /// of routing.
  bool get isCelebration => this == NotificationKind.badge;

  /// True when this kind should render the inline Accept/Decline variant
  /// (only meaningful when unread).
  bool get isFriendRequest => this == NotificationKind.friendRequest;
}

/// Read-state filter for the inbox/history list.
enum NotificationFilter { all, unread, read }

/// One typed notification, fully resolved for presentation.
@immutable
class NotificationCardViewModel {
  const NotificationCardViewModel({
    required this.id,
    required this.kind,
    required this.title,
    required this.timeLabel,
    required this.isRead,
    this.message,
    this.displayName,
    this.avatarUrl,
    this.route,
    this.isDeleting = false,
  });

  /// Stable notification id (used for delete / mark-read callbacks).
  final String id;

  /// Parsed presentational kind (drives icon + accent color).
  final NotificationKind kind;

  /// Bold title line (web `title`).
  final String title;

  /// Optional muted body, clamped to 2 lines by the card (web `message`).
  final String? message;

  /// Pre-formatted relative timestamp (e.g. "5m ago"). The host formats this
  /// via [relativeTimeLabel] so widgets never touch DateTime.
  final String timeLabel;

  /// Read/unread visual state (tinted bg + semibold + unread dot when false).
  final bool isRead;

  /// Sender display name (for avatar initial fallback).
  final String? displayName;

  /// Sender avatar image url (nullable -> gradient initial fallback).
  final String? avatarUrl;

  /// Pre-resolved deep-link route (host resolves via the action resolver).
  /// Null for excluded surfaces (wallet/live) so they stay unreachable.
  final String? route;

  /// True while a per-row delete is in flight (renders a spinner).
  final bool isDeleting;

  /// First grapheme of [displayName] upper-cased, or '?' fallback.
  String get initial {
    final name = displayName?.trim() ?? '';
    if (name.isEmpty) return '?';
    return name.characters.first.toUpperCase();
  }

  NotificationCardViewModel copyWith({bool? isRead, bool? isDeleting}) {
    return NotificationCardViewModel(
      id: id,
      kind: kind,
      title: title,
      message: message,
      timeLabel: timeLabel,
      isRead: isRead ?? this.isRead,
      displayName: displayName,
      avatarUrl: avatarUrl,
      route: route,
      isDeleting: isDeleting ?? this.isDeleting,
    );
  }
}

/// A dated section of notifications (Today / Yesterday / This Week / date).
@immutable
class NotificationSection {
  const NotificationSection({required this.label, required this.items});

  /// Header label ('Today', 'Yesterday', 'This Week', 'Earlier', or a date).
  final String label;

  /// Reverse-chronological items in this bucket.
  final List<NotificationCardViewModel> items;
}

/// The whole inbox/history list state handed to the list widget.
@immutable
class NotificationListViewModel {
  const NotificationListViewModel({
    required this.sections,
    required this.filter,
    required this.totalCount,
    required this.unreadCount,
    this.isLoading = false,
  });

  final List<NotificationSection> sections;
  final NotificationFilter filter;
  final int totalCount;
  final int unreadCount;
  final bool isLoading;

  int get readCount => (totalCount - unreadCount).clamp(0, totalCount);
  bool get isEmpty => sections.isEmpty;
}

/// Bell button + unread badge state.
@immutable
class NotificationBellViewModel {
  const NotificationBellViewModel({required this.unreadCount});

  final int unreadCount;

  bool get hasUnread => unreadCount > 0;

  /// Capped display label ('99+' over 99); empty when zero.
  String get badgeLabel {
    if (unreadCount <= 0) return '';
    if (unreadCount > 99) return '99+';
    return '$unreadCount';
  }
}

/// A single preference toggle row.
@immutable
class PreferenceItemViewModel {
  const PreferenceItemViewModel({
    required this.key,
    required this.title,
    required this.description,
    required this.kind,
    required this.enabled,
    this.locked = false,
  });

  /// Stable id used by the toggle callback (e.g. 'likes_enabled').
  final String key;

  final String title;
  final String description;

  /// Drives the leading tinted icon + accent color via the token palette.
  final NotificationKind kind;

  /// Current toggle value.
  final bool enabled;

  /// True when gated off by a master push toggle -> row rendered disabled.
  final bool locked;

  PreferenceItemViewModel copyWith({bool? enabled, bool? locked}) {
    return PreferenceItemViewModel(
      key: key,
      title: title,
      description: description,
      kind: kind,
      enabled: enabled ?? this.enabled,
      locked: locked ?? this.locked,
    );
  }
}

/// A grouped section of preference rows (Social / Messages & Friends / ...).
@immutable
class PreferenceGroupViewModel {
  const PreferenceGroupViewModel({required this.title, required this.items});

  final String title;
  final List<PreferenceItemViewModel> items;
}

/// Full preferences screen/popover state.
@immutable
class NotificationPreferencesViewModel {
  const NotificationPreferencesViewModel({
    required this.groups,
    this.isLoading = false,
    this.isSaving = false,
  });

  final List<PreferenceGroupViewModel> groups;
  final bool isLoading;
  final bool isSaving;

  /// The flat 5-row popover variant (likes/comments/messages/stories/email).
  /// Convenience accessor; the host can also build a dedicated group.
  List<PreferenceItemViewModel> get allItems =>
      groups.expand((g) => g.items).toList(growable: false);

  /// Default factory mirroring the web `notification_preferences` defaults,
  /// excluding live/gifts rows per global hard exclusions.
  factory NotificationPreferencesViewModel.defaults() {
    return const NotificationPreferencesViewModel(
      groups: [
        PreferenceGroupViewModel(
          title: 'Social',
          items: [
            PreferenceItemViewModel(
              key: 'likes_enabled',
              title: 'Likes',
              description: 'When someone likes your posts or comments',
              kind: NotificationKind.like,
              enabled: true,
            ),
            PreferenceItemViewModel(
              key: 'comments_enabled',
              title: 'Comments & Mentions',
              description: 'When someone comments on or mentions you',
              kind: NotificationKind.comment,
              enabled: true,
            ),
            PreferenceItemViewModel(
              key: 'follows_enabled',
              title: 'New Followers',
              description: 'When someone follows you',
              kind: NotificationKind.follow,
              enabled: true,
            ),
          ],
        ),
        PreferenceGroupViewModel(
          title: 'Messages & Friends',
          items: [
            PreferenceItemViewModel(
              key: 'messages_enabled',
              title: 'Direct Messages',
              description: 'When you receive new messages',
              kind: NotificationKind.message,
              enabled: true,
            ),
            PreferenceItemViewModel(
              key: 'friend_requests_enabled',
              title: 'Friend Requests',
              description: 'When someone sends you a friend request',
              kind: NotificationKind.friendRequest,
              enabled: true,
            ),
          ],
        ),
        PreferenceGroupViewModel(
          title: 'Content',
          items: [
            PreferenceItemViewModel(
              key: 'stories_enabled',
              title: 'Stories',
              description: 'Replies and reactions to your stories',
              kind: NotificationKind.story,
              enabled: true,
            ),
          ],
        ),
        PreferenceGroupViewModel(
          title: 'Email',
          items: [
            PreferenceItemViewModel(
              key: 'email_enabled',
              title: 'Email Notifications',
              description: 'Receive notifications via email',
              kind: NotificationKind.system,
              enabled: false,
            ),
          ],
        ),
      ],
    );
  }
}

/// Push master-card presentational flags (UI-only; delivery is out of scope).
@immutable
class PushMasterViewModel {
  const PushMasterViewModel({
    this.pushEnabled = false,
    this.isSupported = true,
    this.permissionDenied = false,
  });

  final bool pushEnabled;
  final bool isSupported;
  final bool permissionDenied;

  bool get showActiveBadge => pushEnabled && isSupported && !permissionDenied;
  bool get showNotSupportedBanner => !isSupported;
  bool get showBlockedBanner => isSupported && permissionDenied;
}

/// Celebration overlay source type.
enum BadgeCelebrationType { rolePromotion, planUpgrade }

/// View-model for the full-screen badge celebration overlay.
@immutable
class BadgeCelebrationViewModel {
  const BadgeCelebrationViewModel({
    required this.type,
    required this.title,
    this.message,
  });

  final BadgeCelebrationType type;
  final String title;
  final String? message;

  /// Detects the badge key from the title (ported from BadgeCelebration.tsx).
  /// Matches known keys and their space-substituted form ('super admin'),
  /// falling back to 'moderator' for role promotions / 'popular' otherwise.
  String get badgeKey {
    final lower = title.toLowerCase();
    const keys = [
      'super_admin',
      'developer',
      'admin',
      'moderator',
      'premium',
      'pro',
      'popular',
    ];
    for (final key in keys) {
      if (lower.contains(key.replaceAll('_', ' ')) || lower.contains(key)) {
        return key;
      }
    }
    return type == BadgeCelebrationType.rolePromotion ? 'moderator' : 'popular';
  }
}
