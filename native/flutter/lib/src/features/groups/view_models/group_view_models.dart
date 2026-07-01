import 'package:flutter/foundation.dart';

import '../data/group_models.dart';

/// UI-facing, immutable view-models for the groups feature. Widgets take these
/// (+ callbacks) and never read Supabase directly. The screen layer maps the
/// remote DTOs (`data/group_models.dart`) into these views.

/// Coarse presence state for a member dot.
enum GroupPresence { online, activeNow, away, offline }

GroupPresence groupPresenceFromString(String? value) {
  switch (value) {
    case 'online':
      return GroupPresence.online;
    case 'active_now':
      return GroupPresence.activeNow;
    case 'away':
      return GroupPresence.away;
    default:
      return GroupPresence.offline;
  }
}

bool groupPresenceShowsDot(GroupPresence presence) =>
    presence == GroupPresence.online || presence == GroupPresence.activeNow;

/// A member's de-facto role. There is no role column server-side, so only the
/// earliest joiner is surfaced as [owner]; everyone else is [member].
enum GroupRole { owner, member }

String groupRoleLabel(GroupRole role) =>
    role == GroupRole.owner ? 'Owner' : 'Member';

/// One row in the groups list.
@immutable
class GroupListItemView {
  const GroupListItemView({
    required this.conversationId,
    required this.title,
    required this.memberCount,
    required this.updatedAtMillis,
    this.lastMessagePreview = '',
    this.lastMessageSenderName,
    this.unreadCount = 0,
    this.avatarInitial = 'G',
  });

  final String conversationId;
  final String title;
  final int memberCount;
  final int updatedAtMillis;
  final String lastMessagePreview;
  final String? lastMessageSenderName;
  final int unreadCount;
  final String avatarInitial;

  bool get hasUnread => unreadCount > 0;

  /// "You: hi" / "Alex: hey" style preview line, or a neutral placeholder.
  String get previewLine {
    if (lastMessagePreview.trim().isEmpty) {
      return '$memberCount members';
    }
    final sender = lastMessageSenderName;
    if (sender != null && sender.isNotEmpty) {
      return '$sender: $lastMessagePreview';
    }
    return lastMessagePreview;
  }
}

/// A single member row in the members sheet.
@immutable
class GroupMemberView {
  const GroupMemberView({
    required this.userId,
    required this.displayName,
    required this.role,
    required this.presence,
    this.username,
    this.avatarUrl,
    this.isMe = false,
  });

  final String userId;
  final String displayName;
  final GroupRole role;
  final GroupPresence presence;
  final String? username;
  final String? avatarUrl;
  final bool isMe;

  String get initial {
    final trimmed = displayName.trim();
    if (trimmed.isEmpty) return '?';
    return trimmed.substring(0, 1).toUpperCase();
  }
}

/// A single message in the group room.
@immutable
class GroupMessageView {
  const GroupMessageView({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAtMillis,
    required this.isMine,
    this.senderAvatarUrl,
    this.isFirstInGroup = true,
    this.isLastInGroup = true,
  });

  final String id;
  final String senderId;
  final String senderName;
  final String body;
  final int createdAtMillis;
  final bool isMine;
  final String? senderAvatarUrl;
  final bool isFirstInGroup;
  final bool isLastInGroup;

  String get senderInitial {
    final trimmed = senderName.trim();
    if (trimmed.isEmpty) return '?';
    return trimmed.substring(0, 1).toUpperCase();
  }
}

/// One broadcast channel row inside a group (Telegram-style).
@immutable
class GroupChannelView {
  const GroupChannelView({
    required this.name,
    required this.updatedAtMillis,
    this.lastPostPreview = '',
    this.lastPostSenderName,
    this.postCount = 0,
  });

  final String name;
  final int updatedAtMillis;
  final String lastPostPreview;
  final String? lastPostSenderName;
  final int postCount;

  String get initial {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '#';
    return trimmed.substring(0, 1).toUpperCase();
  }

  /// "Alex: latest post" / "No posts yet" style preview line.
  String get previewLine {
    if (lastPostPreview.trim().isEmpty) {
      return postCount == 0 ? 'No posts yet' : '$postCount posts';
    }
    final sender = lastPostSenderName;
    if (sender != null && sender.isNotEmpty) {
      return '$sender: $lastPostPreview';
    }
    return lastPostPreview;
  }
}

/// One post inside a channel view.
@immutable
class GroupChannelPostView {
  const GroupChannelPostView({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAtMillis,
    required this.isMine,
    this.senderAvatarUrl,
  });

  final String id;
  final String senderId;
  final String senderName;
  final String body;
  final int createdAtMillis;
  final bool isMine;
  final String? senderAvatarUrl;

  String get senderInitial {
    final trimmed = senderName.trim();
    if (trimmed.isEmpty) return '?';
    return trimmed.substring(0, 1).toUpperCase();
  }
}

