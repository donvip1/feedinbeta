class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAtMillis,
    required this.isRead,
    this.route,
    this.rawType,
    this.displayName,
    this.avatarUrl,
    this.actionType,
    this.relatedId,
    this.relatedType,
    this.data = const <String, Object?>{},
  });

  final String id;
  final String title;
  final String body;
  final int createdAtMillis;
  final bool isRead;
  final String? route;
  final String? rawType;
  final String? displayName;
  final String? avatarUrl;
  final String? actionType;
  final String? relatedId;
  final String? relatedType;
  final Map<String, Object?> data;

  NotificationType get type {
    final normalizedRoute = route?.toLowerCase() ?? '';
    final normalizedTitle = title.toLowerCase();
    if (normalizedRoute.contains('message') ||
        normalizedRoute.contains('conversation') ||
        normalizedTitle.contains('message') ||
        normalizedTitle.contains('chat')) {
      return NotificationType.message;
    }
    if (normalizedRoute.contains('post') ||
        normalizedTitle.contains('like') ||
        normalizedTitle.contains('comment') ||
        normalizedTitle.contains('refeed')) {
      return NotificationType.feed;
    }
    return NotificationType.system;
  }

  NotificationItem copyWith({
    bool? isRead,
    String? route,
    String? rawType,
    String? displayName,
    String? avatarUrl,
    String? actionType,
    String? relatedId,
    String? relatedType,
    Map<String, Object?>? data,
  }) {
    return NotificationItem(
      id: id,
      title: title,
      body: body,
      createdAtMillis: createdAtMillis,
      isRead: isRead ?? this.isRead,
      route: route ?? this.route,
      rawType: rawType ?? this.rawType,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      actionType: actionType ?? this.actionType,
      relatedId: relatedId ?? this.relatedId,
      relatedType: relatedType ?? this.relatedType,
      data: data ?? this.data,
    );
  }

  factory NotificationItem.fromJson(Map<String, Object?> json) {
    return NotificationItem(
      id:
          _string(json, 'id') ??
          _string(json, 'notification_id') ??
          (throw const FormatException('Missing notification id')),
      title: _string(json, 'title') ?? 'Notification',
      body: _string(json, 'body') ?? _string(json, 'message') ?? '',
      createdAtMillis:
          _int(json, 'createdAtMillis') ??
          _int(json, 'created_at_millis') ??
          _dateMillis(json, 'createdAt') ??
          _dateMillis(json, 'created_at') ??
          0,
      isRead: _bool(json, 'isRead') ?? _bool(json, 'is_read') ?? false,
      route:
          _string(json, 'route') ??
          _string(json, 'actionUrl') ??
          _string(json, 'action_url') ??
          _string(json, 'deepLink') ??
          _string(json, 'deep_link') ??
          _routeFromAction(json),
      rawType: _string(json, 'rawType') ?? _string(json, 'type'),
      displayName:
          _string(json, 'displayName') ??
          _string(json, 'display_name') ??
          _string(json, 'senderName') ??
          _string(json, 'sender_name'),
      avatarUrl:
          _string(json, 'avatarUrl') ??
          _string(json, 'avatar_url') ??
          _string(json, 'senderAvatarUrl') ??
          _string(json, 'sender_avatar_url'),
      actionType: _string(json, 'actionType') ?? _string(json, 'action_type'),
      relatedId: _string(json, 'relatedId') ?? _string(json, 'related_id'),
      relatedType:
          _string(json, 'relatedType') ?? _string(json, 'related_type'),
      data: _map(json, 'data') ?? _map(json, 'fcm_payload') ?? const {},
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'title': title,
      'body': body,
      'createdAtMillis': createdAtMillis,
      'isRead': isRead,
      'route': route,
      'rawType': rawType,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'actionType': actionType,
      'relatedId': relatedId,
      'relatedType': relatedType,
      'data': data,
    };
  }
}

enum NotificationType { message, feed, system }

String? _string(Map<String, Object?> json, String key) {
  final value = json[key];
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

int? _int(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '');
}

bool? _bool(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is bool) return value;
  final text = value?.toString().trim().toLowerCase();
  if (text == 'true' || text == '1') return true;
  if (text == 'false' || text == '0') return false;
  return null;
}

int? _dateMillis(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is DateTime) return value.millisecondsSinceEpoch;
  return DateTime.tryParse(value?.toString() ?? '')?.millisecondsSinceEpoch;
}

Map<String, Object?>? _map(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is Map<String, Object?>) return value;
  if (value is Map) return Map<String, Object?>.from(value);
  return null;
}

String? _routeFromAction(Map<String, Object?> json) {
  final actionUrl = _string(json, 'action_url') ?? _string(json, 'actionUrl');
  if (actionUrl != null) return actionUrl;

  final actionType =
      _string(json, 'action_type') ?? _string(json, 'actionType');
  final relatedId = _string(json, 'related_id') ?? _string(json, 'relatedId');
  if (actionType == null || relatedId == null) return null;

  switch (actionType) {
    case 'open_profile':
      return 'feedin://profile/$relatedId';
    case 'open_post':
      return 'feedin://post/$relatedId';
    case 'open_conversation':
      return 'conversation:$relatedId';
    default:
      return null;
  }
}
