import 'dart:async';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/local/local_messages_repository_contract.dart';
import '../../data/local/pending_action.dart';
import '../../data/local/pending_action_repository.dart';
import '../../features/messages/message_models.dart';
import 'message_materializer.dart';

abstract interface class SyncServiceContract {
  Future<SyncSummary> syncNow();
}

class SyncService implements SyncServiceContract {
  const SyncService({
    required bool isConfigured,
    required PendingActionRepository pendingActionRepository,
    required LocalMessagesRepositoryContract messagesRepository,
    required MessageMaterializer messageMaterializer,
  }) : _isConfigured = isConfigured,
       _pendingActionRepository = pendingActionRepository,
       _messagesRepository = messagesRepository,
       _messageMaterializer = messageMaterializer;

  final bool _isConfigured;
  final PendingActionRepository _pendingActionRepository;
  final LocalMessagesRepositoryContract _messagesRepository;
  final MessageMaterializer _messageMaterializer;

  @override
  Future<SyncSummary> syncNow() async {
    if (!_isConfigured) {
      return const SyncSummary(
        attempted: false,
        feedActionsSynced: 0,
        messagesSynced: 0,
        message: 'Supabase is not configured. Items remain queued locally.',
      );
    }

    var feedActionsSynced = 0;
    var messagesSynced = 0;
    var remoteConversationsPulled = 0;
    var remoteMessagesPulled = 0;

    final actions = await _pendingActionRepository.loadPendingActions();
    for (final action in actions) {
      try {
        await _replayFeedAction(action);
        await _pendingActionRepository.deleteAction(action.id);
        feedActionsSynced++;
      } catch (_) {
        await _pendingActionRepository.incrementRetry(action.id);
      }
    }

    final pendingMessages = await _messagesRepository.loadPendingMessages();
    for (final message in pendingMessages) {
      try {
        await _replayMessage(message);
        await _messagesRepository.markMessageState(
          messageId: message.id,
          deliveryState: MessageDeliveryState.sent,
        );
        messagesSynced++;
      } catch (_) {
        await _messagesRepository.markMessageState(
          messageId: message.id,
          deliveryState: MessageDeliveryState.failed,
        );
      }
    }

    try {
      final materializeSummary = await _messageMaterializer.refreshAll();
      remoteConversationsPulled = materializeSummary.conversationsSaved;
      remoteMessagesPulled = materializeSummary.messagesSaved;
    } catch (_) {
      // Remote pull should never block replaying already queued local actions.
    }

    return SyncSummary(
      attempted: true,
      feedActionsSynced: feedActionsSynced,
      messagesSynced: messagesSynced,
      remoteConversationsPulled: remoteConversationsPulled,
      remoteMessagesPulled: remoteMessagesPulled,
      message: 'Sync complete.',
    );
  }

