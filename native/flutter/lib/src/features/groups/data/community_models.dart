class CommunitySummary {
  const CommunitySummary({
    required this.id,
    required this.name,
    required this.description,
    required this.createdBy,
    required this.isPrivate,
    required this.isPremium,
    required this.memberCount,
    required this.postCount,
    required this.inviteCode,
    required this.updatedAtMillis,
    this.avatarUrl,
    this.coverUrl,
    this.viewerRole,
    this.joinRequestPending = false,
  });

  final String id;
  final String name;
  final String description;
  final String createdBy;
  final bool isPrivate;
  final bool isPremium;
  final int memberCount;
  final int postCount;
  final String inviteCode;
  final int updatedAtMillis;
  final String? avatarUrl;
  final String? coverUrl;
  final String? viewerRole;
  final bool joinRequestPending;

  bool get isMember => viewerRole != null;
  bool get canManage =>
      viewerRole == 'owner' ||
      viewerRole == 'admin' ||
      viewerRole == 'moderator';
}

class CommunityMember {
  const CommunityMember({
    required this.userId,
    required this.role,
    required this.joinedAtMillis,
    required this.displayName,
    this.username,
    this.avatarUrl,
  });

  final String userId;
  final String role;
  final int joinedAtMillis;
  final String displayName;
  final String? username;
  final String? avatarUrl;
}

class CommunityMessage {
  const CommunityMessage({
    required this.id,
    required this.groupId,
    required this.senderId,
    required this.senderName,
    required this.content,
    required this.createdAtMillis,
    this.senderAvatarUrl,
    this.mediaUrl,
    this.mediaType,
    this.fileName,
  });

  final String id;
  final String groupId;
  final String senderId;
  final String senderName;
  final String content;
  final int createdAtMillis;
  final String? senderAvatarUrl;
  final String? mediaUrl;
  final String? mediaType;
  final String? fileName;
}

class CommunityJoinRequest {
  const CommunityJoinRequest({
    required this.id,
    required this.requesterId,
    required this.displayName,
    required this.estimatedCost,
    required this.createdAtMillis,
    this.username,
    this.avatarUrl,
  });

  final String id;
  final String requesterId;
  final String displayName;
  final String? username;
  final String? avatarUrl;
  final int estimatedCost;
  final int createdAtMillis;
}

enum CommunityJoinResult { joined, requested }

int communityMillis(Object? value) {
  return DateTime.tryParse(value?.toString() ?? '')?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

int communityInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
