import '../../features/notifications/notification_item.dart';

abstract interface class NotificationRepositoryContract {
  Future<List<NotificationItem>> loadNotifications();
  Future<void> addNotification({
    required String title,
    required String body,
    String? route,
    String? rawType,
    String? displayName,
    String? avatarUrl,
  });
  Future<void> markRead(String notificationId);
  Future<void> markAllRead();
  Future<int> unreadCount();
  Future<void> clear();
}

abstract interface class NotificationDeletionContract {
  Future<void> deleteNotification(String notificationId);
}
