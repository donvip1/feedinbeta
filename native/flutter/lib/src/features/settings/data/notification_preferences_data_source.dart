import 'package:supabase_flutter/supabase_flutter.dart';

/// Per-type notification toggles for the current user.
///
/// Mirrors the columns of the live `notification_preferences` table created in
/// `supabase/migrations/20260627143200_native_notifications_contracts.sql`
/// (user_id PK + one `*_enabled` boolean per notification kind + email).
/// Field names track the SQL columns so [fromRow]/[toRow] are a straight map.
class NotificationPreferences {
  const NotificationPreferences({
    this.pushEnabled = true,
    this.likesEnabled = true,
    this.commentsEnabled = true,
    this.repliesEnabled = true,
    this.mentionsEnabled = true,
    this.followsEnabled = true,
    this.messagesEnabled = true,
    this.friendRequestsEnabled = true,
    this.storiesEnabled = true,
    this.badgesEnabled = true,
    this.emailEnabled = false,
  });

  final bool pushEnabled;
  final bool likesEnabled;
  final bool commentsEnabled;
  final bool repliesEnabled;
  final bool mentionsEnabled;
  final bool followsEnabled;
  final bool messagesEnabled;
  final bool friendRequestsEnabled;
  final bool storiesEnabled;
  final bool badgesEnabled;
  final bool emailEnabled;

  static const defaults = NotificationPreferences();

  /// Read a single boolean field by its SQL column key (used by the UI so a
  /// generic toggle list can drive [copyWithKey] without a giant switch there).
  bool valueOf(String key) {
    switch (key) {
      case 'push_enabled':
        return pushEnabled;
      case 'likes_enabled':
        return likesEnabled;
      case 'comments_enabled':
        return commentsEnabled;
      case 'replies_enabled':
        return repliesEnabled;
      case 'mentions_enabled':
        return mentionsEnabled;
      case 'follows_enabled':
        return followsEnabled;
      case 'messages_enabled':
        return messagesEnabled;
      case 'friend_requests_enabled':
        return friendRequestsEnabled;
      case 'stories_enabled':
        return storiesEnabled;
      case 'badges_enabled':
        return badgesEnabled;
      case 'email_enabled':
        return emailEnabled;
      default:
        return false;
    }
  }

  NotificationPreferences copyWithKey(String key, bool value) {
    return NotificationPreferences(
      pushEnabled: key == 'push_enabled' ? value : pushEnabled,
      likesEnabled: key == 'likes_enabled' ? value : likesEnabled,
      commentsEnabled: key == 'comments_enabled' ? value : commentsEnabled,
      repliesEnabled: key == 'replies_enabled' ? value : repliesEnabled,
      mentionsEnabled: key == 'mentions_enabled' ? value : mentionsEnabled,
      followsEnabled: key == 'follows_enabled' ? value : followsEnabled,
      messagesEnabled: key == 'messages_enabled' ? value : messagesEnabled,
      friendRequestsEnabled: key == 'friend_requests_enabled'
          ? value
          : friendRequestsEnabled,
      storiesEnabled: key == 'stories_enabled' ? value : storiesEnabled,
      badgesEnabled: key == 'badges_enabled' ? value : badgesEnabled,
      emailEnabled: key == 'email_enabled' ? value : emailEnabled,
    );
  }

  factory NotificationPreferences.fromRow(Map<dynamic, dynamic> row) {
    bool read(String key, bool fallback) {
      final value = row[key];
      if (value is bool) return value;
      return fallback;
    }

    return NotificationPreferences(
      pushEnabled: read('push_enabled', defaults.pushEnabled),
      likesEnabled: read('likes_enabled', defaults.likesEnabled),
      commentsEnabled: read('comments_enabled', defaults.commentsEnabled),
      repliesEnabled: read('replies_enabled', defaults.repliesEnabled),
      mentionsEnabled: read('mentions_enabled', defaults.mentionsEnabled),
      followsEnabled: read('follows_enabled', defaults.followsEnabled),
      messagesEnabled: read('messages_enabled', defaults.messagesEnabled),
      friendRequestsEnabled: read(
        'friend_requests_enabled',
        defaults.friendRequestsEnabled,
      ),
      storiesEnabled: read('stories_enabled', defaults.storiesEnabled),
      badgesEnabled: read('badges_enabled', defaults.badgesEnabled),
      emailEnabled: read('email_enabled', defaults.emailEnabled),
    );
  }

  Map<String, Object?> toRow() {
    return {
      'push_enabled': pushEnabled,
      'likes_enabled': likesEnabled,
      'comments_enabled': commentsEnabled,
      'replies_enabled': repliesEnabled,
      'mentions_enabled': mentionsEnabled,
      'follows_enabled': followsEnabled,
      'messages_enabled': messagesEnabled,
      'friend_requests_enabled': friendRequestsEnabled,
      'stories_enabled': storiesEnabled,
      'badges_enabled': badgesEnabled,
      'email_enabled': emailEnabled,
    };
  }
}

/// Live read/write access to the `notification_preferences` table.
///
/// Modelled on `data/remote/social_graph_remote_data_source.dart`: all methods
/// degrade to a no-op / defaults when Supabase is unconfigured or there is no
/// authenticated user, so screens using [autoDetect] build and run offline.
class NotificationPreferencesDataSource {
  const NotificationPreferencesDataSource({required this.isConfigured});

  factory NotificationPreferencesDataSource.autoDetect() {
    return NotificationPreferencesDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _table = 'notification_preferences';

  static bool _supabaseAvailable() {
    try {
      Supabase.instance.client;
      return true;
    } catch (_) {
      return false;
    }
  }

  SupabaseClient? get _client {
    if (!isConfigured) return null;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  String? get _currentUserId => _client?.auth.currentUser?.id;

  /// Whether a live backend is reachable for this source right now. The UI uses
  /// this to decide between "saved to your account" and a local-only notice.
  bool get isLive => _client != null && _currentUserId != null;

  /// Load the current user's preferences, or [NotificationPreferences.defaults]
  /// when unavailable / not yet created.
  Future<NotificationPreferences> load() async {
    final client = _client;
    final userId = _currentUserId;
    if (client == null || userId == null) {
      return NotificationPreferences.defaults;
    }

    final row = await client
        .from(_table)
        .select()
        .eq('user_id', userId)
        .maybeSingle();
    if (row == null) return NotificationPreferences.defaults;
    return NotificationPreferences.fromRow(row);
  }

  /// Upsert the full preferences row for the current user. No-op when offline.
  Future<void> save(NotificationPreferences prefs) async {
    final client = _client;
    final userId = _currentUserId;
    if (client == null || userId == null) return;

    await client.from(_table).upsert({
      'user_id': userId,
      ...prefs.toRow(),
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }, onConflict: 'user_id');
  }
}
