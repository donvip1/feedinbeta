import 'package:supabase_flutter/supabase_flutter.dart';

import 'group_models.dart';

/// Live backend access for the groups / message-rooms feature.
///
/// BACKEND MODEL (important): there is NO dedicated `groups` table in the
/// applied native migrations. A "group" is a **group conversation** — a row in
/// `public.conversations` that has 3+ rows in `public.conversation_participants`
/// (a 2-participant conversation is a 1:1 DM, owned by the messages feature).
/// Messages live in `public.messages` exactly as for DMs.
///
/// Because of that model, several things the web `groups/` components assume do
/// NOT exist server-side and are FLAGGED (see the module report):
///   * `conversations` has no `name` / `description` / `is_private` / `avatar`
///     columns, so group names are synthesised from member display names and a
///     locally-supplied name is dropped as the first system message instead.
///   * there are no member roles (`owner`/`admin`), so the earliest joiner is
///     treated as the de-facto owner for display only.
///   * the `create_conversation(other_user_id)` RPC is 1:1-only AND dedupes to
///     an existing shared conversation, so it is unusable for group creation —
///     this source inserts the conversation + participants directly (permitted
///     by the `conversations`/`conversation_participants` RLS insert policies).
///   * `get_conversations_with_details` assumes exactly one "other" participant
///     and would fan a group into N duplicate rows, so this source reads the
///     participant/message tables directly rather than via that RPC.
///
/// Every method degrades gracefully when Supabase is unconfigured or there is
/// no auth session: reads return empty, writes/creates become no-ops.
class GroupsRemoteDataSource {
  const GroupsRemoteDataSource({required this.isConfigured});

