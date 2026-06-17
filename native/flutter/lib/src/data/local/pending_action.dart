enum PendingActionType { likePost, savePost, commentOnPost }

class PendingAction {
  const PendingAction({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAtMillis,
    this.retryCount = 0,
  });

  final String id;
  final PendingActionType type;
  final Map<String, Object?> payload;
  final int createdAtMillis;
  final int retryCount;

  PendingAction copyWith({int? retryCount}) {
    return PendingAction(
      id: id,
      type: type,
      payload: payload,
      createdAtMillis: createdAtMillis,
      retryCount: retryCount ?? this.retryCount,
    );
  }

  factory PendingAction.fromJson(Map<String, Object?> json) {
    return PendingAction(
      id: json['id'] as String,
      type: PendingActionType.values.byName(json['type'] as String),
      payload: Map<String, Object?>.from(json['payload'] as Map),
      createdAtMillis: json['createdAtMillis'] as int,
      retryCount: json['retryCount'] as int? ?? 0,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'type': type.name,
      'payload': payload,
      'createdAtMillis': createdAtMillis,
      'retryCount': retryCount,
    };
  }
}
