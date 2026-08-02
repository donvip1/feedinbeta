import 'package:flutter/foundation.dart';

import 'feedin_realtime_service.dart';

/// A small, immutable model describing one incoming message banner
/// rendered above the immersive Feed chrome.
///
/// The banner is built from a Realtime event for `messages`. The host
/// (Feed) is responsible for keeping at most one banner visible at a
/// time, deduplicating events, and timing out the banner after a short
/// duration.
@immutable
class IncomingFeedMessageBanner {
  const IncomingFeedMessageBanner({
    required this.id,
    required this.conversationId,
    required this.senderName,
    required this.preview,
    required this.receivedAt,
    this.avatarUrl,
  });

  /// Stable dedup key (Realtime message record id).
  final String id;

  /// Conversation the message belongs to. Tapping the banner routes the
  /// user to this conversation.
  final String conversationId;

  /// Display name shown in the banner. Falls back to "Someone".
  final String senderName;

  /// First line / preview of the message body.
  final String preview;

  /// When the banner was created (used to expire it).
  final DateTime receivedAt;

  /// Optional avatar URL.
  final String? avatarUrl;

  IncomingFeedMessageBanner copyWith({
    String? id,
    String? conversationId,
    String? senderName,
    String? preview,
    DateTime? receivedAt,
    String? avatarUrl,
  }) {
    return IncomingFeedMessageBanner(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      senderName: senderName ?? this.senderName,
      preview: preview ?? this.preview,
      receivedAt: receivedAt ?? this.receivedAt,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }
}

/// Pulls the relevant fields out of a Postgres change payload for
/// `messages`, without trusting anything that isn't already known to be
/// safe (e.g. payload field types are coerced to String).
///
/// Returns null when the payload doesn't describe a new incoming message
/// directed at the signed-in user, or when it's missing fields the
/// banner needs.
class IncomingMessageResolver {
  const IncomingMessageResolver({
    required this.currentUserId,
    required this.event,
  });

  final String currentUserId;
  final FeedinRealtimeEvent event;

  /// Whether the payload describes a `messages` insert directed at the
  /// current user. Updates and deletes are ignored.
  bool get isIncomingInsert => _eventKind == 'INSERT';

  String? get messageId {
    if (event.recordId == null) return null;
    return event.recordId;
  }

  String? get conversationId {
    final fromEvent = event.messageConversationId;
    if (fromEvent != null && fromEvent.isNotEmpty) return fromEvent;
    final fromPayload = event.messageRecord?['conversation_id']?.toString();
    if (fromPayload != null && fromPayload.isNotEmpty) return fromPayload;
    return null;
  }

  String? get senderId {
    final fromPayload = event.messageRecord?['sender_id']?.toString();
    if (fromPayload != null && fromPayload.isNotEmpty) return fromPayload;
    return null;
  }

  String? get preview {
    final raw = event.messageRecord?['content']?.toString();
    if (raw == null || raw.isEmpty) return null;
    return raw;
  }

  String? get senderName {
    final profile = event.messageRecord?['profiles'];
    if (profile is Map) {
      final display = profile['display_name']?.toString();
      if (display != null && display.isNotEmpty) return display;
      final username = profile['username']?.toString();
      if (username != null && username.isNotEmpty) return username;
    }
    return null;
  }

  String? get senderAvatarUrl {
    final profile = event.messageRecord?['profiles'];
    if (profile is Map) {
      final avatar = profile['avatar_url']?.toString();
      if (avatar != null && avatar.isNotEmpty) return avatar;
    }
    return null;
  }

  /// Returns a banner when this event is a brand-new incoming message
  /// addressed to the signed-in user. Returns null for self-authored
  /// messages, unknown event kinds, and missing required fields.
  IncomingFeedMessageBanner? buildBanner({DateTime? receivedAt}) {
    if (!isIncomingInsert) return null;
    final messageId = this.messageId;
    final conversationId = this.conversationId;
    if (messageId == null || messageId.isEmpty) return null;
    if (conversationId == null || conversationId.isEmpty) return null;
    final senderId = this.senderId;
    if (senderId != null && senderId == currentUserId) return null;
    final preview = this.preview ?? 'New message';
    final senderName = this.senderName ?? 'Someone';
    return IncomingFeedMessageBanner(
      id: messageId,
      conversationId: conversationId,
      senderName: senderName,
      preview: preview,
      receivedAt: receivedAt ?? DateTime.now(),
      avatarUrl: senderAvatarUrl,
    );
  }

  String get _eventKind {
    switch (event.kind) {
      case FeedinRealtimeEventKind.insert:
        return 'INSERT';
      case FeedinRealtimeEventKind.update:
        return 'UPDATE';
      case FeedinRealtimeEventKind.delete:
        return 'DELETE';
      case FeedinRealtimeEventKind.unknown:
        return 'UNKNOWN';
    }
  }
}