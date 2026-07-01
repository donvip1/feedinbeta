/// Remote DTOs for the groups / message-rooms feature.
///
/// A "group" in the native backend is a **group conversation**: a row in the
/// `conversations` table that has 3+ participants in `conversation_participants`
/// (there is no dedicated `groups` table in the applied migrations — see the
/// module README notes / the data source header). These DTOs decode the raw
/// Supabase rows into typed values; the view-model layer maps them into the
/// immutable UI views consumed by the widgets.
library;

/// Parses a timestamp-ish value into epoch millis, defaulting to "now".
int parseGroupMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  return parsed?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

/// Parses a nullable timestamp-ish value into epoch millis (null when absent).
int? parseGroupNullableMillis(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}

/// One group-conversation summary row for the groups list.
class RemoteGroup {
  const RemoteGroup({
    required this.conversationId,
    required this.memberCount,
    required this.updatedAtMillis,
    required this.memberPreviews,
    this.name,
    this.lastMessageContent,
    this.lastMessageSenderName,
    this.lastMessageCreatedAtMillis,
    this.unreadCount = 0,
  });

  final String conversationId;

  /// Group display name. NULL when the backend has no name column yet (the
  /// current core schema has none); the UI then synthesises a name from the
  /// member previews. See [displayName].
  final String? name;

  final int memberCount;
  final int updatedAtMillis;

  /// A few member display names, newest-joined first, for the synthesised
  /// title and the avatar-stack fallback.
  final List<String> memberPreviews;

  final String? lastMessageContent;
  final String? lastMessageSenderName;
  final int? lastMessageCreatedAtMillis;
  final int unreadCount;

  /// Human title: the stored [name] when present, otherwise a comma-joined
  /// preview of member names (WhatsApp-style), otherwise a neutral fallback.
  String get displayName {
    final trimmed = name?.trim();
    if (trimmed != null && trimmed.isNotEmpty) return trimmed;
    if (memberPreviews.isNotEmpty) {
      final names = memberPreviews.take(3).join(', ');
      return names.isEmpty ? 'Group chat' : names;
    }
    return 'Group chat';
  }
}

/// One member row of a group conversation.
class RemoteGroupMember {
  const RemoteGroupMember({
    required this.userId,
    required this.joinedAtMillis,
    this.displayName,
    this.username,
    this.avatarUrl,
    this.presence,
    this.isCreator = false,
  });

  final String userId;
  final int joinedAtMillis;
  final String? displayName;
  final String? username;
  final String? avatarUrl;

  /// Coarse presence string from `user_presence.status` when available.
  final String? presence;

  /// Whether this member is the earliest joiner (treated as the group owner in
  /// the absence of a real role column — flagged as a backend gap).
  final bool isCreator;

  factory RemoteGroupMember.fromJson(
    Map<String, Object?> json, {
    bool isCreator = false,
  }) {
    final profile = json['profiles'] ?? json['profile'];
    final profileMap = profile is Map
        ? Map<String, Object?>.from(profile)
        : null;
    final presence = json['user_presence'];
    final presenceMap = presence is Map
        ? Map<String, Object?>.from(presence)
        : null;

    return RemoteGroupMember(
      userId: json['user_id'].toString(),
      joinedAtMillis: parseGroupMillis(json['created_at']),
      displayName: profileMap?['display_name']?.toString(),
      username: profileMap?['username']?.toString(),
      avatarUrl: profileMap?['avatar_url']?.toString(),
      presence: presenceMap?['status']?.toString(),
      isCreator: isCreator,
    );
  }
}

/// One message row inside a group conversation.
class RemoteGroupMessage {
  const RemoteGroupMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAtMillis,
    required this.status,
    this.senderAvatarUrl,
    this.messageType = 'text',
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final String? senderAvatarUrl;
  final String body;
  final int createdAtMillis;
  final String status;
  final String messageType;

