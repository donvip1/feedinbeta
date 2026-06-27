import '../message_models.dart';
import '../message_recipient.dart';
import 'chat_view_models.dart';

/// Maps the persistence-layer models (`message_models.dart`,
/// `message_recipient.dart`) into the UI-facing view-models consumed by the
/// chat widgets under `chat/widgets/`.
///
/// The persistence layer is still minimal: messages carry no `senderId`,
/// conversations carry no other-user identity/avatar/presence, and there is no
/// reaction/read-receipt/media storage yet. These mappers therefore degrade
/// gracefully — they fill the fields that exist today and leave the richer
/// fields empty until the backend contract for them lands. `isMine` is derived
/// from the sender display name against the current user's display name, which
/// is the same heuristic the previous screen used.

/// Window within which consecutive messages from the same sender are visually
/// grouped (tighter corners, shared avatar gutter).
const int _groupWindowMillis = 5 * 60 * 1000;

DeliveryState mapDeliveryState(MessageDeliveryState state) {
  return switch (state) {
    MessageDeliveryState.pending => DeliveryState.pending,
    MessageDeliveryState.sent => DeliveryState.sent,
    MessageDeliveryState.delivered => DeliveryState.delivered,
    MessageDeliveryState.read => DeliveryState.read,
    MessageDeliveryState.failed => DeliveryState.failed,
  };
}

/// Maps a stored conversation summary to an inbox-row view. Until the backend
/// exposes the other participant's profile, the conversation title doubles as
/// the display name and there is no avatar/presence.
ConversationView conversationSummaryToView(ConversationSummary summary) {
  return ConversationView(
    id: summary.id,
    serverConversationId: summary.serverConversationId,
    other: ChatUserRef(id: summary.id, displayName: summary.title),
    updatedAtMillis: summary.updatedAtMillis,
    lastMessageText: summary.lastMessagePreview,
    pendingCount: summary.pendingCount,
  );
}

/// Maps a recipient search result to a new-conversation row. Search results are
/// surfaced as `accepted` so the row offers a direct "Chat" action (the
/// credit-gated friend-request path is intentionally out of scope here).
RecipientView recipientToView(MessageRecipient recipient) {
  return RecipientView(
    user: ChatUserRef(
      id: recipient.userId,
      displayName: recipient.displayName,
      username: recipient.username,
      avatarUrl: recipient.avatarUrl,
    ),
    friendship: FriendshipStatus.accepted,
  );
}

/// Maps a chronologically-ascending list of stored messages to bubble views,
/// computing the first/last-in-group flags from sender + timestamp proximity.
List<ChatMessageView> localMessagesToViews(
  List<LocalMessage> messages, {
  required String currentUserKey,
}) {
  final views = <ChatMessageView>[];
  for (var i = 0; i < messages.length; i++) {
    final message = messages[i];
    final previous = i > 0 ? messages[i - 1] : null;
    final next = i < messages.length - 1 ? messages[i + 1] : null;

    final isFirstInGroup =
        previous == null ||
        previous.senderName != message.senderName ||
        (message.createdAtMillis - previous.createdAtMillis) >
            _groupWindowMillis;
    final isLastInGroup =
        next == null ||
        next.senderName != message.senderName ||
        (next.createdAtMillis - message.createdAtMillis) > _groupWindowMillis;

    views.add(
      ChatMessageView(
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderName,
        senderName: message.senderName,
        createdAtMillis: message.createdAtMillis,
        isMine: message.senderName == currentUserKey,
        deliveryState: mapDeliveryState(message.deliveryState),
        body: message.body,
        isFirstInGroup: isFirstInGroup,
        isLastInGroup: isLastInGroup,
      ),
    );
  }
  return views;
}
