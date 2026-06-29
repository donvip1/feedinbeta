import 'package:hive_ce/hive.dart';
import 'package:uuid/uuid.dart';

import '../../features/notifications/notification_item.dart';
import '../remote/notifications_remote_data_source.dart';
import 'local_record_decoder.dart';
import 'notification_repository_contract.dart';

/// Offline-first notifications repository.
///
/// The local Hive [box] is the source of truth the UI reads from. When a
/// [NotificationsRemoteDataSource] is supplied (i.e. Supabase is configured),
/// [loadNotifications] first materializes the signed-in user's rows from the
/// live `notifications` table into the box, then reads back from the box — so
/// the cache always reflects the server while still working fully offline when
/// the network or session is unavailable (the remote read fails soft).
///
/// Mutations are optimistic: the local cache is updated first, then the change
/// is propagated to the server. Remote failures are swallowed so the UI stays
/// responsive offline; the next successful [loadNotifications] reconciles state.
class NotificationRepository
    implements NotificationRepositoryContract, NotificationDeletionContract {
  NotificationRepository({
    required Box<Map> box,
    NotificationsRemoteDataSource? remoteDataSource,
  }) : _box = box,
       _remoteDataSource = remoteDataSource;

  final Box<Map> _box;
  final NotificationsRemoteDataSource? _remoteDataSource;

  bool get _hasRemote => _remoteDataSource?.isConfigured ?? false;

  @override
  Future<List<NotificationItem>> loadNotifications() async {
    await _materializeRemote();
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
    String? rawType,
    String? displayName,
    String? avatarUrl,
  }) async {
    final notification = NotificationItem(
      id: const Uuid().v4(),
      title: title,
      body: body,
      createdAtMillis: DateTime.now().millisecondsSinceEpoch,
      isRead: false,
      route: route,
      rawType: rawType,
      displayName: displayName,
      avatarUrl: avatarUrl,
    );
    await _box.put(notification.id, notification.toJson());
  }

  @override
  Future<void> markRead(String notificationId) async {
    final raw = _box.get(notificationId);
    if (raw != null) {
      final notification = NotificationItem.fromJson(
        Map<String, Object?>.from(raw),
      );
      await _box.put(
        notificationId,
        notification.copyWith(isRead: true).toJson(),
      );
    }
    await _propagate(() => _remoteDataSource!.markRead(notificationId));
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
    await _propagate(() => _remoteDataSource!.markAllRead());
  }

  @override
  Future<void> deleteNotification(String notificationId) async {
    await _box.delete(notificationId);
    await _propagate(
      () => _remoteDataSource!.deleteNotification(notificationId),
    );
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

  /// Pulls the live notifications for the signed-in user and overwrites the
  /// local cache with the server view. Fails soft: any error (offline, no
  /// session, schema hiccup) leaves the existing local cache untouched so the
  /// UI keeps working from the last good snapshot.
  Future<void> _materializeRemote() async {
    final remote = _remoteDataSource;
    if (remote == null || !remote.isConfigured) return;

    try {
      final remoteNotifications = await remote.fetchNotifications();
      // Replace the cache with the authoritative server set. We clear first so
      // server-side deletions are reflected locally. If the user genuinely has
      // no notifications the box ends up empty, and _seedIfEmpty is
      // intentionally skipped for remote sessions.
      await _box.clear();
      for (final notification in remoteNotifications) {
        await _box.put(notification.id, notification.toLocalJson());
      }
    } catch (_) {
      // Keep the existing local cache as the offline fallback.
    }
  }

  /// Runs a remote mutation when a configured data source is present, swallowing
  /// errors so offline-first behaviour is preserved.
  Future<void> _propagate(Future<void> Function() action) async {
    if (!_hasRemote) return;
    try {
      await action();
    } catch (_) {
      // Offline / transient failure — local state already updated; the next
      // successful load reconciles with the server.
    }
  }

  /// Seeds a single onboarding row only in local-only (no Supabase) mode, so
  /// live accounts never see a synthetic notification.
  Future<void> _seedIfEmpty() async {
    if (_box.isNotEmpty) return;
    if (_hasRemote) return;
    await addNotification(
      title: 'feedIn notifications ready',
      body: 'Push notifications will appear here after Firebase is connected.',
    );
  }
}
