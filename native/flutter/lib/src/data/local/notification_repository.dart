import 'package:hive_ce/hive.dart';
import 'package:uuid/uuid.dart';

import '../../features/notifications/notification_item.dart';
import 'local_record_decoder.dart';
import 'notification_repository_contract.dart';

class NotificationRepository implements NotificationRepositoryContract {
  NotificationRepository({required Box<Map> box}) : _box = box;

  final Box<Map> _box;

  @override
  Future<List<NotificationItem>> loadNotifications() async {
    await _seedIfEmpty();
    final notifications =
        _box.values
            .map((value) => decodeLocalRecord(value, NotificationItem.fromJson))
            .whereType<NotificationItem>()
            .toList()
          ..sort((a, b) => b.createdAtMillis.compareTo(a.createdAtMillis));
    return notifications;
  }

  @override
  Future<void> addNotification({
    required String title,
    required String body,
    String? route,
  }) async {
    final notification = NotificationItem(
      id: const Uuid().v4(),
      title: title,
      body: body,
      createdAtMillis: DateTime.now().millisecondsSinceEpoch,
      isRead: false,
      route: route,
    );
    await _box.put(notification.id, notification.toJson());
  }

  @override
  Future<void> markRead(String notificationId) async {
    final raw = _box.get(notificationId);
    if (raw == null) return;

    final notification = NotificationItem.fromJson(
      Map<String, Object?>.from(raw),
    );
    await _box.put(notificationId, notification.copyWith(isRead: true).toJson());
  }

  @override
  Future<void> markAllRead() async {
    for (final key in _box.keys) {
      final raw = _box.get(key);
      if (raw == null) continue;
      final notification = NotificationItem.fromJson(
        Map<String, Object?>.from(raw),
      );
      await _box.put(key, notification.copyWith(isRead: true).toJson());
    }
  }

  @override
  Future<int> unreadCount() async {
    final notifications = await loadNotifications();
    return notifications.where((notification) => !notification.isRead).length;
  }

  @override
  Future<void> clear() async {
    await _box.clear();
  }

  Future<void> _seedIfEmpty() async {
    if (_box.isNotEmpty) return;
    await addNotification(
      title: 'FEEDIN notifications ready',
      body: 'Push notifications will appear here after Firebase is connected.',
    );
  }
}
