enum CanonicalMessageContentType {
  text,
  image,
  video,
  voice,
  file,
  sticker,
  gift,
  call,
  system,
}

enum CanonicalMessageStatus { sending, sent, delivered, read }

enum MessageSyncState { pending, syncing, synced, failed }

class CanonicalMessage {
  const CanonicalMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.contentType,
    required this.payload,
    required this.status,
    required this.metadata,
    required this.createdAt,
    required this.updatedAt,
    this.replyToId,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final CanonicalMessageContentType contentType;
  final Map<String, Object?> payload;
  final String? replyToId;
  final CanonicalMessageStatus status;
  final Map<String, Object?> metadata;
  final DateTime createdAt;
  final DateTime updatedAt;

  int get revision => _asInt(metadata['revision'], fallback: 1);

  bool isMine(String currentUserId) => senderId == currentUserId;

  CanonicalMessage copyWith({
    Map<String, Object?>? payload,
    CanonicalMessageStatus? status,
    Map<String, Object?>? metadata,
    DateTime? updatedAt,
  }) {
    return CanonicalMessage(
      id: id,
      conversationId: conversationId,
      senderId: senderId,
      contentType: contentType,
      payload: payload ?? this.payload,
      replyToId: replyToId,
      status: status ?? this.status,
      metadata: metadata ?? this.metadata,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory CanonicalMessage.fromJson(Map<String, Object?> json) {
    final id = _requiredString(json, 'id');
    final conversationId = _requiredString(json, 'conversation_id');
    final senderId = _requiredString(json, 'sender_id');
    final contentTypeName = _requiredString(json, 'content_type');
    final statusName = _requiredString(json, 'status');
    final payload = _requiredMap(json, 'payload');
    final metadata = _requiredMap(json, 'metadata');

    final contentType = CanonicalMessageContentType.values.firstWhere(
      (value) => value.name == contentTypeName,
      orElse: () => throw FormatException(
        'Unsupported canonical content type: $contentTypeName',
      ),
    );
    final status = CanonicalMessageStatus.values.firstWhere(
      (value) => value.name == statusName,
      orElse: () => throw FormatException(
        'Unsupported canonical message status: $statusName',
      ),
    );

    _validatePayload(contentType, payload);

    return CanonicalMessage(
      id: id,
      conversationId: conversationId,
      senderId: senderId,
      contentType: contentType,
      payload: payload,
      replyToId: _optionalString(json['reply_to_id']),
      status: status,
      metadata: metadata,
      createdAt: DateTime.parse(_requiredString(json, 'created_at')).toUtc(),
      updatedAt: DateTime.parse(_requiredString(json, 'updated_at')).toUtc(),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'conversation_id': conversationId,
      'sender_id': senderId,
      'content_type': contentType.name,
      'payload': payload,
      'reply_to_id': replyToId,
      'status': status.name,
      'metadata': metadata,
      'created_at': createdAt.toUtc().toIso8601String(),
      'updated_at': updatedAt.toUtc().toIso8601String(),
    };
  }
}

class LocalCanonicalMessage {
  const LocalCanonicalMessage({
    required this.message,
    required this.syncState,
    this.localAssetPath,
    this.attemptCount = 0,
    this.nextAttemptAt,
    this.lastErrorCode,
  });

  final CanonicalMessage message;
  final MessageSyncState syncState;
  final String? localAssetPath;
  final int attemptCount;
  final DateTime? nextAttemptAt;
  final String? lastErrorCode;

  LocalCanonicalMessage copyWith({
    CanonicalMessage? message,
    MessageSyncState? syncState,
    String? localAssetPath,
    bool clearLocalAssetPath = false,
    int? attemptCount,
    DateTime? nextAttemptAt,
    bool clearNextAttemptAt = false,
    String? lastErrorCode,
    bool clearLastErrorCode = false,
  }) {
    return LocalCanonicalMessage(
      message: message ?? this.message,
      syncState: syncState ?? this.syncState,
      localAssetPath: clearLocalAssetPath
          ? null
          : (localAssetPath ?? this.localAssetPath),
      attemptCount: attemptCount ?? this.attemptCount,
      nextAttemptAt: clearNextAttemptAt
          ? null
          : (nextAttemptAt ?? this.nextAttemptAt),
      lastErrorCode: clearLastErrorCode
          ? null
          : (lastErrorCode ?? this.lastErrorCode),
    );
  }

  factory LocalCanonicalMessage.fromJson(Map<String, Object?> json) {
    return LocalCanonicalMessage(
      message: CanonicalMessage.fromJson(_requiredMap(json, 'message')),
      syncState: MessageSyncState.values.firstWhere(
        (value) => value.name == _requiredString(json, 'sync_state'),
      ),
      localAssetPath: _optionalString(json['local_asset_path']),
      attemptCount: _asInt(json['attempt_count']),
      nextAttemptAt: _optionalDateTime(json['next_attempt_at']),
      lastErrorCode: _optionalString(json['last_error_code']),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'message': message.toJson(),
      'sync_state': syncState.name,
      'local_asset_path': localAssetPath,
      'attempt_count': attemptCount,
      'next_attempt_at': nextAttemptAt?.toUtc().toIso8601String(),
      'last_error_code': lastErrorCode,
    };
  }
}

void _validatePayload(
  CanonicalMessageContentType type,
  Map<String, Object?> payload,
) {
  switch (type) {
    case CanonicalMessageContentType.text:
      if (_optionalString(payload['text']) == null) {
        throw const FormatException('Text messages require payload.text.');
      }
      return;
    case CanonicalMessageContentType.image:
    case CanonicalMessageContentType.video:
    case CanonicalMessageContentType.voice:
    case CanonicalMessageContentType.file:
      final media = payload['media'];
      if (media is! Map || _optionalString(media['path']) == null) {
        throw FormatException(
          '${type.name} messages require payload.media.path.',
        );
      }
      return;
    case CanonicalMessageContentType.sticker:
      if (_optionalString(payload['asset_key']) == null) {
        throw const FormatException(
          'Sticker messages require payload.asset_key.',
        );
      }
      return;
    case CanonicalMessageContentType.gift:
      if (_optionalString(payload['gift_id']) == null) {
        throw const FormatException('Gift messages require payload.gift_id.');
      }
      return;
    case CanonicalMessageContentType.call:
      if (_optionalString(payload['call_id']) == null) {
        throw const FormatException('Call messages require payload.call_id.');
      }
      return;
    case CanonicalMessageContentType.system:
      if (_optionalString(payload['event']) == null) {
        throw const FormatException('System messages require payload.event.');
      }
      return;
  }
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = _optionalString(json[key]);
  if (value == null) throw FormatException('Missing canonical field: $key');
  return value;
}

String? _optionalString(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

Map<String, Object?> _requiredMap(Map<String, Object?> json, String key) {
  final raw = json[key];
  if (raw is! Map)
    throw FormatException('Canonical field $key must be an object.');
  return Map<String, Object?>.from(raw);
}

int _asInt(Object? value, {int fallback = 0}) {
  return value is int
      ? value
      : int.tryParse(value?.toString() ?? '') ?? fallback;
}

DateTime? _optionalDateTime(Object? value) {
  final text = _optionalString(value);
  return text == null ? null : DateTime.tryParse(text)?.toUtc();
}
