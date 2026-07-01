/// Remote DTOs for the Telegram-style Channels feature.
///
/// BACKEND MODEL (important — these tables DO NOT yet exist in the applied
/// migrations; see the data-source header and the module report for the exact
/// flagged schema). A "channel" is a one-to-many broadcast surface: an
/// admin/owner posts, and subscribers read. It is intentionally distinct from
/// `conversations` (group chat) which is many-to-many.
///
/// Assumed tables the DTOs decode:
///   * `channels(id, owner_id, name, slug, description, avatar_url,
///      is_verified, subscriber_count, created_at, updated_at)`
///   * `channel_subscribers(channel_id, user_id, role, created_at)`
///      where `role` in ('owner','admin','subscriber')
///   * `channel_posts(id, channel_id, author_id, content, media_url,
///      media_type, view_count, created_at)`
///
/// These DTOs decode the raw Supabase rows into typed values; the view-model
/// layer maps them into the immutable UI views consumed by the widgets.
library;

/// Parses a timestamp-ish value into epoch millis, defaulting to "now".
int parseChannelMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  return parsed?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

/// Parses an int-ish value, defaulting to [fallback].
int parseChannelInt(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

/// Parses a bool-ish value (handles Postgres `true`/`false` and 1/0).
bool parseChannelBool(Object? value) {
  if (value is bool) return value;
  final text = value?.toString().toLowerCase();
  return text == 'true' || text == 't' || text == '1';
}

/// One channel summary row for the discover / my-channels lists and header.
class RemoteChannel {
  const RemoteChannel({
    required this.id,
    required this.name,
    required this.subscriberCount,
    required this.createdAtMillis,
    this.slug,
    this.description,
    this.avatarUrl,
    this.ownerId,
    this.isVerified = false,
    this.isSubscribed = false,
    this.viewerRole,
    this.lastPostContent,
    this.lastPostCreatedAtMillis,
  });

  final String id;

  /// The channel's owner (creator) user id. Used to decide whether the viewer
  /// may compose broadcast posts.
  final String? ownerId;

  final String name;

  /// URL-ish handle (e.g. `@feedin_news`). NULL when the backend has no slug.
  final String? slug;

  final String? description;
  final String? avatarUrl;

  final int subscriberCount;

  /// Whether this channel carries a verified tick.
  final bool isVerified;

  /// Whether the current viewer is subscribed (drives the Join/Leave toggle).
  final bool isSubscribed;

  /// The viewer's membership role in this channel: 'owner' | 'admin' |
  /// 'subscriber' | null (not a member). Only owner/admin may post.
  final String? viewerRole;

  final int createdAtMillis;

  /// Preview of the most recent broadcast post, for the list rows.
  final String? lastPostContent;
  final int? lastPostCreatedAtMillis;

  RemoteChannel copyWith({
    bool? isSubscribed,
    String? viewerRole,
    int? subscriberCount,
  }) {
    return RemoteChannel(
      id: id,
      ownerId: ownerId,
      name: name,
      slug: slug,
      description: description,
      avatarUrl: avatarUrl,
      subscriberCount: subscriberCount ?? this.subscriberCount,
      isVerified: isVerified,
      isSubscribed: isSubscribed ?? this.isSubscribed,
      viewerRole: viewerRole ?? this.viewerRole,
      createdAtMillis: createdAtMillis,
      lastPostContent: lastPostContent,
      lastPostCreatedAtMillis: lastPostCreatedAtMillis,
    );
  }

  factory RemoteChannel.fromJson(
    Map<String, Object?> json, {
    bool isSubscribed = false,
    String? viewerRole,
    String? lastPostContent,
    int? lastPostCreatedAtMillis,
  }) {
    return RemoteChannel(
      id: json['id'].toString(),
      ownerId: json['owner_id']?.toString(),
      name: json['name']?.toString() ?? 'Channel',
      slug: json['slug']?.toString(),
      description: json['description']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
      subscriberCount: parseChannelInt(json['subscriber_count']),
      isVerified: parseChannelBool(json['is_verified']),
      isSubscribed: isSubscribed,
      viewerRole: viewerRole,
      createdAtMillis: parseChannelMillis(json['created_at']),
      lastPostContent: lastPostContent,
      lastPostCreatedAtMillis: lastPostCreatedAtMillis,
    );
  }
}

/// One broadcast post row inside a channel's feed.
class RemoteChannelPost {
  const RemoteChannelPost({
    required this.id,
    required this.channelId,
    required this.authorId,
    required this.authorName,
    required this.content,
    required this.createdAtMillis,
    this.authorAvatarUrl,
    this.mediaUrl,
    this.mediaType,
    this.viewCount = 0,
  });

  final String id;
  final String channelId;
  final String authorId;
  final String authorName;
  final String? authorAvatarUrl;
  final String content;
  final String? mediaUrl;
  final String? mediaType;
  final int viewCount;
  final int createdAtMillis;

  factory RemoteChannelPost.fromJson(Map<String, Object?> json) {
    final profile = json['profiles'] ?? json['author'];
    final profileMap = profile is Map
        ? Map<String, Object?>.from(profile)
        : null;
    final displayName = profileMap?['display_name']?.toString();
    final username = profileMap?['username']?.toString();

    return RemoteChannelPost(
      id: json['id'].toString(),
      channelId: json['channel_id'].toString(),
      authorId: json['author_id'].toString(),
      authorName: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn',
      authorAvatarUrl: profileMap?['avatar_url']?.toString(),
      content: json['content']?.toString() ?? '',
      mediaUrl: json['media_url']?.toString(),
      mediaType: json['media_type']?.toString(),
      viewCount: parseChannelInt(json['view_count']),
      createdAtMillis: parseChannelMillis(json['created_at']),
    );
  }
}
