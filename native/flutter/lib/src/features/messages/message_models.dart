enum MessageDeliveryState { pending, sent, delivered, read, failed }

class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.title,
    required this.lastMessagePreview,
    required this.updatedAtMillis,
    required this.pendingCount,
    this.serverConversationId,
    this.otherUserId,
    this.otherUserAvatarUrl,
    this.otherUserPresence,
    this.otherUserLastSeenAtMillis,
  });

  final String id;
  final String title;
  final String lastMessagePreview;
  final int updatedAtMillis;
  final int pendingCount;
  final String? serverConversationId;
  final String? otherUserId;
  final String? otherUserAvatarUrl;
  final String? otherUserPresence;
  final int? otherUserLastSeenAtMillis;

  ConversationSummary copyWith({
    String? title,
    String? lastMessagePreview,
    int? updatedAtMillis,
    String? serverConversationId,
    int? pendingCount,
    String? otherUserId,
    String? otherUserAvatarUrl,
    String? otherUserPresence,
    int? otherUserLastSeenAtMillis,
  }) {
    return ConversationSummary(
      id: id,
      title: title ?? this.title,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      updatedAtMillis: updatedAtMillis ?? this.updatedAtMillis,
      pendingCount: pendingCount ?? this.pendingCount,
      serverConversationId: serverConversationId ?? this.serverConversationId,
      otherUserId: otherUserId ?? this.otherUserId,
      otherUserAvatarUrl: otherUserAvatarUrl ?? this.otherUserAvatarUrl,
      otherUserPresence: otherUserPresence ?? this.otherUserPresence,
      otherUserLastSeenAtMillis:
          otherUserLastSeenAtMillis ?? this.otherUserLastSeenAtMillis,
    );
  }

  factory ConversationSummary.fromJson(Map<String, Object?> json) {
    return ConversationSummary(
      id: json['id'] as String,
      title: json['title'] as String,
      lastMessagePreview: json['lastMessagePreview'] as String,
      updatedAtMillis: json['updatedAtMillis'] as int,
      pendingCount: json['pendingCount'] as int? ?? 0,
      serverConversationId: json['serverConversationId'] as String?,
      otherUserId: json['otherUserId'] as String?,
      otherUserAvatarUrl: json['otherUserAvatarUrl'] as String?,
      otherUserPresence: json['otherUserPresence'] as String?,
      otherUserLastSeenAtMillis: json['otherUserLastSeenAtMillis'] as int?,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'title': title,
      'lastMessagePreview': lastMessagePreview,
      'updatedAtMillis': updatedAtMillis,
      'pendingCount': pendingCount,
      'serverConversationId': serverConversationId,
      'otherUserId': otherUserId,
      'otherUserAvatarUrl': otherUserAvatarUrl,
      'otherUserPresence': otherUserPresence,
      'otherUserLastSeenAtMillis': otherUserLastSeenAtMillis,
    };
  }
}

class LocalMessage {
  const LocalMessage({
    required this.id,
    required this.conversationId,
    required this.senderName,
    required this.body,
    required this.createdAtMillis,
    required this.deliveryState,
    this.senderId,
    this.senderAvatarUrl,
    this.messageType = 'text',
    this.readAtMillis,
    this.mediaUrl,
    this.localMediaPath,
    this.thumbnailUrl,
    this.mimeType,
    this.fileName,
    this.fileSizeBytes,
    this.durationMs,
    this.musicTitle,
    this.viewOnce = false,
    this.expiresAtMillis,
    this.viewOnceSeenAtMillis,
  });

  final String id;
  final String conversationId;
  final String senderName;
  final String? senderId;
  final String? senderAvatarUrl;
  final String body;
  final int createdAtMillis;
  final MessageDeliveryState deliveryState;
  final String messageType;
  final int? readAtMillis;
  final String? mediaUrl;
  final String? localMediaPath;
  final String? thumbnailUrl;
  final String? mimeType;
  final String? fileName;
  final int? fileSizeBytes;