  Future<void> _replayFeedAction(PendingAction action) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      throw const AuthException('User must be signed in before sync.');
    }

    switch (action.type) {
      case PendingActionType.likePost:
        await client.from('post_likes').upsert({
          ...action.payload,
          'user_id': userId,
        });
      case PendingActionType.savePost:
        await client.from('saved_posts').upsert({
          ...action.payload,
          'user_id': userId,
        });
      case PendingActionType.commentOnPost:
        await client.from('post_comments').insert({
          ...action.payload,
          'user_id': userId,
        });
      case PendingActionType.refeedPost:
        await client.from('posts').insert({
          'user_id': userId,
          'original_post_id': action.payload['post_id'],
          'content': '',
          'post_type': 'refeed',
          'status': 'active',
        });
      case PendingActionType.sharePost:
        await client.from('post_shares').insert({
          ...action.payload,
          'user_id': userId,
        });
    }
  }

  Future<void> _replayMessage(LocalMessage message) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      throw const AuthException('User must be signed in before sync.');
    }

    final serverConversationId = await _ensureServerConversation(
      localConversationId: message.conversationId,
      userId: userId,
    );

    final hasAttachment =
        message.localMediaPath != null && message.localMediaPath!.isNotEmpty;
    final inserted = await client
        .from('messages')
        .insert({
          'id': message.id,
          'conversation_id': serverConversationId,
          'sender_id': userId,
          'content': hasAttachment ? _attachmentCaption(message) : message.body,
          'message_type': hasAttachment ? message.messageType : 'text',
          if (message.replyToId != null) 'reply_to_id': message.replyToId,
          'status': 'sent',
          'created_at': DateTime.fromMillisecondsSinceEpoch(
            message.createdAtMillis,
          ).toIso8601String(),
          // Ephemeral message flags (view-once / disappearing timer).
          if (message.viewOnce) 'view_once': true,
          if (message.expiresAtMillis != null)
            'expires_at': DateTime.fromMillisecondsSinceEpoch(
              message.expiresAtMillis!,
            ).toUtc().toIso8601String(),
        })
        .select('id')
        .single();

    if (hasAttachment) {
      await _uploadMessageAttachment(
        client: client,
        userId: userId,
        serverConversationId: serverConversationId,
        messageId: inserted['id'].toString(),
        message: message,
      );
    }

    // Notify the other participants' native devices via the server-owned
    // data-only push (rich, grouped message notification with inline reply).
    // Best-effort: a push hiccup must never fail or retry the message replay.
    unawaited(_sendMessagePush(client, inserted['id'].toString()));
  }

  String? _attachmentCaption(LocalMessage message) {
    final body = message.body.trim();
    if (body.isEmpty ||
        body == 'Photo' ||
        body == 'Video' ||
        body == 'Voice message' ||
        body == 'Attachment' ||
        body == 'Photo · View once') {
      return null;
    }
    return body;
  }

  Future<void> _sendMessagePush(SupabaseClient client, String messageId) async {
    try {
      await client.functions.invoke(
        'send-message-push',
        body: {'message_id': messageId},
      );
    } catch (_) {
      // ignore — non-critical
    }
  }

  Future<void> _uploadMessageAttachment({
    required SupabaseClient client,
    required String userId,
    required String serverConversationId,
    required String messageId,
    required LocalMessage message,
  }) async {
    final localPath = message.localMediaPath;
    if (localPath == null || localPath.isEmpty) return;

    final file = File(localPath);
    if (!file.existsSync()) {
      throw StateError('Message attachment file no longer exists.');
    }

    final extension = localPath.contains('.')
        ? localPath.split('.').last
        : 'bin';
    final storagePath =
        '$serverConversationId/$userId/${DateTime.now().millisecondsSinceEpoch}_${message.id}.$extension';
    await client.storage
        .from('message-media')
        .upload(
          storagePath,
          file,
          fileOptions: FileOptions(
            contentType:
                message.mimeType ??
                _messageContentType(extension, message.messageType),
            upsert: true,
          ),
        );

    await client.from('message_attachments').insert({
      'message_id': messageId,
      'conversation_id': serverConversationId,
      'sender_id': userId,
      'storage_bucket': 'message-media',
      'storage_path': storagePath,
      'public_url': client.storage
          .from('message-media')
          .getPublicUrl(storagePath),
      'file_name': message.fileName,
      'file_size_bytes': message.fileSizeBytes,
      'mime_type': message.mimeType,
      'media_type': message.messageType,
    });
  }

  String _messageContentType(String extension, String mediaType) {
    switch (extension.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
      case 'aac':
        return 'audio/aac';
      case 'mp3':
        return 'audio/mpeg';
      case 'm4a':
        return 'audio/mp4';
      case 'ogg':
        return 'audio/ogg';
      case 'pdf':
        return 'application/pdf';
      default:
        return mediaType == 'video' ? 'video/mp4' : 'image/jpeg';
    }
  }

  Future<String> _ensureServerConversation({
    required String localConversationId,
    required String userId,
  }) async {
    final existing = await _messagesRepository.loadConversation(
      localConversationId,
    );
    final existingServerId = existing?.serverConversationId;
    if (existingServerId != null && existingServerId.isNotEmpty) {
      return existingServerId;
    }

    final client = Supabase.instance.client;
    final row = await client
        .from('conversations')
        .insert({})
        .select('id')
        .single();
    final serverConversationId = row['id'].toString();

    await client.from('conversation_participants').upsert({
      'conversation_id': serverConversationId,
      'user_id': userId,
    });

    await _messagesRepository.markConversationSynced(
      conversationId: localConversationId,
      serverConversationId: serverConversationId,
    );

    return serverConversationId;
  }
}

class SyncSummary {
  const SyncSummary({
    required this.attempted,
    required this.feedActionsSynced,
    required this.messagesSynced,
    this.remoteConversationsPulled = 0,
    this.remoteMessagesPulled = 0,
    required this.message,
  });

  final bool attempted;
  final int feedActionsSynced;
  final int messagesSynced;
  final int remoteConversationsPulled;
  final int remoteMessagesPulled;
  final String message;
}
