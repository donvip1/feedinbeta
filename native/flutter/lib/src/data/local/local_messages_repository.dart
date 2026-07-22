import 'package:hive_ce/hive.dart';
import 'package:uuid/uuid.dart';

import '../../features/messages/message_models.dart';
import 'local_messages_repository_contract.dart';
import 'local_record_decoder.dart';

class LocalMessagesRepository implements LocalMessagesRepositoryContract {
  LocalMessagesRepository({
    required Box<Map> conversationsBox,
    required Box<Map> messagesBox,
    required bool seedDemoContent,
  }) : _conversationsBox = conversationsBox,
       _messagesBox = messagesBox,
       _seedDemoContent = seedDemoContent;

  final Box<Map> _conversationsBox;
  final Box<Map> _messagesBox;
  final bool _seedDemoContent;

  @override
  Future<List<ConversationSummary>> loadConversations() async {
    if (_seedDemoContent) {
      await _seedDemoConversationIfEmpty();
    } else {
      await _removeDemoConversation();
    }
    final conversations =
        _conversationsBox.values
            .map(
              (value) => decodeLocalRecord(value, ConversationSummary.fromJson),
            )
            .whereType<ConversationSummary>()
            .toList()
          ..sort((a, b) => b.updatedAtMillis.compareTo(a.updatedAtMillis));
    return conversations;
  }

  @override
  Future<ConversationSummary?> loadConversation(String conversationId) async {
    if (_seedDemoContent) {
      await _seedDemoConversationIfEmpty();
    }
    final raw = _conversationsBox.get(conversationId);
    if (raw == null) return null;
    return ConversationSummary.fromJson(Map<String, Object?>.from(raw));
  }

  @override
  Future<ConversationSummary?> loadConversationByServerId(
    String serverConversationId,
  ) async {
    if (_seedDemoContent) {
      await _seedDemoConversationIfEmpty();
    }
    for (final raw in _conversationsBox.values) {
      final conversation = ConversationSummary.fromJson(
        Map<String, Object?>.from(raw),
      );
      if (conversation.serverConversationId == serverConversationId) {
        return conversation;
      }
    }
    return null;
  }

