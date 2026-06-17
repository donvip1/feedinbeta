import '../../features/messages/message_models.dart';

abstract interface class LocalMessagesRepositoryContract {
  Future<List<ConversationSummary>> loadConversations();
  Future<ConversationSummary?> loadConversation(String conversationId);
  Future<List<LocalMessage>> loadMessages(String conversationId);
  Future<List<LocalMessage>> loadPendingMessages();
  Future<void> queueMessage({
    required String conversationId,
    required String senderName,
    required String body,
  });
  Future<void> markMessageState({
    required String messageId,
    required MessageDeliveryState deliveryState,
  });
  Future<void> markConversationSynced({
    required String conversationId,
    required String serverConversationId,
  });
}
