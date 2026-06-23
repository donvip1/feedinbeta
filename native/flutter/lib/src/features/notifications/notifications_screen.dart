import 'package:flutter/material.dart';

import '../../data/local/notification_repository_contract.dart';
import 'notification_item.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({
    super.key,
    required this.notificationRepository,
    required this.onOpenRoute,
  });

  final NotificationRepositoryContract notificationRepository;
  final ValueChanged<String> onOpenRoute;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<NotificationItem>> _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _notificationsFuture = widget.notificationRepository.loadNotifications();
  }

  Future<void> _markAllRead() async {
    await widget.notificationRepository.markAllRead();
    if (!mounted) return;
    setState(() {
      _notificationsFuture = widget.notificationRepository.loadNotifications();
    });
  }

  Future<void> _markRead(NotificationItem notification) async {
    await widget.notificationRepository.markRead(notification.id);
    if (!mounted) return;
    setState(() {
      _notificationsFuture = widget.notificationRepository.loadNotifications();
    });
  }

  Future<void> _open(NotificationItem notification) async {
    await widget.notificationRepository.markRead(notification.id);
    final route = notification.route;
    if (!mounted) return;
    if (route != null && route.trim().isNotEmpty) {
      widget.onOpenRoute(route);
      return;
    }
    setState(() {
      _notificationsFuture = widget.notificationRepository.loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<NotificationItem>>(
      future: _notificationsFuture,
      builder: (context, snapshot) {
        final notifications = snapshot.data;
        if (notifications == null) {
          return const Center(child: CircularProgressIndicator());
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: notifications.length + 1,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            if (index == 0) {
              return Row(
                children: [
                  Expanded(
                    child: Text(
                      'Notifications',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.done_all),
                    label: const Text('Read all'),
                    onPressed: _markAllRead,
                  ),
                ],
              );
            }

            final notification = notifications[index - 1];
            return Card(
              child: ListTile(
                onTap: () => _open(notification),
                leading: Icon(
                  notification.isRead
                      ? Icons.notifications_none
                      : Icons.notifications_active,
                  color: notification.isRead
                      ? Theme.of(context).colorScheme.onSurfaceVariant
                      : Theme.of(context).colorScheme.primary,
                ),
                title: Text(notification.title),
                subtitle: Text(notification.body),
                trailing: notification.isRead
                    ? null
                    : IconButton(
                        tooltip: 'Mark read',
                        onPressed: () => _markRead(notification),
                        icon: const Icon(Icons.check),
                      ),
              ),
            );
          },
        );
      },
    );
  }
}
