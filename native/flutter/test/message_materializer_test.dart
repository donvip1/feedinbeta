import 'package:feedin/src/core/sync/message_materializer.dart';
import 'package:feedin/src/data/local/local_messages_repository_contract.dart';
import 'package:feedin/src/data/remote/messages_remote_data_source.dart';
import 'package:feedin/src/features/messages/message_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('materializes disappearing timer onto local conversations', () async {
    final repository = _MemoryMessagesRepository();
    final materializer = MessageMaterializer(
      remoteDataSource: const _FakeMessagesRemoteDataSource(
        conversations: [
          RemoteConversation(
            serverConversationId: 'conversation-1',
            title: 'Ada',
            lastMessagePreview: 'See you soon',
            updatedAtMillis: 10,
            unreadCount: 2,
            disappearingSeconds: 86400,
          ),
        ],
      ),
      messagesRepository: repository,
    );

    final summary = await materializer.refreshAll();

    expect(summary.conversationsSaved, 1);
    final saved = await repository.loadConversation('conversation-1');
    expect(saved?.disappearingSeconds, 86400);
    expect(saved?.pendingCount, 2);
  });

  test(
    'preserves existing local id while updating disappearing timer',
    () async {
      final repository = _MemoryMessagesRepository();
      await repository.upsertConversation(
        const ConversationSummary(
          id: 'local-conversation',
          title: 'Old title',
          lastMessagePreview: 'Old preview',
          updatedAtMillis: 1,
          pendingCount: 0,
          serverConversationId: 'server-conversation',
          disappearingSeconds: 0,
        ),
      );

      final materializer = MessageMaterializer(
        remoteDataSource: const _FakeMessagesRemoteDataSource(
          conversations: [
            RemoteConversation(
              serverConversationId: 'server-conversation',
              title: 'New title',
              lastMessagePreview: 'Updated preview',
              updatedAtMillis: 20,
              unreadCount: 0,
              disappearingSeconds: 604800,
            ),
          ],
        ),
        messagesRepository: repository,
      );

      await materializer.refreshAll();

      final saved = await repository.loadConversation('local-conversation');
      expect(saved?.serverConversationId, 'server-conversation');
      expect(saved?.title, 'New title');
      expect(saved?.disappearingSeconds, 604800);
      expect(await repository.loadConversation('server-conversation'), isNull);
    },
  );

  test('materializes outgoing read receipt metadata', () async {
    final repository = _MemoryMessagesRepository();
    final materializer = MessageMaterializer(
      remoteDataSource: const _FakeMessagesRemoteDataSource(
        conversations: [
          RemoteConversation(
            serverConversationId: 'conversation-1',
            title: 'Ada',
            lastMessagePreview: 'Seen',
            updatedAtMillis: 20,
            unreadCount: 0,
          ),
        ],
        messages: [
          RemoteMessage(
            id: 'message-1',
            serverConversationId: 'conversation-1',
            senderId: 'current-user',
            senderName: 'Me',
            body: 'Seen',
            createdAtMillis: 10,
            deliveryStateName: 'read',
            readAtMillis: 20,
            readByUserId: 'other-user',
          ),
        ],
      ),
      messagesRepository: repository,
    );

    final summary = await materializer.refreshAll();

    expect(summary.messagesSaved, 1);
    final saved = repository.messages['message-1'];
    expect(saved?.deliveryState, MessageDeliveryState.read);
    expect(saved?.readAtMillis, 20);
    expect(saved?.readByUserId, 'other-user');
  });
}

class _FakeMessagesRemoteDataSource implements MessagesRemoteDataSource {
  const _FakeMessagesRemoteDataSource({
    this.conversations = const [],
    this.messages = const [],
  });

  final List<RemoteConversation> conversations;
  final List<RemoteMessage> messages;

  @override
  bool get isConfigured => true;

  @override
  Future<List<RemoteConversation>> fetchConversations() async => conversations;

  @override
  Future<List<RemoteMessage>> fetchMessages(String serverConversationId) async {
    return messages
        .where(
          (message) => message.serverConversationId == serverConversationId,
        )
        .toList(growable: false);
  }

  @override
  Future<void> markConversationRead(String serverConversationId) async {}

  @override
  Future<void> updatePresence(String status) async {}
}

class _MemoryMessagesRepository implements LocalMessagesRepositoryContract {
  final Map<String, ConversationSummary> conversations = {};
  final Map<String, LocalMessage> messages = {};

  @override
  Future<ConversationSummary> createConversation({
    required String title,
  }) async {
    final conversation = ConversationSummary(
      id: 'local-${conversations.length + 1}',
      title: title,
      lastMessagePreview: 'Tap to send your first message.',
      updatedAtMillis: 0,
      pendingCount: 0,
    );
    conversations[conversation.id] = conversation;
    return conversation;
  }

  @override
  Future<List<ConversationSummary>> loadConversations() async {
    return conversations.values.toList(growable: false);
  }

  @override
  Future<ConversationSummary?> loadConversation(String conversationId) async {
    return conversations[conversationId];
  }

  @override
  Future<ConversationSummary?> loadConversationByServerId(
    String serverConversationId,
  ) async {
    for (final conversation in conversations.values) {
      if (conversation.serverConversationId == serverConversationId) {
        return conversation;
      }
    }
    return null;
  }

  @override
  Future<List<LocalMessage>> loadMessages(String conversationId) async {
    return messages.values
        .where((message) => message.conversationId == conversationId)
        .toList(growable: false);
  }

  @override
  Future<List<LocalMessage>> loadPendingMessages() async {
    return messages.values
        .where(
          (message) => message.deliveryState == MessageDeliveryState.pending,
        )
        .toList(growable: false);
  }

  @override
  Future<void> markConversationRead(String conversationId) async {
    final conversation = conversations[conversationId];
    if (conversation == null) return;
    conversations[conversationId] = conversation.copyWith(pendingCount: 0);
  }

  @override
  Future<void> markConversationSynced({
    required String conversationId,
    required String serverConversationId,
  }) async {
    final conversation = conversations[conversationId];
    if (conversation == null) return;
    conversations[conversationId] = conversation.copyWith(
      serverConversationId: serverConversationId,
    );
  }

  @override
  Future<void> markMessageState({
    required String messageId,
    required MessageDeliveryState deliveryState,
  }) async {
    final message = messages[messageId];
    if (message == null) return;
    messages[messageId] = message.copyWith(deliveryState: deliveryState);
  }

  @override
  Future<void> queueAttachment({
    required String conversationId,
    required String senderName,
    required String localPath,
    required String mediaType,
    String? mimeType,
    String? fileName,
    int? fileSizeBytes,
    bool viewOnce = false,
    int? expiresAtMillis,
  }) async {}

  @override
  Future<void> queueMessage({
    required String conversationId,
    required String senderName,
    required String body,
    String? senderId,
    String? senderAvatarUrl,
    int? expiresAtMillis,
  }) async {}

  @override
  Future<void> setConversationDisappearingSeconds({
    required String conversationId,
    required int seconds,
  }) async {
    final conversation = conversations[conversationId];
    if (conversation == null) return;
    conversations[conversationId] = conversation.copyWith(
      disappearingSeconds: seconds,
    );
  }

  @override
  Future<void> upsertConversation(ConversationSummary conversation) async {
    conversations[conversation.id] = conversation;
  }

  @override
  Future<void> upsertMessage(LocalMessage message) async {
    messages[message.id] = message;
  }
}