  factory RemoteGroupMessage.fromJson(Map<String, Object?> json) {
    final profile = json['profiles'];
    final profileMap = profile is Map
        ? Map<String, Object?>.from(profile)
        : null;
    final displayName = profileMap?['display_name']?.toString();
    final username = profileMap?['username']?.toString();

    return RemoteGroupMessage(
      id: json['id'].toString(),
      conversationId: json['conversation_id'].toString(),
      senderId: json['sender_id'].toString(),
      senderName: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn user',
      senderAvatarUrl: profileMap?['avatar_url']?.toString(),
      body: json['content']?.toString() ?? '',
      createdAtMillis: parseGroupMillis(json['created_at']),
      status: json['status']?.toString() ?? 'sent',
      messageType: json['message_type']?.toString() ?? 'text',
    );
  }
}

/// A broadcast/announcement channel inside a group (Telegram-style).
///
/// BACKEND GAP: there is NO `channels` table (nor a `conversation_type` column)
/// in the applied native migrations, so a channel is modelled ENTIRELY on top of
/// the existing `messages` table of the group conversation — the same technique
/// the group *name* already uses (persisted as a message). Concretely:
///   * a `message_type = 'channel_meta'` row DECLARES a channel; its `content`
///     is the channel name.
///   * a `message_type = 'channel_post'` row is a POST to a channel; its
///     `content` is `"<channelName><body>"` (the U+0001 unit separator
///     keys the post to its channel without needing a foreign key column).
/// This keeps everything inside the group's RLS scope with no new tables/columns
/// and no client-side secrets. The recommended shared change is a real
/// `channels` table (+ `channel_id` on `messages`) — see the module report.
class RemoteGroupChannel {
  const RemoteGroupChannel({
    required this.name,
    required this.createdAtMillis,
    this.lastPostBody,
    this.lastPostSenderName,
    this.lastPostAtMillis,
    this.postCount = 0,
  });

  /// The channel's display name (unique within its group).
  final String name;
  final int createdAtMillis;
  final String? lastPostBody;
  final String? lastPostSenderName;
  final int? lastPostAtMillis;
  final int postCount;

  /// Most-recent activity (last post, else creation) for list ordering.
  int get updatedAtMillis => lastPostAtMillis ?? createdAtMillis;
}

/// A single post inside a channel (a decoded `channel_post` message).
class RemoteGroupChannelPost {
  const RemoteGroupChannelPost({
    required this.id,
    required this.channelName,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAtMillis,
    this.senderAvatarUrl,
  });

  final String id;
  final String channelName;
  final String senderId;
  final String senderName;
  final String? senderAvatarUrl;
  final String body;
  final int createdAtMillis;
}

/// The unit separator (U+0001) used to key a `channel_post` body to its channel
/// name: `"<channelName><body>"`. Chosen because it never appears in
/// user-typed text, so channel name / body split cleanly.
const String kChannelPostSeparator = '';

/// Encodes a channel post body for storage in `messages.content`.
String encodeChannelPostContent(String channelName, String body) =>
    '$channelName$kChannelPostSeparator$body';

/// Decodes a stored `channel_post` content into (channelName, body). Returns
/// null when the content is not a well-formed channel post.
({String channelName, String body})? decodeChannelPostContent(String content) {
  final idx = content.indexOf(kChannelPostSeparator);
  if (idx < 0) return null;
  return (
    channelName: content.substring(0, idx),
    body: content.substring(idx + 1),
  );
}

/// A searchable candidate user for the "add members" picker.
class RemoteGroupCandidate {
  const RemoteGroupCandidate({
    required this.userId,
    this.displayName,
    this.username,
    this.avatarUrl,
  });

  final String userId;
  final String? displayName;
  final String? username;
  final String? avatarUrl;

  factory RemoteGroupCandidate.fromJson(Map<String, Object?> json) {
    return RemoteGroupCandidate(
      userId: json['id'].toString(),
      displayName: json['display_name']?.toString(),
      username: json['username']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
    );
  }
}
