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
  }) {
    return Conversation(
      id: id,
      type: type,
      memberIds: memberIds,
      roles: roles ?? this.roles,
      policy: policy ?? this.policy,
      title: title ?? this.title,
      e2ee: e2ee ?? this.e2ee,
      pinnedMessageIds: pinnedMessageIds ?? this.pinnedMessageIds,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
    );
  }
}
