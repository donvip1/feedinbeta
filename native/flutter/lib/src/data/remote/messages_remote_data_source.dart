import 'package:supabase_flutter/supabase_flutter.dart';

class MessagesRemoteDataSource {
  const MessagesRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<List<RemoteConversation>> fetchConversations() async {
    if (!isConfigured) return const [];

    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return const [];

    final rows = await client.rpc<List<dynamic>>(
      'get_conversations_with_details',
      params: {'p_user_id': userId},
    );

    return rows
        .whereType<Map>()
        .map(
          (row) => RemoteConversation.fromJson(Map<String, Object?>.from(row)),
        )
        .toList();
  }

  Future<List<RemoteMessage>> fetchMessages(String serverConversationId) async {
    if (!isConfigured) return const [];

    final client = Supabase.instance.client;
    final viewerId = client.auth.currentUser?.id;

    // IMPORTANT: select ONLY columns that exist on the live `messages` table
    // (id, conversation_id, sender_id, content, message_type, status,
    // created_at). Selecting columns the table lacks (e.g. is_read / read_at /
    // metadata / message_attachments) raises a PostgREST schema-cache error and
    // breaks the whole conversation load. Read state is therefore derived from
    // the recipient's conversation_participants.last_read_at instead of a
    // per-message flag.
    final rows = await client
        .from('messages')
        .select(
          'id, conversation_id, sender_id, content, message_type, status, '
          'created_at, '
          'profiles!messages_sender_id_fkey(display_name, username, avatar_url)',
        )
        .eq('conversation_id', serverConversationId)
        .order('created_at');

    // The other participant's last_read_at: every message I sent at or before
    // this timestamp has been read by them. This drives the outgoing-bubble
    // read tick without needing a per-message read column on `messages`.
    final otherLastReadAtMillis = await _otherParticipantLastReadAtMillis(
      serverConversationId,
      viewerId,
    );

    return rows.whereType<Map>().map((row) {
      return RemoteMessage.fromJson(
        Map<String, Object?>.from(row),
        viewerId: viewerId,
        otherLastReadAtMillis: otherLastReadAtMillis,
      );
    }).toList();
  }

  /// Most-recent `last_read_at` (epoch millis) across every *other* participant
  /// of [serverConversationId], or null when none have read yet.
  Future<int?> _otherParticipantLastReadAtMillis(
    String serverConversationId,
    String? viewerId,
  ) async {
    try {
      final rows = await Supabase.instance.client
          .from('conversation_participants')
          .select('user_id, last_read_at')
          .eq('conversation_id', serverConversationId);

      int? latest;
      for (final row in rows.whereType<Map>()) {
        final userId = row['user_id']?.toString();
        if (userId == null || userId == viewerId) continue;
        final millis = _parseNullableMillis(row['last_read_at']);
        if (millis == null) continue;
        if (latest == null || millis > latest) latest = millis;
      }
      return latest;
    } catch (_) {
      // last_read_at is optional metadata; never let it break message loading.
      return null;
    }
  }

  Future<void> markConversationRead(String serverConversationId) async {
    if (!isConfigured) return;
    await Supabase.instance.client.rpc<void>(
      'mark_conversation_read',
      params: {'p_conversation_id': serverConversationId},
    );
  }

  Future<void> updatePresence(String status) async {
    if (!isConfigured) return;
    await Supabase.instance.client.rpc<void>(
      'update_presence',
      params: {'p_status': status},
    );
  }
}

class RemoteConversation {
  const RemoteConversation({
    required this.serverConversationId,
    required this.title,
    required this.lastMessagePreview,
    required this.updatedAtMillis,
    required this.unreadCount,
    this.otherUserId,
    this.otherUserAvatarUrl,
    this.otherUserPresence,
    this.otherUserLastSeenAtMillis,
  });

  final String serverConversationId;
  final String title;
  final String lastMessagePreview;
  final int updatedAtMillis;
  final int unreadCount;
  final String? otherUserId;
  final String? otherUserAvatarUrl;
  final String? otherUserPresence;
  final int? otherUserLastSeenAtMillis;