  @override
  Future<ConversationSummary> createConversation({
    required String title,
  }) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final conversation = ConversationSummary(
      id: const Uuid().v4(),
      title: title.trim().isEmpty ? 'New chat' : title.trim(),
      lastMessagePreview: 'Tap to send your first message.',
      updatedAtMillis: now,
      pendingCount: 0,
    );
    await _conversationsBox.put(conversation.id, conversation.toJson());
    return conversation;
  }

  @override
  Future<void> upsertConversation(ConversationSummary conversation) async {
    await _conversationsBox.put(conversation.id, conversation.toJson());
  }

  @override
  Future<List<LocalMessage>> loadMessages(String conversationId) async {
    if (_seedDemoContent) {
      await _seedDemoConversationIfEmpty();
    }
    final messages =
        _messagesBox.values
            .map((value) => decodeLocalRecord(value, LocalMessage.fromJson))
            .whereType<LocalMessage>()
            .where((message) => message.conversationId == conversationId)
            .toList()
          ..sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));
    return messages;
  }

  @override
  Future<List<LocalMessage>> loadPendingMessages() async {
    final messages =
        _messagesBox.values
            .map((value) => decodeLocalRecord(value, LocalMessage.fromJson))
            .whereType<LocalMessage>()
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
  Future<void> upsertMessage(LocalMessage message) async {
    final currentRaw = _messagesBox.get(message.id);
    final current = currentRaw == null
        ? null
        : decodeLocalRecord(currentRaw, LocalMessage.fromJson);
    final merged =
        message.localMediaPath == null && current?.localMediaPath != null
        ? message.copyWith(localMediaPath: current!.localMediaPath)
        : message;
    await _messagesBox.put(merged.id, merged.toJson());

    final raw = _conversationsBox.get(merged.conversationId);
    if (raw == null) return;

    final conversation = ConversationSummary.fromJson(
      Map<String, Object?>.from(raw),
    );
    if (merged.createdAtMillis < conversation.updatedAtMillis) return;

    await _conversationsBox.put(
      conversation.id,
      conversation
          .copyWith(
            lastMessagePreview: merged.body,
            updatedAtMillis: merged.createdAtMillis,
          )
          .toJson(),
    );
  }

  @override
  Future<void> queueMessage({
    required String conversationId,
    required String senderName,
    required String body,
    String? senderId,
    String? senderAvatarUrl,
    String? replyToId,
    int? expiresAtMillis,
  }) async {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final message = LocalMessage(
      id: const Uuid().v4(),
      conversationId: conversationId,
      senderName: senderName,
      senderId: senderId,
      senderAvatarUrl: senderAvatarUrl,
      replyToId: replyToId,
      body: trimmed,
      createdAtMillis: now,
      deliveryState: MessageDeliveryState.pending,
      expiresAtMillis: expiresAtMillis,
    );

    await _messagesBox.put(message.id, message.toJson());

    final current = _conversationsBox.get(conversationId);
    final currentSummary = current == null
        ? null
        : ConversationSummary.fromJson(Map<String, Object?>.from(current));

    final updatedSummary =
        (currentSummary ??
                ConversationSummary(
                  id: conversationId,
                  title: 'New chat',
                  lastMessagePreview: trimmed,
                  updatedAtMillis: now,
                  pendingCount: 0,
                ))
            .copyWith(lastMessagePreview: trimmed, updatedAtMillis: now);

    await _conversationsBox.put(conversationId, updatedSummary.toJson());
  }

  @override
  Future<void> queueAttachment({
    required String conversationId,
    required String senderName,
    required String localPath,
    required String mediaType,
    String? senderId,
    String? senderAvatarUrl,
    String? mimeType,
    String? fileName,
    int? fileSizeBytes,
    String? caption,
    bool viewOnce = false,
    int? expiresAtMillis,
  }) async {
    if (localPath.trim().isEmpty) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final kind = mediaType.trim().isEmpty ? 'file' : mediaType.trim();
    final trimmedCaption = caption?.trim();
    final message = LocalMessage(
      id: const Uuid().v4(),
      conversationId: conversationId,
      senderName: senderName,
      senderId: senderId,
      senderAvatarUrl: senderAvatarUrl,
      body: trimmedCaption != null && trimmedCaption.isNotEmpty
          ? trimmedCaption
          : (viewOnce ? 'Photo · View once' : _attachmentPreview(kind)),
      createdAtMillis: now,
      deliveryState: MessageDeliveryState.pending,
      messageType: kind,
      localMediaPath: localPath,
      mimeType: mimeType,
      fileName: fileName,
      fileSizeBytes: fileSizeBytes,
      viewOnce: viewOnce,
      expiresAtMillis: expiresAtMillis,
    );

    await _messagesBox.put(message.id, message.toJson());

    final current = _conversationsBox.get(conversationId);
    final currentSummary = current == null
        ? null
        : ConversationSummary.fromJson(Map<String, Object?>.from(current));
    final updatedSummary =
        (currentSummary ??
                ConversationSummary(
                  id: conversationId,
                  title: 'New chat',
                  lastMessagePreview: message.body,
                  updatedAtMillis: now,
                  pendingCount: 0,
                ))
            .copyWith(lastMessagePreview: message.body, updatedAtMillis: now);
    await _conversationsBox.put(conversationId, updatedSummary.toJson());
  }

  String _attachmentPreview(String mediaType) {
    return switch (mediaType) {
      'image' => 'Photo',
      'video' => 'Video',
      'audio' => 'Voice message',
      _ => 'Attachment',
    };
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

  @override
  Future<void> setConversationDisappearingSeconds({
    required String conversationId,
    required int seconds,
  }) async {
    final raw = _conversationsBox.get(conversationId);
    if (raw == null) return;

    final conversation = ConversationSummary.fromJson(
      Map<String, Object?>.from(raw),
    );
    await _conversationsBox.put(
      conversationId,
      conversation
          .copyWith(disappearingSeconds: seconds < 0 ? 0 : seconds)
          .toJson(),
    );
  }

  @override
  Future<void> markConversationRead(String conversationId) async {
    final raw = _conversationsBox.get(conversationId);
    if (raw != null) {
      final conversation = ConversationSummary.fromJson(
        Map<String, Object?>.from(raw),
      );
      await _conversationsBox.put(
        conversationId,
        conversation.copyWith(pendingCount: 0).toJson(),
      );
    }

    // Do not fake per-message read receipts locally. Real read state is
    // materialized from Supabase after `mark_conversation_read` runs remotely.
  }

  Future<void> _seedDemoConversationIfEmpty() async {
    if (_conversationsBox.isNotEmpty) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    const conversation = ConversationSummary(
      id: 'demo-conversation',
      title: 'feedIn Support',
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
      senderName: 'feedIn Support',
      body: conversation.lastMessagePreview,
      createdAtMillis: now,
      deliveryState: MessageDeliveryState.delivered,
    );

    await _conversationsBox.put(conversation.id, seededConversation.toJson());
    await _messagesBox.put(message.id, message.toJson());
  }

  Future<void> _removeDemoConversation() async {
    await _conversationsBox.delete('demo-conversation');
    await _messagesBox.delete('demo-message');
  }
}
