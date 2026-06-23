import '../../data/local/local_messages_repository_contract.dart';
import '../../data/remote/message_recipient_remote_data_source.dart';
import '../../features/messages/message_models.dart';
import '../../features/messages/message_recipient.dart';

class ConversationStarter {
  const ConversationStarter({
    required MessageRecipientRemoteDataSource recipientRemoteDataSource,
    required LocalMessagesRepositoryContract messagesRepository,
  }) : _recipientRemoteDataSource = recipientRemoteDataSource,
       _messagesRepository = messagesRepository;

  final MessageRecipientRemoteDataSource _recipientRemoteDataSource;
  final LocalMessagesRepositoryContract _messagesRepository;

  Future<List<MessageRecipient>> searchRecipients(String query) {
    return _recipientRemoteDataSource.searchRecipients(query);
  }

  Future<ConversationSummary> startConversation({
    required MessageRecipient recipient,
  }) async {
    final serverConversationId = await _recipientRemoteDataSource
        .createServerConversation(recipient.userId);

    if (serverConversationId == null || serverConversationId.isEmpty) {
      return _messagesRepository.createConversation(
        title: recipient.displayName,
      );
    }

    final existing = await _messagesRepository.loadConversationByServerId(
      serverConversationId,
    );
    if (existing != null) return existing;

    final conversation = ConversationSummary(
      id: serverConversationId,
      title: recipient.displayName,
      lastMessagePreview: 'Tap to send your first message.',
      updatedAtMillis: DateTime.now().millisecondsSinceEpoch,
      pendingCount: 0,
      serverConversationId: serverConversationId,
    );
    await _messagesRepository.upsertConversation(conversation);
    return conversation;
  }
}
