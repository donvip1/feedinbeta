import '../message_models.dart';
import '../message_recipient.dart';
import '../canonical_message.dart';
import 'chat_view_models.dart';

/// Maps the persistence-layer models (`message_models.dart`,
/// `message_recipient.dart`) into the UI-facing view-models consumed by the
/// chat widgets under `chat/widgets/`.
///
/// The persistence layer remains offline-first. These mappers use richer
/// remote-backed fields when present, and degrade gracefully when local rows
/// were created before those fields existed.

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

/// Projects a canonical V2 record into the legacy local shape consumed by the
/// current bubble widgets. This is the dual-read bridge: canonical persistence
/// remains authoritative while the presentation layer is migrated in smaller
/// pieces.
LocalMessage canonicalMessageToLocalMessage(
  LocalCanonicalMessage record, {
  required String currentUserId,
  required String currentUserName,
  required String otherSenderName,
}) {
  final message = record.message;
  final payload = message.payload;
  final ephemeral = message.metadata['ephemeral'];
  final ephemeralMap = ephemeral is Map
      ? Map<String, Object?>.from(ephemeral)
      : const <String, Object?>{};
  final receipts = message.metadata['receipts'];
  final receiptsMap = receipts is Map
      ? Map<String, Object?>.from(receipts)
      : const <String, Object?>{};
  final readCount = _intValue(receiptsMap['read_count']);
  final isMine = message.senderId == currentUserId;

  return LocalMessage(
    id: message.id,
    conversationId: message.conversationId,
    senderName: isMine ? currentUserName : otherSenderName,
    senderId: message.senderId,
    body: switch (message.contentType) {
      CanonicalMessageContentType.text => payload['text']?.toString() ?? '',
      CanonicalMessageContentType.system =>
        payload['text']?.toString() ?? 'Conversation updated',
      CanonicalMessageContentType.gift =>
        payload['name'] == null ? 'Sent a gift' : 'Sent ${payload['name']}',
      CanonicalMessageContentType.call => _callPreview(payload),
      CanonicalMessageContentType.sticker => 'Sticker',
      _ => payload['caption']?.toString() ?? '',
    },
    createdAtMillis: message.createdAt.millisecondsSinceEpoch,
    deliveryState: _canonicalDeliveryState(record),
    messageType: switch (message.contentType) {
      CanonicalMessageContentType.voice => 'audio',
      _ => message.contentType.name,
    },
    localMediaPath: record.localAssetPath,
    readAtMillis: isMine && readCount > 0
        ? message.updatedAt.millisecondsSinceEpoch
        : null,
    readByUserId: isMine && readCount > 0 ? 'conversation-participant' : null,
    viewOnce: ephemeralMap['view_once'] == true,
    expiresAtMillis: _dateMillis(ephemeralMap['expires_at']),
    viewOnceSeenAtMillis: _dateMillis(ephemeralMap['viewed_at']),
  );
}

MessageDeliveryState _canonicalDeliveryState(LocalCanonicalMessage record) {
  if (record.syncState == MessageSyncState.failed) {
    return MessageDeliveryState.failed;
  }
  if (record.syncState != MessageSyncState.synced) {
    return MessageDeliveryState.pending;
  }
  return switch (record.message.status) {
    CanonicalMessageStatus.sending => MessageDeliveryState.pending,
    CanonicalMessageStatus.sent => MessageDeliveryState.sent,
    CanonicalMessageStatus.delivered => MessageDeliveryState.delivered,
    CanonicalMessageStatus.read => MessageDeliveryState.read,
  };
}

String _callPreview(Map<String, Object?> payload) {
  final kind = payload['call_kind']?.toString() == 'video' ? 'Video' : 'Voice';
  final state = payload['state']?.toString();
  return state == 'ended' ? '$kind call ended' : '$kind call';
}

