import 'package:flutter/widgets.dart';

/// UI-facing, immutable view-models consumed by the chat widgets under
/// `chat/widgets/`. These are deliberately decoupled from the persistence
/// layer (`message_models.dart`) and depend only on the Flutter foundation
/// library so they analyze cleanly on their own.
///
/// The screen/repo layer is responsible for mapping `LocalMessage` /
/// `ConversationSummary` (+ realtime presence/typing) into these views and
/// passing them to the presentational widgets. Widgets NEVER read Supabase or
/// the repo directly — they take a view + callbacks.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Mirrors `MessageDeliveryState` in message_models.dart, kept independent so
/// this file has no cross-feature import. Map at the screen boundary.
enum DeliveryState { pending, sent, delivered, read, failed }

/// Kind of attachment a message carries (drives bubble dispatch).
enum ChatMediaKind { none, image, video, audio, file, callLog }

/// The other user's live activity, ported from web `ActivityType`.
/// (Gift/sticker content is excluded, but the enum values are kept so the
/// indicator text reaches parity if the server still emits them.)
enum ChatActivity {
  none,
  typing,
  emoji,
  sticker,
  voiceRecording,
  uploadingImage,
  uploadingVideo,
  uploadingFile,
  focused,
}

/// Coarse presence state for the other participant.
enum PresenceState { online, activeNow, away, offline }

/// Friendship status driving the recipient card action.
enum FriendshipStatus { none, pendingSent, pendingReceived, accepted }

/// Local download lifecycle for non-own media bubbles.
enum MediaDownloadState { idle, downloading, downloaded, error }

/// Report reasons (8) for the report dialog.
enum ReportReason {
  spam,
  harassment,
  hateSpeech,
  violence,
  nudity,
  scam,
  misinformation,
  other,
}

/// Delete scope for the delete dialog (silent option excluded by hard rules).
enum DeleteScope { forMe, forEveryone }

// ---------------------------------------------------------------------------
// Small value objects
// ---------------------------------------------------------------------------

/// A user reference used by avatars, headers, roster rows and recipient cards.
@immutable
class ChatUserRef {
  const ChatUserRef({
    required this.id,
    required this.displayName,
    this.username,
    this.avatarUrl,
    this.isVerified = false,
  });

  final String id;
  final String displayName;
  final String? username;
  final String? avatarUrl;
  final bool isVerified;

  /// First grapheme of the display name (or '?'), upper-cased, for the avatar
  /// initials fallback.
  String get initial {
    final trimmed = displayName.trim();
    if (trimmed.isEmpty) return '?';
    return trimmed.characters.first.toUpperCase();
  }
}

/// A single reaction occurrence (one row); widgets group these by emoji.
@immutable
class ReactionView {
  const ReactionView({required this.emoji, required this.user});

  final String emoji;
  final ChatUserRef user;
}

/// Pre-grouped reactions for one emoji (computed by the screen before render).
@immutable
class ReactionGroup {
  const ReactionGroup({
    required this.emoji,
    required this.reactors,
    required this.reactedByMe,
  });

  final String emoji;
  final List<ChatUserRef> reactors;
  final bool reactedByMe;

  int get count => reactors.length;
}

/// Quoted-message preview rendered inside a replying bubble / composer bar.
@immutable
class ReplyPreview {
  const ReplyPreview({
    required this.messageId,
    required this.senderName,
    required this.content,
    this.mediaKind = ChatMediaKind.none,
    this.mediaThumbUrl,
  });

  final String messageId;
  final String senderName;

  /// Already-resolved text (or a placeholder like "Photo") for the quote line.
  final String content;
  final ChatMediaKind mediaKind;
  final String? mediaThumbUrl;
}

/// Forwarded-from attribution (renders a "Forwarded" label).
@immutable
class ForwardedFrom {
  const ForwardedFrom({
    required this.originalSenderName,
    this.originalSenderId,
    this.originalTimestampMillis,
  });

  final String originalSenderName;
  final String? originalSenderId;
  final int? originalTimestampMillis;
}

