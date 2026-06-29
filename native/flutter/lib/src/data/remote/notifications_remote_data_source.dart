import 'package:supabase_flutter/supabase_flutter.dart';

/// Remote reader/writer for the live `public.notifications` table.
///
/// Column shape is matched against the live schema
/// (`supabase/migrations/20260624000100_native_core_schema.sql` +
/// `20260627143200_native_notifications_contracts.sql`), which itself is a
/// superset of the original web-app table defined in
/// `migrations_archive_lovable/20251101121239_*.sql`:
///
///   id, user_id, from_user_id, type, title, message, related_id,
///   related_type, action_type, action_url, route, data (jsonb),
///   is_read, read_at, created_at
///
/// Only columns that exist in BOTH the archive and the native contract are
/// selected so the query can never trip the schema-cache "missing column"
/// error that broke the earlier post insert. The sender `profiles` join is the
/// only relational read; everything else is a flat column.
///
/// Read-state mutations prefer the security-definer RPCs declared in the native
/// notifications contract (`mark_notification_read`,
/// `mark_all_notifications_read`) and fall back to direct, RLS-guarded table
/// updates. This data source never sends FCM / push payloads (backend-blocked).
class NotificationsRemoteDataSource {
  const NotificationsRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  /// Columns selected from `notifications`. Kept to the intersection of the
  /// archive table and the native contract so the select is schema-safe.
  static const String _columns =
      'id, user_id, from_user_id, type, title, message, related_id, '
      'related_type, action_type, action_url, route, data, is_read, '
      'read_at, created_at, from_profile:profiles!notifications_from_user_id_fkey(display_name, username, avatar_url)';

  /// Fetches the signed-in user's notifications, newest first.
  ///
  /// Returns an empty list when Supabase is not configured or there is no
  /// authenticated session, so callers can fall back to the local Hive cache.
  Future<List<RemoteNotification>> fetchNotifications({int limit = 100}) async {
    if (!isConfigured) return const [];

    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return const [];

    final rows = await client
        .from('notifications')
        .select(_columns)
        .eq('user_id', userId)
        .order('created_at', ascending: false)
        .limit(limit);

    return rows
        .whereType<Map>()
        .map(
          (row) => RemoteNotification.fromJson(Map<String, Object?>.from(row)),
        )
        .toList();
  }

  /// Marks a single notification read on the server.
  ///
  /// Prefers the `mark_notification_read` RPC (security definer, sets
  /// `read_at`); falls back to a direct RLS-guarded update if the RPC is
  /// unavailable.
  Future<void> markRead(String notificationId) async {
    if (!isConfigured) return;
    final client = Supabase.instance.client;
    try {
      await client.rpc<void>(
        'mark_notification_read',
        params: {'p_notification_id': notificationId},
      );
    } catch (_) {
      await client
          .from('notifications')
          .update({
            'is_read': true,
            'read_at': DateTime.now().toUtc().toIso8601String(),
          })
          .eq('id', notificationId);
    }
  }

  /// Marks every unread notification for the signed-in user read on the server.
  Future<void> markAllRead() async {
    if (!isConfigured) return;
    final client = Supabase.instance.client;
    try {
      await client.rpc<void>('mark_all_notifications_read');
    } catch (_) {
      final userId = client.auth.currentUser?.id;
      if (userId == null) return;
      await client
          .from('notifications')
          .update({
            'is_read': true,
            'read_at': DateTime.now().toUtc().toIso8601String(),
          })
          .eq('user_id', userId)
          .eq('is_read', false);
    }
  }

  /// Deletes a notification on the server (RLS restricts this to the owner).
  Future<void> deleteNotification(String notificationId) async {
    if (!isConfigured) return;
    await Supabase.instance.client
        .from('notifications')
        .delete()
        .eq('id', notificationId);
  }
}

/// A single notification row read from the live `notifications` table,
/// normalized into the snake_case keys the local `NotificationItem.fromJson`
/// already understands.
class RemoteNotification {
  const RemoteNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAtMillis,
    required this.isRead,
    this.type,
    this.route,
    this.actionType,
    this.relatedId,
    this.relatedType,
    this.displayName,
    this.avatarUrl,
    this.data = const <String, Object?>{},
  });

  final String id;
  final String title;
  final String body;
  final int createdAtMillis;
  final bool isRead;
  final String? type;
  final String? route;
  final String? actionType;
  final String? relatedId;
  final String? relatedType;
  final String? displayName;
  final String? avatarUrl;
  final Map<String, Object?> data;

  factory RemoteNotification.fromJson(Map<String, Object?> json) {
    final profile = json['from_profile'];
    final profileMap = profile is Map
        ? Map<String, Object?>.from(profile)
        : null;
    final displayName = _nonEmpty(profileMap?['display_name']);
    final username = _nonEmpty(profileMap?['username']);

    return RemoteNotification(
      id: json['id'].toString(),
      title: _nonEmpty(json['title']) ?? 'Notification',
      body: _nonEmpty(json['message']) ?? '',
      createdAtMillis: _parseMillis(json['created_at']),
      isRead: json['is_read'] == true,
      type: _nonEmpty(json['type']),
      route: _nonEmpty(json['route']) ?? _nonEmpty(json['action_url']),
      actionType: _nonEmpty(json['action_type']),
      relatedId: _nonEmpty(json['related_id']),
      relatedType: _nonEmpty(json['related_type']),
      displayName: displayName ?? (username == null ? null : '@$username'),
      avatarUrl: _nonEmpty(profileMap?['avatar_url']),
      data: _asMap(json['data']),
    );
  }

  /// Serializes to the snake_case JSON shape consumed by
  /// `NotificationItem.fromJson` so the materializer can persist it verbatim
  /// into the local Hive cache.
  Map<String, Object?> toLocalJson() {
    return {
      'id': id,
      'title': title,
      'message': body,
      'created_at_millis': createdAtMillis,
      'is_read': isRead,
      'type': type,
      'route': route,
      'action_type': actionType,
      'related_id': relatedId,
      'related_type': relatedType,
      'display_name': displayName,
      'avatar_url': avatarUrl,
      'data': data,
    };
  }
}

String? _nonEmpty(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

Map<String, Object?> _asMap(Object? value) {
  if (value is Map<String, Object?>) return value;
  if (value is Map) return Map<String, Object?>.from(value);
  return const <String, Object?>{};
}

int _parseMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  return parsed?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}
