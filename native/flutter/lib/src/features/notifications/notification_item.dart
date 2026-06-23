class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAtMillis,
    required this.isRead,
    this.route,
  });

  final String id;
  final String title;
  final String body;
  final int createdAtMillis;
  final bool isRead;
  final String? route;

  NotificationItem copyWith({bool? isRead}) {
    return NotificationItem(
      id: id,
      title: title,
      body: body,
      createdAtMillis: createdAtMillis,
      isRead: isRead ?? this.isRead,
      route: route,
    );
  }

  factory NotificationItem.fromJson(Map<String, Object?> json) {
    return NotificationItem(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      createdAtMillis: json['createdAtMillis'] as int,
      isRead: json['isRead'] as bool? ?? false,
      route: json['route'] as String?,
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
    };
  }
}
