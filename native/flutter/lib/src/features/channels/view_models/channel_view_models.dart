import 'package:flutter/foundation.dart';

import '../data/channel_models.dart';
import '../data/channels_remote_data_source.dart';

/// UI-facing, immutable view-models for the Channels feature. Widgets take these
/// (+ callbacks) and never read Supabase directly. The screen layer maps the
/// remote DTOs (`data/channel_models.dart`) into these views.

/// The viewer's relationship to a channel, derived from the subscriber role.
enum ChannelRole { owner, admin, subscriber, none }

ChannelRole channelRoleFromString(String? value) {
  switch (value) {
    case ChannelsRemoteDataSource.roleOwner:
      return ChannelRole.owner;
    case ChannelsRemoteDataSource.roleAdmin:
      return ChannelRole.admin;
    case ChannelsRemoteDataSource.roleSubscriber:
      return ChannelRole.subscriber;
    default:
      return ChannelRole.none;
  }
}

/// Whether a role may broadcast posts into the channel.
bool channelRoleCanPost(ChannelRole role) =>
    role == ChannelRole.owner || role == ChannelRole.admin;

/// A single row in the channels list (discover or my-channels).
@immutable
class ChannelListItemView {
  const ChannelListItemView({
    required this.id,
    required this.name,
    required this.subscriberCount,
    required this.isSubscribed,
    required this.isVerified,
    this.handle,
    this.description,
    this.avatarUrl,
    this.previewLine = '',
    this.updatedAtMillis = 0,
  });

  final String id;
  final String name;

  /// `@slug` handle when present.
  final String? handle;
  final String? description;
  final String? avatarUrl;
  final int subscriberCount;
  final bool isSubscribed;
  final bool isVerified;

  /// Last-post preview or the channel description for the second row.
  final String previewLine;
  final int updatedAtMillis;

  String get initial {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return 'C';
    return trimmed.substring(0, 1).toUpperCase();
  }

  String get subscriberLabel => channelSubscriberLabel(subscriberCount);
}

/// The header + metadata for the channel view screen.
@immutable
class ChannelDetailView {
  const ChannelDetailView({
    required this.id,
    required this.name,
    required this.subscriberCount,
    required this.isSubscribed,
    required this.isVerified,
    required this.viewerRole,
    this.handle,
    this.description,
    this.avatarUrl,
    this.ownerId,
  });

  final String id;
  final String name;
  final String? handle;
  final String? description;
  final String? avatarUrl;
  final String? ownerId;
  final int subscriberCount;
  final bool isSubscribed;
  final bool isVerified;
  final ChannelRole viewerRole;

  bool get canPost => channelRoleCanPost(viewerRole);
  bool get isOwner => viewerRole == ChannelRole.owner;

  String get initial {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return 'C';
    return trimmed.substring(0, 1).toUpperCase();
  }

  String get subscriberLabel => channelSubscriberLabel(subscriberCount);

  ChannelDetailView copyWith({
    bool? isSubscribed,
    int? subscriberCount,
    ChannelRole? viewerRole,
  }) {
    return ChannelDetailView(
      id: id,
      name: name,
      handle: handle,
      description: description,
      avatarUrl: avatarUrl,
      ownerId: ownerId,
      subscriberCount: subscriberCount ?? this.subscriberCount,
      isSubscribed: isSubscribed ?? this.isSubscribed,
      isVerified: isVerified,
      viewerRole: viewerRole ?? this.viewerRole,
    );
  }
}

/// A single broadcast post in the channel feed.
@immutable
class ChannelPostView {
  const ChannelPostView({
    required this.id,
    required this.authorName,
    required this.body,
    required this.createdAtMillis,
    this.authorAvatarUrl,
    this.mediaUrl,
    this.mediaType,
    this.viewCount = 0,
    this.isFirstOfDay = false,
  });

  final String id;
  final String authorName;
  final String? authorAvatarUrl;
  final String body;
  final String? mediaUrl;
  final String? mediaType;
  final int viewCount;
  final int createdAtMillis;
  final bool isFirstOfDay;

  bool get hasMedia => mediaUrl != null && mediaUrl!.isNotEmpty;

  String get authorInitial {
    final trimmed = authorName.trim();
    if (trimmed.isEmpty) return 'C';
    return trimmed.substring(0, 1).toUpperCase();
  }
}

// ---------------------------------------------------------------------------
// Mappers (DTO -> view)
// ---------------------------------------------------------------------------

