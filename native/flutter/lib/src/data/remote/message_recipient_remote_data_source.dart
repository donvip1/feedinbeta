import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/messages/message_recipient.dart';

class MessageRecipientRemoteDataSource {
  const MessageRecipientRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<List<MessageRecipient>> searchRecipients(String query) async {
    final normalized = query.trim().replaceFirst(RegExp('^@'), '');
    if (!isConfigured || normalized.length < 2) return const [];

    final currentUserId = Supabase.instance.client.auth.currentUser?.id;
    final rows = await Supabase.instance.client
        .from('public_profiles')
        .select('id, username, display_name, avatar_url')
        .or('username.ilike.%$normalized%,display_name.ilike.%$normalized%')
        .limit(12);

    return rows
        .whereType<Map>()
        .map((row) => MessageRecipient.fromJson(Map<String, Object?>.from(row)))
        .where((recipient) => recipient.userId != currentUserId)
        .toList();
  }

  Future<String?> createServerConversation(String otherUserId) async {
    if (!isConfigured) return null;

    final serverConversationId = await Supabase.instance.client.rpc<String?>(
      'create_conversation',
      params: {'other_user_id': otherUserId},
    );
    return serverConversationId?.toString();
  }
}
