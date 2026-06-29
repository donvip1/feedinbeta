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

    final rows = await Supabase.instance.client
        .from('messages')
        .select(
          'id, conversation_id, sender_id, content, message_type, status, is_read, read_at, created_at, profiles(display_name, username, avatar_url)',
        )
        .eq('conversation_id', serverConversationId)
        .order('created_at');

    return rows
        .whereType<Map>()
        .map((row) => RemoteMessage.fromJson(Map<String, Object?>.from(row)))
        .toList();
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

  factory RemoteMessage.fromJson(Map<String, Object?> json) {
    final profile = json['profiles'];
    final profileMap = profile is Map
        ? Map<String, Object?>.from(profile)
        : null;
    final displayName = profileMap?['display_name']?.toString();
    final username = profileMap?['username']?.toString();

    return RemoteMessage(
      id: json['id'].toString(),
      serverConversationId: json['conversation_id'].toString(),
      senderId: json['sender_id'].toString(),
      senderName: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn user',
      senderAvatarUrl: profileMap?['avatar_url']?.toString(),
      body: json['content']?.toString() ?? '',
      createdAtMillis: _parseMillis(json['created_at']),
      deliveryStateName: _deliveryState(json),
      messageType: json['message_type']?.toString() ?? 'text',
      readAtMillis: _parseNullableMillis(json['read_at']),
    );
  }
}

String _deliveryState(Map<String, Object?> json) {
  final status = json['status']?.toString();
  final isRead = json['is_read'] == true || status == 'read';
  if (isRead) return 'read';
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