/// A search result row in the add-members picker.
@immutable
class GroupCandidateView {
  const GroupCandidateView({
    required this.userId,
    required this.displayName,
    this.username,
    this.avatarUrl,
    this.isSelected = false,
  });

  final String userId;
  final String displayName;
  final String? username;
  final String? avatarUrl;
  final bool isSelected;

  String get initial {
    final trimmed = displayName.trim();
    if (trimmed.isEmpty) return '?';
    return trimmed.substring(0, 1).toUpperCase();
  }

  GroupCandidateView copyWith({bool? isSelected}) {
    return GroupCandidateView(
      userId: userId,
      displayName: displayName,
      username: username,
      avatarUrl: avatarUrl,
      isSelected: isSelected ?? this.isSelected,
    );
  }
}

// ---------------------------------------------------------------------------
// Mappers (DTO -> view)
// ---------------------------------------------------------------------------

GroupListItemView groupToListItem(RemoteGroup group) {
  final title = group.displayName;
  return GroupListItemView(
    conversationId: group.conversationId,
    title: title,
    memberCount: group.memberCount,
    updatedAtMillis: group.updatedAtMillis,
    lastMessagePreview: group.lastMessageContent ?? '',
    lastMessageSenderName: group.lastMessageSenderName,
    unreadCount: group.unreadCount,
    avatarInitial: title.trim().isEmpty
        ? 'G'
        : title.trim().substring(0, 1).toUpperCase(),
  );
}

GroupMemberView groupMemberToView(
  RemoteGroupMember member, {
  required String currentUserId,
}) {
  final display =
      member.displayName ??
      (member.username != null ? '@${member.username}' : 'Member');
  return GroupMemberView(
    userId: member.userId,
    displayName: display,
    username: member.username,
    avatarUrl: member.avatarUrl,
    role: member.isCreator ? GroupRole.owner : GroupRole.member,
    presence: groupPresenceFromString(member.presence),
    isMe: member.userId == currentUserId,
  );
}

/// Maps ordered (oldest-first) DTOs into views, computing the run-grouping
/// flags used to collapse consecutive messages from the same sender.
List<GroupMessageView> groupMessagesToViews(
  List<RemoteGroupMessage> messages, {
  required String currentUserId,
}) {
  final views = <GroupMessageView>[];
  for (var i = 0; i < messages.length; i++) {
    final m = messages[i];
    final prev = i > 0 ? messages[i - 1] : null;
    final next = i < messages.length - 1 ? messages[i + 1] : null;

    final isFirst = prev == null || prev.senderId != m.senderId;
    final isLast = next == null || next.senderId != m.senderId;

    views.add(
      GroupMessageView(
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        senderAvatarUrl: m.senderAvatarUrl,
        body: m.body,
        createdAtMillis: m.createdAtMillis,
        isMine: m.senderId == currentUserId,
        isFirstInGroup: isFirst,
        isLastInGroup: isLast,
      ),
    );
  }
  return views;
}

GroupCandidateView candidateToView(RemoteGroupCandidate candidate) {
  return GroupCandidateView(
    userId: candidate.userId,
    displayName:
        candidate.displayName ??
        (candidate.username != null ? '@${candidate.username}' : 'User'),
    username: candidate.username,
    avatarUrl: candidate.avatarUrl,
  );
}

GroupChannelView groupChannelToView(RemoteGroupChannel channel) {
  return GroupChannelView(
    name: channel.name,
    updatedAtMillis: channel.updatedAtMillis,
    lastPostPreview: channel.lastPostBody ?? '',
    lastPostSenderName: channel.lastPostSenderName,
    postCount: channel.postCount,
  );
}

GroupChannelPostView groupChannelPostToView(
  RemoteGroupChannelPost post, {
  required String currentUserId,
}) {
  return GroupChannelPostView(
    id: post.id,
    senderId: post.senderId,
    senderName: post.senderName,
    senderAvatarUrl: post.senderAvatarUrl,
    body: post.body,
    createdAtMillis: post.createdAtMillis,
    isMine: post.senderId == currentUserId,
  );
}

/// Compact "5m ago" / "2h" style relative time for list rows and bubbles.
String groupRelativeTime(int millis) {
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

/// Clock time (HH:MM) for message bubbles.
String groupClockTime(int millis) {
  final t = DateTime.fromMillisecondsSinceEpoch(millis);
  final h = t.hour.toString().padLeft(2, '0');
  final m = t.minute.toString().padLeft(2, '0');
  return '$h:$m';
}

/// Whether two epoch-millis timestamps fall on the same calendar day.
bool groupIsSameDay(int aMillis, int bMillis) {
  final a = DateTime.fromMillisecondsSinceEpoch(aMillis);
  final b = DateTime.fromMillisecondsSinceEpoch(bMillis);
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

/// A day-separator label for the message list (web `formatDateHeader`):
/// "Today" / "Yesterday" / "Month D, YYYY".
String groupDateHeader(int millis) {
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
