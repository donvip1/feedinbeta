import '../../data/conversation_store.dart';
import '../../domain/call_session.dart';
import '../../domain/conversation.dart';
import '../../domain/result.dart';

/// Decides whether [userId] may start a call in a conversation and assembles
/// the correct [CallSession] draft for it — the policy gate that makes group
/// calls a *mode* of the one engine instead of a separate stack.
///
/// Mode derivation:
///   dm                    -> voice | video
///   group/community       -> groupVoice | groupVideo
///   channel/broadcast     -> space (audio) | broadcast (video), host-only by
///                            default policy
class CallPolicyService {
  CallPolicyService({
    required ConversationStore conversations,
    required String Function() newCallId,
  }) : _conversations = conversations,
       _newCallId = newCallId;

  final ConversationStore _conversations;
  final String Function() _newCallId;

  Future<Result<CallSession>> draftCall({
    required String conversationId,
    required String callerId,
    required bool video,
  }) async {
    final conversation = await _conversations.getById(conversationId);
    if (conversation == null) {
      return Err(CommError.notFound('Unknown conversation'));
    }
    if (!conversation.isMember(callerId)) {
      return Err(CommError.permission('Not a member of this conversation'));
    }
    if (!conversation.canStartCall(callerId)) {
      return Err(
        CommError.permission(
          'Starting calls is not allowed for your role in this '
          '${conversation.type.name}',
        ),
      );
    }
    if (conversation.memberIds.length > conversation.policy.maxCallParticipants) {
      return Err(
        CommError.validation(
          'This conversation exceeds the ${conversation.policy.maxCallParticipants}-participant call limit',
        ),
      );
    }

    return Ok(
      CallSession(
        id: _newCallId(),
        conversationId: conversationId,
        mode: _modeFor(conversation.type, video: video),
        callerId: callerId,
        participants: [
          for (final memberId in conversation.memberIds)
            CallParticipant(userId: memberId),
        ],
      ),
    );
  }

  CallMode _modeFor(ConversationType type, {required bool video}) =>
      switch (type) {
        ConversationType.dm => video ? CallMode.video : CallMode.voice,
        ConversationType.group ||
        ConversationType.community =>
          video ? CallMode.groupVideo : CallMode.groupVoice,
        ConversationType.channel ||
        ConversationType.broadcast =>
          video ? CallMode.broadcast : CallMode.space,
        ConversationType.support ||
        ConversationType.ai =>
          video ? CallMode.video : CallMode.voice,
      };
}
