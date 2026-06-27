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
          'id, conversation_id, sender_id, content, status, created_at, profiles(display_name, username)',
        )
        .eq('conversation_id', serverConversationId)
        .order('created_at');

    return rows
        .whereType<Map>()
        .map((row) => RemoteMessage.fromJson(Map<String, Object?>.from(row)))
        .toList();
  }
}

class RemoteConversation {
  const RemoteConversation({
    required this.serverConversationId,
    required this.title,
    required this.lastMessagePreview,
    required this.updatedAtMillis,
    required this.unreadCount,
  });

  final String serverConversationId;
  final String title;
  final String lastMessagePreview;
  final int updatedAtMillis;
  final int unreadCount;

  factory RemoteConversation.fromJson(Map<String, Object?> json) {
    final displayName = json['other_user_display_name']?.toString();
    final username = json['other_user_username']?.toString();
    final updatedAt = json['last_message_created_at'] ?? json['updated_at'];

    return RemoteConversation(
      serverConversationId: json['conversation_id'].toString(),
      title: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn chat',
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
  });

  final String id;
  final String serverConversationId;
  final String senderId;
  final String senderName;
  final String body;
  final int createdAtMillis;
  final String deliveryStateName;

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
      body: json['content']?.toString() ?? '',
      createdAtMillis: _parseMillis(json['created_at']),
      deliveryStateName: json['status']?.toString() ?? 'delivered',
    );
  }
}

int _parseMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  return parsed?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}
