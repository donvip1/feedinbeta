import 'package:hive_ce/hive.dart';
import 'package:uuid/uuid.dart';

import '../../features/messages/message_models.dart';
import 'local_messages_repository_contract.dart';

class LocalMessagesRepository implements LocalMessagesRepositoryContract {
  LocalMessagesRepository({
    required Box<Map> conversationsBox,
    required Box<Map> messagesBox,
  }) : _conversationsBox = conversationsBox,
       _messagesBox = messagesBox;

  final Box<Map> _conversationsBox;
  final Box<Map> _messagesBox;

  @override
  Future<List<ConversationSummary>> loadConversations() async {
    await _seedDemoConversationIfEmpty();
    final conversations =
        _conversationsBox.values
            .map(
              (value) => ConversationSummary.fromJson(
                Map<String, Object?>.from(value),
              ),
            )
            .toList()
          ..sort((a, b) => b.updatedAtMillis.compareTo(a.updatedAtMillis));
    return conversations;
  }

  @override
  Future<ConversationSummary?> loadConversation(String conversationId) async {
    await _seedDemoConversationIfEmpty();
    final raw = _conversationsBox.get(conversationId);
    if (raw == null) return null;
    return ConversationSummary.fromJson(Map<String, Object?>.from(raw));
  }

  @override
  Future<List<LocalMessage>> loadMessages(String conversationId) async {
    await _seedDemoConversationIfEmpty();
    final messages =
        _messagesBox.values
            .map(
              (value) =>
                  LocalMessage.fromJson(Map<String, Object?>.from(value)),
            )
            .where((message) => message.conversationId == conversationId)
            .toList()
          ..sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));
    return messages;
  }

  @override
  Future<List<LocalMessage>> loadPendingMessages() async {
    final messages =
        _messagesBox.values
            .map(
              (value) =>
                  LocalMessage.fromJson(Map<String, Object?>.from(value)),
            )
            .where(
              (message) =>
                  message.deliveryState == MessageDeliveryState.pending ||
                  message.deliveryState == MessageDeliveryState.failed,
            )
            .toList()
          ..sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));
    return messages;
  }

  @override
  Future<void> queueMessage({
    required String conversationId,
    required String senderName,
    required String body,
  }) async {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final message = LocalMessage(
      id: const Uuid().v4(),
      conversationId: conversationId,
      senderName: senderName,
      body: trimmed,
      createdAtMillis: now,
      deliveryState: MessageDeliveryState.pending,
    );

    await _messagesBox.put(message.id, message.toJson());

    final current = _conversationsBox.get(conversationId);
    final currentSummary = current == null
        ? null
        : ConversationSummary.fromJson(Map<String, Object?>.from(current));

    final updatedSummary = ConversationSummary(
      id: conversationId,
      title: currentSummary?.title ?? 'New chat',
      lastMessagePreview: trimmed,
      updatedAtMillis: now,
      pendingCount: (currentSummary?.pendingCount ?? 0) + 1,
      serverConversationId: currentSummary?.serverConversationId,
    );

    await _conversationsBox.put(conversationId, updatedSummary.toJson());
  }

  @override
  Future<void> markMessageState({
    required String messageId,
    required MessageDeliveryState deliveryState,
  }) async {
    final raw = _messagesBox.get(messageId);
    if (raw == null) return;

    final message = LocalMessage.fromJson(Map<String, Object?>.from(raw));
    await _messagesBox.put(
      messageId,
      message.copyWith(deliveryState: deliveryState).toJson(),
    );
  }

  @override
  Future<void> markConversationSynced({
    required String conversationId,
    required String serverConversationId,
  }) async {
    final raw = _conversationsBox.get(conversationId);
    if (raw == null) return;

    final conversation = ConversationSummary.fromJson(
      Map<String, Object?>.from(raw),
    );
    await _conversationsBox.put(
      conversationId,
      conversation
          .copyWith(serverConversationId: serverConversationId, pendingCount: 0)
          .toJson(),
    );
  }

  Future<void> _seedDemoConversationIfEmpty() async {
    if (_conversationsBox.isNotEmpty) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    const conversation = ConversationSummary(
      id: 'demo-conversation',
      title: 'FEEDIN Support',
      lastMessagePreview: 'Messages are now stored locally first.',
      updatedAtMillis: 0,
      pendingCount: 0,
    );

    final seededConversation = ConversationSummary(
      id: conversation.id,
      title: conversation.title,
      lastMessagePreview: conversation.lastMessagePreview,
      updatedAtMillis: now,
      pendingCount: conversation.pendingCount,
    );

    final message = LocalMessage(
      id: 'demo-message',
      conversationId: conversation.id,
      senderName: 'FEEDIN Support',
      body: conversation.lastMessagePreview,
      createdAtMillis: now,
      deliveryState: MessageDeliveryState.delivered,
    );

    await _conversationsBox.put(conversation.id, seededConversation.toJson());
    await _messagesBox.put(message.id, message.toJson());
  }
}
