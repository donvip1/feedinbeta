import '../../data/local/local_messages_repository_contract.dart';
import '../../data/remote/messages_remote_data_source.dart';
import '../../features/messages/message_models.dart';

class MessageMaterializer {
  const MessageMaterializer({
    required MessagesRemoteDataSource remoteDataSource,
    required LocalMessagesRepositoryContract messagesRepository,
  }) : _remoteDataSource = remoteDataSource,
       _messagesRepository = messagesRepository;

  final MessagesRemoteDataSource _remoteDataSource;
  final LocalMessagesRepositoryContract _messagesRepository;

  Future<MessageMaterializeSummary> refreshAll() async {
    final conversations = await _remoteDataSource.fetchConversations();
    var conversationsSaved = 0;
    var messagesSaved = 0;

    for (final remoteConversation in conversations) {
      final localConversation = await _upsertConversation(remoteConversation);
      conversationsSaved++;

      final remoteMessages = await _remoteDataSource.fetchMessages(
        remoteConversation.serverConversationId,
      );
      for (final remoteMessage in remoteMessages) {
        await _messagesRepository.upsertMessage(
          LocalMessage(
            id: remoteMessage.id,
            conversationId: localConversation.id,
            senderName: remoteMessage.senderName,
            senderId: remoteMessage.senderId,
            senderAvatarUrl: remoteMessage.senderAvatarUrl,
            body: remoteMessage.body,
            createdAtMillis: remoteMessage.createdAtMillis,
            deliveryState: _deliveryState(remoteMessage.deliveryStateName),
            messageType: remoteMessage.messageType,
            readAtMillis: remoteMessage.readAtMillis,
            readByUserId: remoteMessage.readByUserId,
            mediaUrl: remoteMessage.mediaUrl,
            thumbnailUrl: remoteMessage.thumbnailUrl,
            mimeType: remoteMessage.mimeType,
            fileName: remoteMessage.fileName,
            fileSizeBytes: remoteMessage.fileSizeBytes,
            durationMs: remoteMessage.durationMs,
            viewOnce: remoteMessage.viewOnce,
            expiresAtMillis: remoteMessage.expiresAtMillis,
            viewOnceSeenAtMillis: remoteMessage.viewOnceSeenAtMillis,
          ),
        );
        messagesSaved++;
      }
    }

    return MessageMaterializeSummary(
      conversationsSaved: conversationsSaved,
      messagesSaved: messagesSaved,
    );
  }

  Future<ConversationSummary> _upsertConversation(
    RemoteConversation remoteConversation,
  ) async {
    final existing = await _messagesRepository.loadConversationByServerId(
      remoteConversation.serverConversationId,
    );
    final conversation =
        existing?.copyWith(
          title: remoteConversation.title,
          lastMessagePreview: remoteConversation.lastMessagePreview,
          updatedAtMillis: remoteConversation.updatedAtMillis,
          pendingCount: remoteConversation.unreadCount,
          serverConversationId: remoteConversation.serverConversationId,
          otherUserId: remoteConversation.otherUserId,
          otherUserAvatarUrl: remoteConversation.otherUserAvatarUrl,
          otherUserPresence: remoteConversation.otherUserPresence,
          otherUserLastSeenAtMillis:
              remoteConversation.otherUserLastSeenAtMillis,
          disappearingSeconds: remoteConversation.disappearingSeconds,
        ) ??
        ConversationSummary(
          id: remoteConversation.serverConversationId,
          title: remoteConversation.title,
          lastMessagePreview: remoteConversation.lastMessagePreview,
          updatedAtMillis: remoteConversation.updatedAtMillis,
          pendingCount: remoteConversation.unreadCount,
          serverConversationId: remoteConversation.serverConversationId,
          otherUserId: remoteConversation.otherUserId,
          otherUserAvatarUrl: remoteConversation.otherUserAvatarUrl,
          otherUserPresence: remoteConversation.otherUserPresence,
          otherUserLastSeenAtMillis:
              remoteConversation.otherUserLastSeenAtMillis,
          disappearingSeconds: remoteConversation.disappearingSeconds,
        );
    await _messagesRepository.upsertConversation(conversation);
    return conversation;
  }

  MessageDeliveryState _deliveryState(String status) {
    return MessageDeliveryState.values.firstWhere(
      (state) => state.name == status,
      orElse: () => MessageDeliveryState.delivered,
    );
  }
}

class MessageMaterializeSummary {
  const MessageMaterializeSummary({
    required this.conversationsSaved,
    required this.messagesSaved,
  });

  final int conversationsSaved;
  final int messagesSaved;
}