/// Attachment payload for a media bubble.
@immutable
class MessageMedia {
  const MessageMedia({
    required this.kind,
    this.remoteUrl,
    this.localPath,
    this.thumbnailUrl,
    this.mimeType,
    this.fileName,
    this.fileSizeBytes,
    this.audioDurationMs,
    this.downloadState = MediaDownloadState.idle,
    this.downloadProgress = 0,
  });

  final ChatMediaKind kind;
  final String? remoteUrl;

  /// Cached local file path (path_provider), present once downloaded/own.
  final String? localPath;
  final String? thumbnailUrl;
  final String? mimeType;
  final String? fileName;
  final int? fileSizeBytes;
  final int? audioDurationMs;
  final MediaDownloadState downloadState;

  /// 0..1 while [downloadState] == downloading.
  final double downloadProgress;

  bool get isReady =>
      localPath != null || downloadState == MediaDownloadState.downloaded;
}

/// Inline link-preview card data (first URL in a text body).
@immutable
class LinkPreview {
  const LinkPreview({
    required this.url,
    this.title,
    this.description,
    this.imageUrl,
    this.domain,
    this.isLoading = false,
  });

  final String url;
  final String? title;
  final String? description;
  final String? imageUrl;
  final String? domain;
  final bool isLoading;
}

/// Read-receipt entry, used to derive per-recipient read state.
@immutable
class ReadReceiptView {
  const ReadReceiptView({required this.userId, required this.readAtMillis});

  final String userId;
  final int readAtMillis;
}

// ---------------------------------------------------------------------------
// Message view
// ---------------------------------------------------------------------------

