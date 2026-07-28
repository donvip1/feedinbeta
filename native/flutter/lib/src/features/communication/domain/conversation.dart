/// The one conversation abstraction spanning every surface. What differs
/// between a DM, a group, a community, a broadcast channel, a support thread,
/// and an AI chat is [type] + [policy] + roles — not a separate code stack.
enum ConversationType {
  dm,
  group,
  community,
  channel,
  broadcast,
  support,
  ai;

  bool get isMultiParty => this != ConversationType.dm;

  /// Broadcast/channel are read-mostly: only privileged roles post.
  bool get isBroadcastStyle =>
      this == ConversationType.broadcast || this == ConversationType.channel;
}

enum MemberRole {
  owner,
  admin,
  member,
  guest,
  subscriber;

  bool get isPrivileged => this == owner || this == admin;
}

/// Who may do what in a conversation. Enforced server-side too; this mirror lets
/// the client gate UI without a round-trip and keeps the rules in one testable
/// place.
class ConversationPolicy {
  const ConversationPolicy({
    this.membersCanPost = true,
    this.membersCanCall = true,
    this.membersCanInvite = false,
    this.maxCallParticipants = 8,
  });

  final bool membersCanPost;
  final bool membersCanCall;
  final bool membersCanInvite;
  final int maxCallParticipants;

  static const ConversationPolicy dmDefault = ConversationPolicy();
  static const ConversationPolicy groupDefault = ConversationPolicy(
    membersCanInvite: true,
    maxCallParticipants: 8,
  );

  /// Broadcast/channel: only privileged roles post; anyone may still call if
  /// allowed. Subscribers are read-only for posting.
  static const ConversationPolicy broadcastDefault = ConversationPolicy(
    membersCanPost: false,
    membersCanCall: false,
    membersCanInvite: false,
  );

  bool canPost(MemberRole role) =>
      role.isPrivileged || (membersCanPost && role != MemberRole.subscriber);

  bool canStartCall(MemberRole role) => role.isPrivileged || membersCanCall;

  bool canInvite(MemberRole role) => role.isPrivileged || membersCanInvite;

  Map<String, Object?> toJson() => {
    'membersCanPost': membersCanPost,
    'membersCanCall': membersCanCall,
    'membersCanInvite': membersCanInvite,
    'maxCallParticipants': maxCallParticipants,
  };

  factory ConversationPolicy.fromJson(Map<String, Object?>? json) =>
      json == null
      ? ConversationPolicy.dmDefault
      : ConversationPolicy(
          membersCanPost: json['membersCanPost'] != false,
          membersCanCall: json['membersCanCall'] != false,
          membersCanInvite: json['membersCanInvite'] == true,
          maxCallParticipants:
              (json['maxCallParticipants'] as num?)?.toInt() ?? 8,
        );
}

class Conversation {
  const Conversation({
    required this.id,
    required this.type,
    required this.memberIds,
    this.roles = const {},
    this.policy = ConversationPolicy.dmDefault,
    this.title,
    this.e2ee = false,
    this.pinnedMessageIds = const [],
    this.lastMessageAt,
    this.avatarUrl,
    this.lastMessagePreview,
    this.unreadCount = 0,
  });

  final String id;
  final ConversationType type;
  final List<String> memberIds;

  /// userId -> role. A member absent from this map defaults to [MemberRole.member].
  final Map<String, MemberRole> roles;
  final ConversationPolicy policy;
  final String? title;
  final bool e2ee;
  final List<String> pinnedMessageIds;
  final int? lastMessageAt;

  /// Inbox presentation state (kept on the conversation per the design's
  /// `unreadState`): tile avatar, last-message preview, unread badge.
  final String? avatarUrl;
  final String? lastMessagePreview;
  final int unreadCount;

  MemberRole roleOf(String userId) => roles[userId] ?? MemberRole.member;

  bool isMember(String userId) => memberIds.contains(userId);

  bool canPost(String userId) =>
      isMember(userId) && policy.canPost(roleOf(userId));

  bool canStartCall(String userId) =>
      isMember(userId) && policy.canStartCall(roleOf(userId));

  bool canInvite(String userId) =>
      isMember(userId) && policy.canInvite(roleOf(userId));

  /// The other participant in a DM (from [me]'s perspective), or null.
  String? dmPeer(String me) {
    if (type != ConversationType.dm) return null;
    for (final id in memberIds) {
      if (id != me) return id;
    }
    return null;
  }

  Conversation copyWith({
    Map<String, MemberRole>? roles,
    ConversationPolicy? policy,
    String? title,
    bool? e2ee,
    List<String>? pinnedMessageIds,
    int? lastMessageAt,
    List<String>? memberIds,
    String? avatarUrl,
    String? lastMessagePreview,
    int? unreadCount,
  }) {
    return Conversation(
      id: id,
      type: type,
      memberIds: memberIds ?? this.memberIds,
      roles: roles ?? this.roles,
      policy: policy ?? this.policy,
      title: title ?? this.title,
      e2ee: e2ee ?? this.e2ee,
      pinnedMessageIds: pinnedMessageIds ?? this.pinnedMessageIds,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }

  Map<String, Object?> toJson() => {
    'id': id,
    'type': type.name,
    'memberIds': memberIds,
    'roles': roles.map((k, v) => MapEntry(k, v.name)),
    'policy': policy.toJson(),
    if (title != null) 'title': title,
    'e2ee': e2ee,
    if (pinnedMessageIds.isNotEmpty) 'pinnedMessageIds': pinnedMessageIds,
    if (lastMessageAt != null) 'lastMessageAt': lastMessageAt,
    if (avatarUrl != null) 'avatarUrl': avatarUrl,
    if (lastMessagePreview != null) 'lastMessagePreview': lastMessagePreview,
    if (unreadCount != 0) 'unreadCount': unreadCount,
  };

  factory Conversation.fromJson(Map<String, Object?> json) => Conversation(
    id: json['id']?.toString() ?? '',
    type: ConversationType.values.firstWhere(
      (t) => t.name == json['type'],
      orElse: () => ConversationType.dm,
    ),
    memberIds:
        (json['memberIds'] as List?)?.map((e) => e.toString()).toList() ??
        const [],
    roles: ((json['roles'] as Map?)?.cast<String, Object?>() ?? const {}).map(
      (k, v) => MapEntry(
        k,
        MemberRole.values.firstWhere(
          (r) => r.name == v,
          orElse: () => MemberRole.member,
        ),
      ),
    ),
    policy: ConversationPolicy.fromJson(
      (json['policy'] as Map?)?.cast<String, Object?>(),
    ),
    title: json['title']?.toString(),
    e2ee: json['e2ee'] == true,
    pinnedMessageIds:
        (json['pinnedMessageIds'] as List?)
            ?.map((e) => e.toString())
            .toList() ??
        const [],
    lastMessageAt: (json['lastMessageAt'] as num?)?.toInt(),
    avatarUrl: json['avatarUrl']?.toString(),
    lastMessagePreview: json['lastMessagePreview']?.toString(),
    unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
  );
}
