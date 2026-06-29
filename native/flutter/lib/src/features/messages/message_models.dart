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

  LocalMessage copyWith({MessageDeliveryState? deliveryState}) {
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
      mediaUrl: mediaUrl,
      localMediaPath: localMediaPath,
      thumbnailUrl: thumbnailUrl,
      mimeType: mimeType,
      fileName: fileName,
      fileSizeBytes: fileSizeBytes,
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
    };
  }
}