int _intValue(Object? value) {
  if (value is int) return value;
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

int? _dateMillis(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}

/// Maps a stored conversation summary to an inbox-row view. Until the backend
/// exposes the other participant's profile, the conversation title doubles as
/// the display name and there is no avatar/presence.
ConversationView conversationSummaryToView(ConversationSummary summary) {
  final presence = presenceStateFromWire(
    summary.otherUserPresence,
    lastSeenMillis: summary.otherUserLastSeenAtMillis,
  );
  return ConversationView(
    id: summary.id,
    serverConversationId: summary.serverConversationId,
    other: ChatUserRef(
      id: summary.otherUserId ?? summary.id,
      displayName: summary.title,
      avatarUrl: summary.otherUserAvatarUrl,
    ),
    updatedAtMillis: summary.updatedAtMillis,
    lastMessageText: summary.lastMessagePreview,
    unreadCount: summary.pendingCount,
    pendingCount: 0,
    isOnline: presenceShowsDot(presence),
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
  Set<String> starredMessageIds = const <String>{},
}) {
  final views = <ChatMessageView>[];
  for (var i = 0; i < messages.length; i++) {
    final message = messages[i];
    final previous = i > 0 ? messages[i - 1] : null;
    final next = i < messages.length - 1 ? messages[i + 1] : null;

    final isFirstInGroup =
        previous == null ||
        _senderKey(previous) != _senderKey(message) ||
        (message.createdAtMillis - previous.createdAtMillis) >
            _groupWindowMillis;
    final isLastInGroup =
        next == null ||
        _senderKey(next) != _senderKey(message) ||
        (next.createdAtMillis - message.createdAtMillis) > _groupWindowMillis;
    final senderId = message.senderId ?? message.senderName;
    final isMine =
        senderId == currentUserKey || message.senderName == currentUserKey;
    final readByUserId = message.readByUserId;
    final readAtMillis = message.readAtMillis;

    views.add(
      ChatMessageView(
        id: message.id,
        conversationId: message.conversationId,
        senderId: senderId,
        senderName: message.senderName,
        senderAvatarUrl: message.senderAvatarUrl,
        createdAtMillis: message.createdAtMillis,
        isMine: isMine,
        deliveryState: mapDeliveryState(message.deliveryState),
        body: message.body,
        media: _messageMedia(message),
        readReceipts: [
          if (isMine && readByUserId != null && readAtMillis != null)
            ReadReceiptView(userId: readByUserId, readAtMillis: readAtMillis),
        ],
        viewOnce: message.viewOnce,
        expiresAtMillis: message.expiresAtMillis,
        viewOnceSeen: message.viewOnceSeenAtMillis != null,
        isStarred: starredMessageIds.contains(message.id),
        isFirstInGroup: isFirstInGroup,
        isLastInGroup: isLastInGroup,
      ),
    );
  }
  return views;
}

MessageMedia? _messageMedia(LocalMessage message) {
  final localPath = message.localMediaPath;
  final remoteUrl = message.mediaUrl;
  if ((localPath == null || localPath.isEmpty) &&
      (remoteUrl == null || remoteUrl.isEmpty)) {
    return null;
  }

  final kind = switch (message.messageType) {
    'image' => ChatMediaKind.image,
    'photo' => ChatMediaKind.image,
    'video' => ChatMediaKind.video,
    'audio' => ChatMediaKind.audio,
    'voice' => ChatMediaKind.audio,
    'music' => ChatMediaKind.music,
    _ => ChatMediaKind.file,
  };

  return MessageMedia(
    kind: kind,
    remoteUrl: remoteUrl,
    localPath: localPath,
    thumbnailUrl: message.thumbnailUrl,
    mimeType: message.mimeType,
    fileName: message.fileName,
    fileSizeBytes: message.fileSizeBytes,
    audioDurationMs: message.durationMs,
    musicTitle: message.musicTitle,
    downloadState: localPath == null
        ? MediaDownloadState.idle
        : MediaDownloadState.downloaded,
  );
}

PresenceState conversationPresence(ConversationSummary summary) {
  return presenceStateFromWire(
    summary.otherUserPresence,
    lastSeenMillis: summary.otherUserLastSeenAtMillis,
  );
}

int? conversationLastSeenMillis(ConversationSummary summary) {
  return summary.otherUserLastSeenAtMillis;
}

String _senderKey(LocalMessage message) {
  return message.senderId ?? message.senderName;
}

/// Maps the backend presence value into UI state. A stale online row is treated
/// as offline so a terminated client cannot leave a permanent green dot.
PresenceState presenceStateFromWire(
  String? raw, {
  int? lastSeenMillis,
  int? nowMillis,
  int onlineTtlMillis = 90 * 1000,
  int awayTtlMillis = 5 * 60 * 1000,
}) {
  final normalized = raw?.trim().toLowerCase();
  if (lastSeenMillis != null) {
    final now = nowMillis ?? DateTime.now().millisecondsSinceEpoch;
    final age = now - lastSeenMillis;
    final staleLiveStatus =
        (normalized == 'online' ||
            normalized == 'active_now' ||
            normalized == 'active') &&
        age > onlineTtlMillis;
    final staleAwayStatus = normalized == 'away' && age > awayTtlMillis;
    if (staleLiveStatus || staleAwayStatus) {
      return PresenceState.offline;
    }
  }

  switch (normalized) {
    case 'online':
      return PresenceState.online;
    case 'active_now':
    case 'active':
      return PresenceState.activeNow;
    case 'away':
      return PresenceState.away;
    default:
      return PresenceState.offline;
  }
}

/// Maps the typing/activity wire value into UI state and drops stale rows when
/// an idle update was missed.
ChatActivity chatActivityFromWire(
  String? raw, {
  int? updatedAtMillis,
  int? nowMillis,
  int activityTtlMillis = 6 * 1000,
}) {
  if (updatedAtMillis != null) {
    final now = nowMillis ?? DateTime.now().millisecondsSinceEpoch;
    if (now - updatedAtMillis > activityTtlMillis) {
      return ChatActivity.none;
    }
  }

  switch (raw?.trim().toLowerCase()) {
    case 'typing':
      return ChatActivity.typing;
    case 'emoji':
      return ChatActivity.emoji;
    case 'sticker':
      return ChatActivity.sticker;
    case 'voice_recording':
    case 'recording':
      return ChatActivity.voiceRecording;
    case 'uploading_image':
      return ChatActivity.uploadingImage;
    case 'uploading_video':
      return ChatActivity.uploadingVideo;
    case 'uploading_file':
      return ChatActivity.uploadingFile;
    case 'focused':
      return ChatActivity.focused;
    default:
      return ChatActivity.none;
  }
}