  /// Duration (ms) for audio-note / music attachments. Mirrors the backend
  /// `message_attachments.duration_ms` column. Null for non-audio messages.
  final int? durationMs;

  /// Display title for a shared music/audio *file* (parity with the web music
  /// bubble's track title). Null for recorded audio notes and non-audio types.
  final String? musicTitle;

  /// True when this is a view-once message (self-destructs on first open by the
  /// recipient). Mirrors the backend `messages.view_once` column.
  final bool viewOnce;

  /// Absolute expiry (epoch millis) for a disappearing message; null = never.
  /// Mirrors the backend `messages.expires_at` column.
  final int? expiresAtMillis;

  /// When the recipient opened a view-once message (epoch millis); null until
  /// then. Mirrors the backend `messages.view_once_seen_at` column.
  final int? viewOnceSeenAtMillis;

  LocalMessage copyWith({
    MessageDeliveryState? deliveryState,
    int? durationMs,
    String? musicTitle,
    String? mediaUrl,
    bool? viewOnce,
    int? expiresAtMillis,
    int? viewOnceSeenAtMillis,
  }) {
    return LocalMessage(
      id: id,
      conversationId: conversationId,
      senderName: senderName,
      senderId: senderId,
      senderAvatarUrl: senderAvatarUrl,
      body: body,
      createdAtMillis: createdAtMillis,
      deliveryState: deliveryState ?? this.deliveryState,
      messageType: messageType,
      readAtMillis: readAtMillis,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      localMediaPath: localMediaPath,
      thumbnailUrl: thumbnailUrl,
      mimeType: mimeType,
      fileName: fileName,
      fileSizeBytes: fileSizeBytes,
      durationMs: durationMs ?? this.durationMs,
      musicTitle: musicTitle ?? this.musicTitle,
      viewOnce: viewOnce ?? this.viewOnce,
      expiresAtMillis: expiresAtMillis ?? this.expiresAtMillis,
      viewOnceSeenAtMillis: viewOnceSeenAtMillis ?? this.viewOnceSeenAtMillis,
    );
  }

  factory LocalMessage.fromJson(Map<String, Object?> json) {
    return LocalMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderName: json['senderName'] as String,
      senderId: json['senderId'] as String?,
      senderAvatarUrl: json['senderAvatarUrl'] as String?,
      body: json['body'] as String,
      createdAtMillis: json['createdAtMillis'] as int,
      deliveryState: MessageDeliveryState.values.byName(
        json['deliveryState'] as String,
      ),
      messageType: json['messageType'] as String? ?? 'text',
      readAtMillis: json['readAtMillis'] as int?,
      mediaUrl: json['mediaUrl'] as String?,
      localMediaPath: json['localMediaPath'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      mimeType: json['mimeType'] as String?,
      fileName: json['fileName'] as String?,
      fileSizeBytes: json['fileSizeBytes'] as int?,
      durationMs: json['durationMs'] as int?,
      musicTitle: json['musicTitle'] as String?,
      viewOnce: json['viewOnce'] as bool? ?? false,
      expiresAtMillis: json['expiresAtMillis'] as int?,
      viewOnceSeenAtMillis: json['viewOnceSeenAtMillis'] as int?,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'conversationId': conversationId,
      'senderName': senderName,
      'senderId': senderId,
      'senderAvatarUrl': senderAvatarUrl,
      'body': body,
      'createdAtMillis': createdAtMillis,
      'deliveryState': deliveryState.name,
      'messageType': messageType,
      'readAtMillis': readAtMillis,
      'mediaUrl': mediaUrl,
      'localMediaPath': localMediaPath,
      'thumbnailUrl': thumbnailUrl,
      'mimeType': mimeType,
      'fileName': fileName,
      'fileSizeBytes': fileSizeBytes,
      'durationMs': durationMs,
      'musicTitle': musicTitle,
      'viewOnce': viewOnce,
      'expiresAtMillis': expiresAtMillis,
      'viewOnceSeenAtMillis': viewOnceSeenAtMillis,
    };
  }
}