  /// Convenience factory for hosts that cannot see the app config: detects
  /// configuration from whether the Supabase singleton was initialised. Mirrors
  /// [SocialGraphRemoteDataSource.autoDetect].
  factory GroupsRemoteDataSource.autoDetect() {
    return GroupsRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  /// Minimum participant count for a conversation to count as a "group".
  static const int groupParticipantThreshold = 3;

  static bool _supabaseAvailable() {
    try {
      Supabase.instance.client;
      return true;
    } catch (_) {
      return false;
    }
  }

  SupabaseClient? get _client {
    if (!isConfigured) return null;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  String? get currentUserId => _client?.auth.currentUser?.id;

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /// Every group conversation the current user is a participant of, ordered by
  /// most-recent activity. Two round-trips: (1) the viewer's memberships +
  /// every co-participant (to size + name each group), (2) the latest message
  /// per conversation. Groups are conversations with >= [groupParticipantThreshold]
  /// participants; smaller ones are DMs and excluded.
  Future<List<RemoteGroup>> fetchGroups() async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return const [];

    // 1. The conversations I'm in.
    final myRows = await client
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

    final myConversationIds = <String>[];
    final lastReadByConversation = <String, int?>{};
    for (final row in myRows.whereType<Map>()) {
      final cid = row['conversation_id']?.toString();
      if (cid == null) continue;
      myConversationIds.add(cid);
      lastReadByConversation[cid] = parseGroupNullableMillis(
        row['last_read_at'],
      );
    }
    if (myConversationIds.isEmpty) return const [];

    // 2. All participants (with profile) of those conversations, so we can
    // count members, name the group, and identify the earliest joiner.
    final participantRows = await client
        .from('conversation_participants')
        .select(
          'conversation_id, user_id, created_at, '
          'profiles!conversation_participants_user_id_fkey('
          'display_name, username, avatar_url)',
        )
        .inFilter('conversation_id', myConversationIds)
        .order('created_at');

    final membersByConversation = <String, List<RemoteGroupMember>>{};
    for (final row in participantRows.whereType<Map>()) {
      final map = Map<String, Object?>.from(row);
      final cid = map['conversation_id']?.toString();
      if (cid == null) continue;
      (membersByConversation[cid] ??= <RemoteGroupMember>[]).add(
        RemoteGroupMember.fromJson(map),
      );
    }

    // Keep only true groups (>= threshold participants).
    final groupIds = membersByConversation.entries
        .where((e) => e.value.length >= groupParticipantThreshold)
        .map((e) => e.key)
        .toList();
    if (groupIds.isEmpty) return const [];

    // 3. Latest message per group conversation (single ordered read, then
    // reduce to the newest row per conversation client-side).
    final latestByConversation = await _latestMessagePerConversation(
      client,
      groupIds,
    );

    final groups = <RemoteGroup>[];
    for (final cid in groupIds) {
      final members = membersByConversation[cid]!;
      final previews = members
          .where((m) => m.userId != userId)
          .map((m) => m.displayName ?? m.username ?? 'Member')
          .toList();
      final latest = latestByConversation[cid];
      final lastRead = lastReadByConversation[cid];
      final unread = await _unreadCount(client, cid, userId, lastRead);

      groups.add(
        RemoteGroup(
          conversationId: cid,
          memberCount: members.length,
          updatedAtMillis:
              latest?.createdAtMillis ??
              members
                  .map((m) => m.joinedAtMillis)
                  .fold<int>(0, (a, b) => a > b ? a : b),
          memberPreviews: previews,
          lastMessageContent: latest?.body,
          lastMessageSenderName: latest?.senderName,
          lastMessageCreatedAtMillis: latest?.createdAtMillis,
          unreadCount: unread,
        ),
      );
    }

    groups.sort((a, b) => b.updatedAtMillis.compareTo(a.updatedAtMillis));
    return groups;
  }

  /// Members of one group conversation, joined to their profile + presence,
  /// ordered by join time (earliest first). The earliest joiner is flagged as
  /// the de-facto creator/owner (no role column exists).
  Future<List<RemoteGroupMember>> fetchMembers(String conversationId) async {
    final client = _client;
    if (client == null) return const [];

    final rows = await client
        .from('conversation_participants')
        .select(
          'user_id, created_at, '
          'profiles!conversation_participants_user_id_fkey('
          'display_name, username, avatar_url)',
        )
        .eq('conversation_id', conversationId)
        .order('created_at');

    final list = rows.whereType<Map>().toList();
    if (list.isEmpty) return const [];

    // Best-effort presence: one lookup for all member ids. Never fatal.
    final ids = [
      for (final row in list)
        if (row['user_id']?.toString() case final id?) id,
    ];
    final presenceById = await _presenceFor(client, ids);

    final members = <RemoteGroupMember>[];
    for (var i = 0; i < list.length; i++) {
      final map = Map<String, Object?>.from(list[i]);
      final base = RemoteGroupMember.fromJson(map, isCreator: i == 0);
      members.add(
        RemoteGroupMember(
          userId: base.userId,
          joinedAtMillis: base.joinedAtMillis,
          displayName: base.displayName,
          username: base.username,
          avatarUrl: base.avatarUrl,
          presence: presenceById[base.userId],
          isCreator: base.isCreator,
        ),
      );
    }
    return members;
  }

  /// All messages of a group conversation, oldest first (ready to render in a
  /// reversed list). Selects ONLY columns that exist on the live `messages`
  /// table to avoid PostgREST schema-cache errors (same constraint the messages
  /// feature documents).
  Future<List<RemoteGroupMessage>> fetchMessages(String conversationId) async {
    final client = _client;
    if (client == null) return const [];

    final rows = await client
        .from('messages')
        .select(
          'id, conversation_id, sender_id, content, message_type, status, '
          'created_at, '
          'profiles!messages_sender_id_fkey(display_name, username, avatar_url)',
        )
        .eq('conversation_id', conversationId)
        .order('created_at');

    return rows
        .whereType<Map>()
        .map(
          (row) =>
              RemoteGroupMessage.fromJson(Map<String, Object?>.from(row)),
        )
        .toList();
  }

  /// Search users to add as members (by username / display name), excluding the
  /// current user. Reuses the same `public_profiles` view the messages feature
  /// searches against.
  Future<List<RemoteGroupCandidate>> searchCandidates(String query) async {
    final client = _client;
    final normalized = query.trim().replaceFirst(RegExp('^@'), '');
    if (client == null || normalized.length < 2) return const [];

    final rows = await client
        .from('public_profiles')
        .select('id, username, display_name, avatar_url')
        .or('username.ilike.%$normalized%,display_name.ilike.%$normalized%')
        .limit(20);

    final me = currentUserId;
    return rows
        .whereType<Map>()
        .map(
          (row) =>
              RemoteGroupCandidate.fromJson(Map<String, Object?>.from(row)),
        )
        .where((c) => c.userId != me)
        .toList();
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /// Creates a new group conversation with the current user + [memberIds] as
  /// participants and returns the new conversation id.
  ///
  /// Direct inserts are used (NOT `create_conversation`, which is 1:1 and
  /// dedupes): one row into `conversations`, then a row per participant into
  /// `conversation_participants`. Both are permitted by the existing RLS insert
  /// policies (`auth.uid() is not null`).
  ///
  /// [name] is a client-supplied group name. Since `conversations` has no name
  /// column, the name is NOT persisted structurally; instead, when non-empty it
  /// is posted as the group's first message so it is at least visible in-thread.
  /// This is a documented backend gap — a real `name` column / RPC is the
  /// recommended shared change.
  Future<String?> createGroup({
    required List<String> memberIds,
    String? name,
  }) async {
    final client = _client;
    final me = currentUserId;
    if (client == null || me == null) return null;

    // Dedupe + drop self; require at least 2 others for a real group.
    final others = memberIds.toSet()..remove(me);
    if (others.length < 2) return null;

    final inserted = await client
        .from('conversations')
        .insert(<String, Object?>{})
        .select('id')
        .single();
    final conversationId = inserted['id']?.toString();
    if (conversationId == null) return null;

    final participantRows = <Map<String, Object?>>[
      {'conversation_id': conversationId, 'user_id': me},
      for (final id in others)
        {'conversation_id': conversationId, 'user_id': id},
    ];
    await client.from('conversation_participants').insert(participantRows);

    final trimmedName = name?.trim();
    if (trimmedName != null && trimmedName.isNotEmpty) {
      // Persist the chosen name as the opening message (no name column exists).
      await sendMessage(
        conversationId: conversationId,
        body: '$trimmedName group created',
      );
    }

    return conversationId;
  }

  /// Adds [memberIds] to an existing group conversation. Idempotent via the
  /// composite primary key (conversation_id, user_id).
  Future<void> addMembers({
    required String conversationId,
    required List<String> memberIds,
  }) async {
    final client = _client;
    if (client == null || memberIds.isEmpty) return;

    final rows = [
      for (final id in memberIds.toSet())
        {'conversation_id': conversationId, 'user_id': id},
    ];
    await client
        .from('conversation_participants')
        .upsert(
          rows,
          onConflict: 'conversation_id,user_id',
          ignoreDuplicates: true,
        );
  }

  /// Leaves a group by deleting the current user's participant row.
  ///
  /// BACKEND GAP: `conversation_participants` currently has SELECT + INSERT RLS
  /// policies but NO DELETE policy, so with RLS enabled this delete affects 0
  /// rows server-side (a silent no-op) — the row persists until a DELETE policy
  /// (`using (auth.uid() = user_id)`) is added. The UI still dismisses the room
  /// locally; the recommended shared change is that DELETE policy (or a
  /// `leave_conversation(uuid)` security-definer RPC).
  Future<void> leaveGroup(String conversationId) async {
    final client = _client;
    final me = currentUserId;
    if (client == null || me == null) return;

    await client
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', me);
  }

  /// Sends a text message into the group conversation as the current user.
  /// Returns the new message id (null when unconfigured / unauthenticated).
  Future<String?> sendMessage({
    required String conversationId,
    required String body,
    String messageType = 'text',
  }) async {
    final client = _client;
    final me = currentUserId;
    final trimmed = body.trim();
    if (client == null || me == null || trimmed.isEmpty) return null;

    final inserted = await client
        .from('messages')
        .insert({
          'conversation_id': conversationId,
          'sender_id': me,
          'content': trimmed,
          'message_type': messageType,
          'status': 'sent',
        })
        .select('id')
        .single();
    return inserted['id']?.toString();
  }

  /// Advances the current user's read position via the shared RPC. Best-effort.
  Future<void> markRead(String conversationId) async {
    final client = _client;
    if (client == null) return;
    try {
      await client.rpc<void>(
        'mark_conversation_read',
        params: {'p_conversation_id': conversationId},
      );
    } catch (_) {
      // Read receipts are optional metadata; never fatal to the room view.
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  Future<Map<String, RemoteGroupMessage>> _latestMessagePerConversation(
    SupabaseClient client,
    List<String> conversationIds,
  ) async {
    if (conversationIds.isEmpty) return const {};
    final rows = await client
        .from('messages')
        .select(
          'id, conversation_id, sender_id, content, message_type, status, '
          'created_at, '
          'profiles!messages_sender_id_fkey(display_name, username, avatar_url)',
        )
        .inFilter('conversation_id', conversationIds)
        .order('created_at', ascending: false);

    final latest = <String, RemoteGroupMessage>{};
    for (final row in rows.whereType<Map>()) {
      final message = RemoteGroupMessage.fromJson(
        Map<String, Object?>.from(row),
      );
      // Rows are newest-first, so the first seen per conversation is latest.
      latest.putIfAbsent(message.conversationId, () => message);
    }
    return latest;
  }

  Future<int> _unreadCount(
    SupabaseClient client,
    String conversationId,
    String userId,
    int? lastReadMillis,
  ) async {
    try {
      var query = client
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .neq('sender_id', userId);
      if (lastReadMillis != null) {
        final iso = DateTime.fromMillisecondsSinceEpoch(
          lastReadMillis,
        ).toUtc().toIso8601String();
        query = query.gt('created_at', iso);
      }
      final rows = await query;
      return rows.whereType<Map>().length;
    } catch (_) {
      return 0;
    }
  }

  Future<Map<String, String>> _presenceFor(
    SupabaseClient client,
    List<String> userIds,
  ) async {
    if (userIds.isEmpty) return const {};
    try {
      final rows = await client
          .from('user_presence')
          .select('user_id, status')
          .inFilter('user_id', userIds);
      return {
        for (final row in rows.whereType<Map>())
          if (row['user_id']?.toString() case final id?)
            id: row['status']?.toString() ?? 'offline',
      };
    } catch (_) {
      // Presence table may not exist on a core-only backend; treat as offline.
      return const {};
    }
  }
}
