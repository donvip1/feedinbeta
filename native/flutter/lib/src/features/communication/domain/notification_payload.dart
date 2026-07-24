/// Every notification the platform can deliver, in one taxonomy. Categories
/// drive user preferences, channel/importance mapping, and router dispatch.
enum NotificationCategory {
  message,
  call,
  mention,
  reply,
  reaction,
  groupEvent,
  communityEvent,
  channelPost,
  creatorUpdate,
  silent, // background sync signals — never surfaced
  priority; // platform-critical, bypasses per-category opt-out (not mutes? no — bypasses everything except a full mute)

  /// Calls and priority ride high-importance (full-screen/heads-up) channels.
  bool get isHighPriority => this == call || this == priority;

  /// Silent notifications never render UI.
  bool get isSilent => this == silent;
}

/// The one wire contract for every push the platform sends/receives. Always a
/// DATA-ONLY payload (no `notification` block) so the client router — not the
/// OS — decides presentation, which is what makes CallKit wake-ups, grouping,
/// inline reply, and preference filtering possible.
class NotificationPayload {
  const NotificationPayload({
    required this.category,
    required this.title,
    required this.body,
    this.conversationId,
    this.messageId,
    this.callId,
    this.senderId,
    this.senderName,
    this.avatarUrl,
    this.route,
    this.extra = const {},
  });

  final NotificationCategory category;
  final String title;
  final String body;
  final String? conversationId;
  final String? messageId;
  final String? callId;
  final String? senderId;
  final String? senderName;
  final String? avatarUrl;

  /// Deep-link route to open on tap (e.g. `conversation:<id>`).
  final String? route;
  final Map<String, String> extra;

  Map<String, String> toData() => {
    'v': '1',
    'category': category.name,
    'title': title,
    'body': body,
    if (conversationId != null) 'conversation_id': conversationId!,
    if (messageId != null) 'message_id': messageId!,
    if (callId != null) 'call_id': callId!,
    if (senderId != null) 'sender_id': senderId!,
    if (senderName != null) 'sender_name': senderName!,
    if (avatarUrl != null) 'avatar_url': avatarUrl!,
    if (route != null) 'route': route!,
    ...extra,
  };

  /// Decode an incoming FCM data map. Tolerant: unknown categories map to
  /// [NotificationCategory.message] (surfaced, never dropped, never crashes),
  /// and the LEGACY payload shapes (`type: call` / `type: message` from the
  /// old senders) are translated so both generations of push keep working
  /// during the migration.
  factory NotificationPayload.fromData(Map<String, Object?> data) {
    // Legacy translation: {type: call, call_id, caller_name, call_type}.
    final legacyType = data['type']?.toString();
    if (legacyType == 'call') {
      return NotificationPayload(
        category: NotificationCategory.call,
        title: data['caller_name']?.toString() ?? 'Incoming call',
        body: (data['call_type']?.toString() == 'video')
            ? 'Incoming video call'
            : 'Incoming voice call',
        callId: data['call_id']?.toString(),
        senderName: data['caller_name']?.toString(),
        avatarUrl: data['caller_avatar']?.toString(),
        extra: {
          if (data['call_type'] != null)
            'call_type': data['call_type'].toString(),
        },
      );
    }
    if (legacyType == 'message') {
      return NotificationPayload(
        category: NotificationCategory.message,
        title: data['sender_name']?.toString() ?? 'New message',
        body: data['body']?.toString() ?? data['preview']?.toString() ?? '',
        conversationId: data['conversation_id']?.toString(),
        messageId: data['message_id']?.toString(),
        senderName: data['sender_name']?.toString(),
        route: data['conversation_id'] == null
            ? null
            : 'conversation:${data['conversation_id']}',
      );
    }

    return NotificationPayload(
      category: NotificationCategory.values.firstWhere(
        (c) => c.name == data['category'],
        orElse: () => NotificationCategory.message,
      ),
      title: data['title']?.toString() ?? '',
      body: data['body']?.toString() ?? '',
      conversationId: data['conversation_id']?.toString(),
      messageId: data['message_id']?.toString(),
      callId: data['call_id']?.toString(),
      senderId: data['sender_id']?.toString(),
      senderName: data['sender_name']?.toString(),
      avatarUrl: data['avatar_url']?.toString(),
      route: data['route']?.toString(),
      extra: {
        for (final entry in data.entries)
          if (!_knownKeys.contains(entry.key) && entry.value != null)
            entry.key: entry.value.toString(),
      },
    );
  }

  static const _knownKeys = {
    'v',
    'category',
    'title',
    'body',
    'conversation_id',
    'message_id',
    'call_id',
    'sender_id',
    'sender_name',
    'avatar_url',
    'route',
    'type',
  };
}

/// What the router decided to do with a payload — returned so hosts (and
/// tests) act on a value instead of hidden side effects.
enum NotificationAction {
  /// Present the native full-screen incoming-call UI (CallKit path).
  presentIncomingCall,

  /// Show a local notification (grouped per conversation, inline reply).
  showNotification,

  /// Process silently (sync tick) — no UI.
  processSilently,

  /// Dropped: user preference, conversation mute, or viewer is already
  /// looking at that conversation in the foreground.
  suppress,
}

/// A routing decision plus why it was made (the `reason` feeds diagnostics).
class NotificationDecision {
  const NotificationDecision(this.action, this.payload, {required this.reason});

  final NotificationAction action;
  final NotificationPayload payload;
  final String reason;
}