/// Everything a bubble needs to render a single message. `isMine` is computed
/// by the screen from `senderId == currentUserId` (NOT from display name).
@immutable
class ChatMessageView {
  const ChatMessageView({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.createdAtMillis,
    required this.isMine,
    required this.deliveryState,
    this.body = '',
    this.senderAvatarUrl,
    this.media,
    this.reactions = const <ReactionGroup>[],
    this.replyPreview,
    this.forwardedFrom,
    this.linkPreview,
    this.readReceipts = const <ReadReceiptView>[],
    this.editedAtMillis,
    this.isPinned = false,
    this.isStarred = false,
    this.isDeletedForEveryone = false,
    this.isFirstInGroup = true,
    this.isLastInGroup = true,
    this.isHighlighted = false,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final String? senderAvatarUrl;
  final int createdAtMillis;
  final bool isMine;
  final DeliveryState deliveryState;

  /// Text content / caption. Empty for pure-media messages.
  final String body;

  final MessageMedia? media;
  final List<ReactionGroup> reactions;
  final ReplyPreview? replyPreview;
  final ForwardedFrom? forwardedFrom;
  final LinkPreview? linkPreview;
  final List<ReadReceiptView> readReceipts;
  final int? editedAtMillis;
  final bool isPinned;
  final bool isStarred;

  /// True after a "delete for everyone" — render the tombstone string.
  final bool isDeletedForEveryone;

  // Render-time grouping/affordance flags (computed, not persisted).
  final bool isFirstInGroup;
  final bool isLastInGroup;
  final bool isHighlighted;

  ChatMediaKind get mediaKind => media?.kind ?? ChatMediaKind.none;
  bool get hasText => body.trim().isNotEmpty;
  bool get hasMedia => mediaKind != ChatMediaKind.none;
  bool get isEdited => editedAtMillis != null;
  bool get isCallLog => mediaKind == ChatMediaKind.callLog;

  /// Emoji-only heuristic for larger glyph rendering (1-3 emoji, no letters).
  bool get isEmojiOnly {
    if (!hasText || hasMedia) return false;
    final t = body.trim();
    if (t.length > 8) return false;
    return !RegExp(r'[A-Za-z0-9]').hasMatch(t) && _emojiRegex.hasMatch(t);
  }

  static final RegExp _emojiRegex = RegExp(
    r'[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{2764}]',
    unicode: true,
  );
}

// ---------------------------------------------------------------------------
// Conversation / inbox view
// ---------------------------------------------------------------------------

/// One inbox row's data (the other participant + last-message metadata +
/// transient presence/typing supplied by realtime).
@immutable
class ConversationView {
  const ConversationView({
    required this.id,
    required this.other,
    required this.updatedAtMillis,
    this.serverConversationId,
    this.lastMessageText = '',
    this.lastMessageSenderId,
    this.lastMessageDelivery,
    this.unreadCount = 0,
    this.pendingCount = 0,
    this.isOnline = false,
    this.activity = ChatActivity.none,
    this.isMuted = false,
    this.isArchived = false,
  });

  final String id;
  final String? serverConversationId;
  final ChatUserRef other;
  final int updatedAtMillis;

  final String lastMessageText;
  final String? lastMessageSenderId;

  /// Delivery state of the last message when it is mine (drives ticks).
  final DeliveryState? lastMessageDelivery;

  final int unreadCount;

  /// Local outbox count (distinct from server [unreadCount]).
  final int pendingCount;

  // Transient (realtime) fields.
  final bool isOnline;
  final ChatActivity activity;

  final bool isMuted;
  final bool isArchived;

  bool get hasUnread => unreadCount > 0;
  bool get isTyping => activity != ChatActivity.none;
  bool lastMessageIsMine(String currentUserId) =>
      lastMessageSenderId != null && lastMessageSenderId == currentUserId;
}

/// Header model for the open conversation (other user + live presence/typing).
@immutable
class ChatHeaderView {
  const ChatHeaderView({
    required this.other,
    this.presence = PresenceState.offline,
    this.activity = ChatActivity.none,
    this.lastSeenMillis,
  });

  final ChatUserRef other;
  final PresenceState presence;
  final ChatActivity activity;
  final int? lastSeenMillis;
}

// ---------------------------------------------------------------------------
// New-conversation / recipient view
// ---------------------------------------------------------------------------

/// A search/friend result row in the new-conversation sheet.
@immutable
class RecipientView {
  const RecipientView({
    required this.user,
    this.friendship = FriendshipStatus.none,
    this.friendRequestId,
    this.isProcessing = false,
  });

  final ChatUserRef user;
  final FriendshipStatus friendship;

  /// For pendingReceived rows, the request id to accept/decline.
  final String? friendRequestId;
  final bool isProcessing;
}

// ---------------------------------------------------------------------------
// Composer state
// ---------------------------------------------------------------------------

/// Immutable snapshot of the composer's reply target (null when not replying).
typedef ComposerReply = ReplyPreview;

/// Descriptor for one of the quick reactions in the picker.
@immutable
class ReactionDescriptor {
  const ReactionDescriptor({
    required this.id,
    required this.emoji,
    required this.label,
  });

  final String id;
  final String emoji;
  final String label;
}

/// The 6 core quick reactions + 21 extended emojis ported from the web
/// `REACTION_TYPES` / `EXTENDED_EMOJIS`. Pure data so any widget can read it.
class ChatReactionCatalog {
  const ChatReactionCatalog._();

  static const List<ReactionDescriptor> core = [
    ReactionDescriptor(id: 'heart', emoji: '❤️', label: 'Love'),
    ReactionDescriptor(id: 'fire', emoji: '🔥', label: 'Fire'),
    ReactionDescriptor(id: 'haha', emoji: '😂', label: 'Haha'),
    ReactionDescriptor(id: 'like', emoji: '👍', label: 'Like'),
    ReactionDescriptor(id: 'party', emoji: '🎉', label: 'Party'),
    ReactionDescriptor(id: 'win', emoji: '🏆', label: 'Win'),
  ];

  static const List<String> extended = [
    '🎉',
    '🏆',
    '😂',
    '😢',
    '😮',
    '🥳',
    '😎',
    '🤔',
    '😡',
    '💯',
    '👍',
    '👎',
    '🙏',
    '💪',
    '🤝',
    '😘',
    '🥰',
    '😭',
    '🤣',
    '😱',
    '💀',
  ];
}

/// Maps [ChatActivity] to the inbox/header text fragment (without the name).
String chatActivityText(ChatActivity activity) {
  switch (activity) {
    case ChatActivity.none:
      return '';
    case ChatActivity.typing:
      return 'typing…';
    case ChatActivity.emoji:
      return 'choosing emoji…';
    case ChatActivity.sticker:
      return 'choosing a sticker…';
    case ChatActivity.voiceRecording:
      return 'recording voice…';
    case ChatActivity.uploadingImage:
      return 'sending image…';
    case ChatActivity.uploadingVideo:
      return 'sending video…';
    case ChatActivity.uploadingFile:
      return 'sending file…';
    case ChatActivity.focused:
      return 'composing…';
  }
}

/// Accessibility / tooltip label for a message's delivery state. Used by the
/// outgoing-bubble status glyph and the inbox-row tick so the same wording is
/// announced everywhere. Pure presentation — no backend coupling.
String deliveryStateLabel(DeliveryState state) {
  switch (state) {
    case DeliveryState.pending:
      return 'Sending';
    case DeliveryState.sent:
      return 'Sent';
    case DeliveryState.delivered:
      return 'Delivered';
    case DeliveryState.read:
      return 'Read';
    case DeliveryState.failed:
      return 'Not delivered';
  }
}

/// Header subtitle for the open conversation, derived purely from local state.
///
/// Precedence: a live [activity] (typing/recording/etc.) wins; then coarse
/// [presence]; otherwise a neutral placeholder so the row never renders empty
/// while the backend presence signal is still unfinalised. [lastSeenMillis] is
/// only consulted for the `offline` case and is optional.
String chatPresenceSubtitle({
  required PresenceState presence,
  ChatActivity activity = ChatActivity.none,
  int? lastSeenMillis,
}) {
  if (activity != ChatActivity.none) {
    return chatActivityText(activity);
  }
  switch (presence) {
    case PresenceState.online:
      return 'Online';
    case PresenceState.activeNow:
      return 'Active now';
    case PresenceState.away:
      return 'Away';
    case PresenceState.offline:
      final lastSeen = _lastSeenText(lastSeenMillis);
      // Neutral placeholder until real presence/last-seen lands server-side.
      return lastSeen ?? 'Offline';
  }
}

/// Compact "last seen" fragment (e.g. "Active 5m ago"); null when unknown.
String? _lastSeenText(int? lastSeenMillis) {
  if (lastSeenMillis == null || lastSeenMillis <= 0) return null;
  final then = DateTime.fromMillisecondsSinceEpoch(lastSeenMillis);
  final diff = DateTime.now().difference(then);
  if (diff.isNegative) return null;
  if (diff.inMinutes < 1) return 'Active just now';
  if (diff.inMinutes < 60) return 'Active ${diff.inMinutes}m ago';
  if (diff.inHours < 24) return 'Active ${diff.inHours}h ago';
  if (diff.inDays < 7) return 'Active ${diff.inDays}d ago';
  return null;
}

/// Whether a presence state should light the avatar's online dot. Both
/// `online` and `activeNow` render the dot (colour differs at the call site).
bool presenceShowsDot(PresenceState presence) =>
    presence == PresenceState.online || presence == PresenceState.activeNow;

/// Human label for a report reason (used by the report dialog + payload).
String reportReasonLabel(ReportReason reason) {
  switch (reason) {
    case ReportReason.spam:
      return 'Spam';
    case ReportReason.harassment:
      return 'Harassment or bullying';
    case ReportReason.hateSpeech:
      return 'Hate speech';
    case ReportReason.violence:
      return 'Violence or threats';
    case ReportReason.nudity:
      return 'Nudity or sexual content';
    case ReportReason.scam:
      return 'Scam or fraud';
    case ReportReason.misinformation:
      return 'Misinformation';
    case ReportReason.other:
      return 'Other';
  }
}

/// Formats a byte count as B / KB / MB (parity with web formatFileSize).
String formatFileSize(int? bytes) {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
