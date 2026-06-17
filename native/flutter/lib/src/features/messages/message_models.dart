enum MessageDeliveryState { pending, sent, delivered, read, failed }

class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.title,
    required this.lastMessagePreview,
    required this.updatedAtMillis,
    required this.pendingCount,
    this.serverConversationId,
  });

  final String id;
  final String title;
  final String lastMessagePreview;
  final int updatedAtMillis;
  final int pendingCount;
  final String? serverConversationId;

  ConversationSummary copyWith({
    String? serverConversationId,
    int? pendingCount,
  }) {
    return ConversationSummary(
      id: id,
      title: title,
      lastMessagePreview: lastMessagePreview,
      updatedAtMillis: updatedAtMillis,
      pendingCount: pendingCount ?? this.pendingCount,
      serverConversationId: serverConversationId ?? this.serverConversationId,
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
  });

  final String id;
  final String conversationId;
  final String senderName;
  final String body;
  final int createdAtMillis;
  final MessageDeliveryState deliveryState;

  LocalMessage copyWith({MessageDeliveryState? deliveryState}) {
    return LocalMessage(
      id: id,
      conversationId: conversationId,
      senderName: senderName,
      body: body,
      createdAtMillis: createdAtMillis,
      deliveryState: deliveryState ?? this.deliveryState,
    );
  }

  factory LocalMessage.fromJson(Map<String, Object?> json) {
    return LocalMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderName: json['senderName'] as String,
      body: json['body'] as String,
      createdAtMillis: json['createdAtMillis'] as int,
      deliveryState: MessageDeliveryState.values.byName(
        json['deliveryState'] as String,
      ),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'conversationId': conversationId,
      'senderName': senderName,
      'body': body,
      'createdAtMillis': createdAtMillis,
      'deliveryState': deliveryState.name,
    };
  }
}