ChannelListItemView channelToListItem(RemoteChannel channel) {
  final preview = (channel.lastPostContent?.trim().isNotEmpty ?? false)
      ? channel.lastPostContent!.trim()
      : (channel.description?.trim() ?? '');
  return ChannelListItemView(
    id: channel.id,
    name: channel.name,
    handle: _handleFor(channel.slug),
    description: channel.description,
    avatarUrl: channel.avatarUrl,
    subscriberCount: channel.subscriberCount,
    isSubscribed: channel.isSubscribed,
    isVerified: channel.isVerified,
    previewLine: preview,
    updatedAtMillis:
        channel.lastPostCreatedAtMillis ?? channel.createdAtMillis,
  );
}

ChannelDetailView channelToDetail(RemoteChannel channel) {
  return ChannelDetailView(
    id: channel.id,
    name: channel.name,
    handle: _handleFor(channel.slug),
    description: channel.description,
    avatarUrl: channel.avatarUrl,
    ownerId: channel.ownerId,
    subscriberCount: channel.subscriberCount,
    isSubscribed: channel.isSubscribed,
    isVerified: channel.isVerified,
    viewerRole: channelRoleFromString(channel.viewerRole),
  );
}

/// Maps newest-first post DTOs into views. Rows are expected newest-first
/// (as returned by the data source); the `isFirstOfDay` flag marks the last
/// post of each calendar day so the feed can render a subtle day divider when
/// displayed oldest-to-newest.
List<ChannelPostView> channelPostsToViews(List<RemoteChannelPost> posts) {
  final views = <ChannelPostView>[];
  for (var i = 0; i < posts.length; i++) {
    final p = posts[i];
    // Because rows are newest-first, the "next older" row is i+1.
    final older = i < posts.length - 1 ? posts[i + 1] : null;
    final isFirstOfDay =
        older == null ||
        !channelIsSameDay(older.createdAtMillis, p.createdAtMillis);
    views.add(
      ChannelPostView(
        id: p.id,
        authorName: p.authorName,
        authorAvatarUrl: p.authorAvatarUrl,
        body: p.content,
        mediaUrl: p.mediaUrl,
        mediaType: p.mediaType,
        viewCount: p.viewCount,
        createdAtMillis: p.createdAtMillis,
        isFirstOfDay: isFirstOfDay,
      ),
    );
  }
  return views;
}

String? _handleFor(String? slug) {
  final trimmed = slug?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed.startsWith('@') ? trimmed : '@$trimmed';
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/// Compact subscriber count: "1 subscriber" / "12 subscribers" / "3.4K
/// subscribers" / "1.2M subscribers".
String channelSubscriberLabel(int count) {
  final formatted = channelCompactCount(count);
  final noun = count == 1 ? 'subscriber' : 'subscribers';
  return '$formatted $noun';
}

/// Compact number: 950 -> "950", 1200 -> "1.2K", 3_400_000 -> "3.4M".
String channelCompactCount(int count) {
  if (count < 1000) return '$count';
  if (count < 1000000) {
    final k = count / 1000;
    return '${_trim1(k)}K';
  }
  final m = count / 1000000;
  return '${_trim1(m)}M';
}

String _trim1(double value) {
  final rounded = (value * 10).round() / 10;
  if (rounded == rounded.roundToDouble()) return rounded.toStringAsFixed(0);
  return rounded.toStringAsFixed(1);
}

/// Compact "5m ago" / "2h" style relative time for list rows and post meta.
String channelRelativeTime(int millis) {
  final then = DateTime.fromMillisecondsSinceEpoch(millis);
  final diff = DateTime.now().difference(then);
  if (diff.isNegative) return 'now';
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays < 7) return '${diff.inDays}d';
  final weeks = (diff.inDays / 7).floor();
  if (weeks < 5) return '${weeks}w';
  return '${then.day}/${then.month}';
}

/// Whether two epoch-millis timestamps fall on the same calendar day.
bool channelIsSameDay(int aMillis, int bMillis) {
  final a = DateTime.fromMillisecondsSinceEpoch(aMillis);
  final b = DateTime.fromMillisecondsSinceEpoch(bMillis);
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

/// A day-separator label for the feed: "Today" / "Yesterday" / "Month D, YYYY".
String channelDateHeader(int millis) {
  final date = DateTime.fromMillisecondsSinceEpoch(millis);
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final thatDay = DateTime(date.year, date.month, date.day);
  final deltaDays = today.difference(thatDay).inDays;
  if (deltaDays == 0) return 'Today';
  if (deltaDays == 1) return 'Yesterday';
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  final month = months[date.month - 1];
  return '$month ${date.day}, ${date.year}';
}