  factory RemoteConversation.fromJson(Map<String, Object?> json) {
    final displayName = json['other_user_display_name']?.toString();
    final username = json['other_user_username']?.toString();
    final updatedAt = json['last_message_created_at'] ?? json['updated_at'];

    return RemoteConversation(
      serverConversationId: json['conversation_id'].toString(),
      otherUserId: json['other_user_id']?.toString(),
      title: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn chat',
      otherUserAvatarUrl: json['other_user_avatar_url']?.toString(),
      otherUserPresence: json['other_user_presence']?.toString(),
      otherUserLastSeenAtMillis: _parseNullableMillis(
        json['other_user_last_seen_at'],
      ),
      lastMessagePreview:
          json['last_message_content']?.toString() ??
          'Tap to send your first message.',
      updatedAtMillis: _parseMillis(updatedAt),
      unreadCount: int.tryParse(json['unread_count']?.toString() ?? '0') ?? 0,
    );
  }
}

class RemoteMessage {
  const RemoteMessage({
    required this.id,
    required this.serverConversationId,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAtMillis,
    required this.deliveryStateName,
    this.senderAvatarUrl,
    this.messageType = 'text',
    this.readAtMillis,
    this.mediaUrl,
    this.thumbnailUrl,
    this.mimeType,
    this.fileName,
    this.fileSizeBytes,
  });

  final String id;
  final String serverConversationId;
  final String senderId;
  final String senderName;
  final String body;
  final int createdAtMillis;
  final String deliveryStateName;
  final String? senderAvatarUrl;
  final String messageType;
  final int? readAtMillis;

  // Media fields are part of the contract for forward-compatibility with the
  // `message_attachments` parity schema, but are always null when reading the
  // live `messages` table, which has no media columns (see fetchMessages).
  final String? mediaUrl;
  final String? thumbnailUrl;
  final String? mimeType;
  final String? fileName;
  final int? fileSizeBytes;

  factory RemoteMessage.fromJson(
    Map<String, Object?> json, {
    String? viewerId,
    int? otherLastReadAtMillis,
  }) {
    final profile = json['profiles'];
    final profileMap = profile is Map
        ? Map<String, Object?>.from(profile)
        : null;
    final displayName = profileMap?['display_name']?.toString();
    final username = profileMap?['username']?.toString();

    final senderId = json['sender_id'].toString();
    final createdAtMillis = _parseMillis(json['created_at']);
    final isMine = viewerId != null && senderId == viewerId;

    // Read state for MY outgoing messages: read once the other participant's
    // last_read_at is at/after this message's timestamp. Incoming messages keep
    // the server `status`, so they never show a (meaningless) "read" tick.
    int? readAtMillis;
    var deliveryStateName = _deliveryState(json);
    if (isMine &&
        otherLastReadAtMillis != null &&
        otherLastReadAtMillis >= createdAtMillis) {
      deliveryStateName = 'read';
      readAtMillis = otherLastReadAtMillis;
    }

    return RemoteMessage(
      id: json['id'].toString(),
      serverConversationId: json['conversation_id'].toString(),
      senderId: senderId,
      senderName: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn user',
      senderAvatarUrl: profileMap?['avatar_url']?.toString(),
      body: json['content']?.toString() ?? '',
      createdAtMillis: createdAtMillis,
      deliveryStateName: deliveryStateName,
      messageType: json['message_type']?.toString() ?? 'text',
      readAtMillis: readAtMillis,
    );
  }
}

/// Delivery state from the live `messages.status` column only. The live table
/// has no `is_read` column, so 'read' is inferred from status === 'read' (and,
/// for outgoing messages, the recipient's last_read_at in [RemoteMessage]).
String _deliveryState(Map<String, Object?> json) {
  final status = json['status']?.toString();
  if (status == 'read') return 'read';
  return status == null || status.isEmpty ? 'delivered' : status;
}

int _parseMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  return parsed?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

int? _parseNullableMillis(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}
