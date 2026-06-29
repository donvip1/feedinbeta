import '../../features/messages/message_models.dart';

abstract interface class LocalMessagesRepositoryContract {
  Future<List<ConversationSummary>> loadConversations();
  Future<ConversationSummary?> loadConversation(String conversationId);
  Future<ConversationSummary?> loadConversationByServerId(
    String serverConversationId,
  );
  Future<ConversationSummary> createConversation({required String title});
  Future<void> upsertConversation(ConversationSummary conversation);
  Future<List<LocalMessage>> loadMessages(String conversationId);
  Future<List<LocalMessage>> loadPendingMessages();
  Future<void> upsertMessage(LocalMessage message);
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
  Future<void> markConversationRead(String conversationId);
}
