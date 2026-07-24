import 'dart:async';

import '../data/conversation_store.dart';
import '../domain/content_block.dart';
import '../domain/conversation.dart';
import '../domain/hybrid_clock.dart';
import '../domain/message_envelope.dart';
import '../domain/result.dart';
import '../media/media_message_coordinator.dart';
import '../pipeline/message_pipeline.dart';

/// The ONE entry point for sending into any conversation — dm, group,
/// community, channel, broadcast, support, ai. This is the unification layer
/// that replaces the three legacy stacks: the same validation, the same policy
/// gate, the same offline-first pipeline, the same media invariant, regardless
/// of surface.
///
/// Responsibilities:
///  * **Policy enforcement** — [Conversation.canPost] is checked before
///    anything is queued (a subscriber can't post into a broadcast channel; a
///    non-member can't post at all). Groups finally get the same guarantees as
///    DMs because they ARE the same code path.
///  * **Envelope assembly** — ids, HLC timestamps, mention extraction.
///  * **Routing** — media blocks go through the [MediaMessageCoordinator]
///    (upload-verify-then-send); everything else goes straight to the
///    [MessagePipeline].
///  * **Inbox maintenance** — every accepted send/receive bumps the
///    conversation's inbox ordering.
class ConversationService {
  ConversationService({
    required ConversationStore conversations,
    required MessagePipeline pipeline,
    required MediaMessageCoordinator media,
    required HybridClock clock,
    required String Function() newMessageId,
    int Function()? nowMillis,
  }) : _conversations = conversations,
       _pipeline = pipeline,
       _media = media,
       _clock = clock,
       _newMessageId = newMessageId,
       _now = nowMillis ?? (() => DateTime.now().millisecondsSinceEpoch) {
    _pipelineSub = _pipeline.updates.listen(_onPipelineUpdate);
  }

  final ConversationStore _conversations;
  final MessagePipeline _pipeline;
  final MediaMessageCoordinator _media;
  final HybridClock _clock;
  final String Function() _newMessageId;
  final int Function() _now;

  late final StreamSubscription<MessageEnvelope> _pipelineSub;

  static final _mentionPattern = RegExp(r'@([\w.]+)');

  /// Send [content] from [senderId] into [conversationId]. Enforces membership
  /// + policy, assembles the envelope, and routes by content kind. Returns the
  /// accepted (optimistic) envelope or the refusal.
  Future<Result<MessageEnvelope>> send({
    required String conversationId,
    required String senderId,
    required ContentBlock content,
    String? replyToId,
    String? threadRootId,
    Ephemeral? ephemeral,
  }) async {
    final conversation = await _conversations.getById(conversationId);
    if (conversation == null) {
      return Err(CommError.notFound('Unknown conversation $conversationId'));
    }
    if (!conversation.isMember(senderId)) {
      return Err(CommError.permission('Not a member of this conversation'));
    }
    if (!conversation.canPost(senderId)) {
      return Err(
        CommError.permission(
          'Posting is not allowed for your role in this ${conversation.type.name}',
        ),
      );
    }

    final envelope = MessageEnvelope(
      id: _newMessageId(),
      conversationId: conversationId,
      senderId: senderId,
      sentAt: _clock.issueLocal(),
      content: content,
      replyToId: replyToId,
      threadRootId: threadRootId,
      mentions: _extractMentions(content),
      ephemeral: ephemeral,
    );

    final result = content is MediaContentBlock
        ? await _media.sendMedia(envelope)
        : await _pipeline.send(envelope);

    if (result.isOk) {
      await _conversations.touch(conversationId, _now());
    }
    return result;
  }

  /// Mentions come from the text of text-bearing blocks; other kinds have none.
  List<String> _extractMentions(ContentBlock content) {
    final text = switch (content) {
      TextBlock(:final text) => text,
      _ => null,
    };
    if (text == null) return const [];
    return _mentionPattern
        .allMatches(text)
        .map((m) => m.group(1)!)
        .toSet()
        .toList();
  }

  /// Keep the inbox ordered as messages flow (local echoes, acks, and remote
  /// applies all pass through the pipeline's update stream).
  Future<void> _onPipelineUpdate(MessageEnvelope envelope) async {
    await _conversations.touch(envelope.conversationId, envelope.sentAt.millis);
  }

  // -- Conversation lifecycle ---------------------------------------------------

  /// Register/refresh a conversation locally (from a server fetch or create).
  Future<void> upsertConversation(Conversation conversation) =>
      _conversations.upsert(conversation);

  Future<Conversation?> conversationById(String id) =>
      _conversations.getById(id);

  /// Inbox for the UI: every type in one ordered list, or filtered (e.g. the
  /// Chats tab shows dm+group, a Communities tab shows community+channel).
  Future<List<Conversation>> inbox({List<ConversationType>? types}) =>
      _conversations.inbox(types: types);

  Future<void> dispose() async {
    await _pipelineSub.cancel();
  }
}
