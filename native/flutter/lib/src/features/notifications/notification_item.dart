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
          _string(json, 'deep_link'),
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
