import 'package:supabase_flutter/supabase_flutter.dart';

/// One recently-viewed post resolved from the `get_view_history` RPC, joined to
/// its author profile. Decoupled from the UI view-models so the profile
/// presenter can map it into a `ViewHistoryItemView` without this layer
/// importing widgets.
class ViewedPost {
  const ViewedPost({
    required this.postId,
    required this.viewedAtMillis,
    this.content,
    this.mediaUrl,
    this.authorId,
    this.authorName,
    this.authorUsername,
    this.authorAvatarUrl,
  });

  final String postId;

  /// Epoch millis the post was viewed (for relative-time formatting).
  final int viewedAtMillis;

  final String? content;
  final String? mediaUrl;
  final String? authorId;
  final String? authorName;
  final String? authorUsername;
  final String? authorAvatarUrl;

  factory ViewedPost.fromJson(Map<String, Object?> json) {
    String? text(String key) {
      final value = json[key]?.toString();
      return (value != null && value.isNotEmpty) ? value : null;
    }

    return ViewedPost(
      postId: json['post_id']?.toString() ?? '',
      viewedAtMillis: _parseMillis(json['viewed_at']),
      content: text('content'),
      mediaUrl: text('media_url'),
      authorId: text('author_id'),
      authorName: text('author_name'),
      authorUsername: text('author_username'),
      authorAvatarUrl: text('author_avatar_url'),
    );
  }

  static int _parseMillis(Object? value) {
    if (value == null) return 0;
    return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch ?? 0;
  }
}

/// Live access to the post view-history contract.
///
/// Talks to the `post_view_history` table and the `record_post_view` /
/// `get_view_history` RPCs defined in the native migrations
/// `20260627143000_native_profile_social_contracts.sql` (table) and
/// `20260629120000_native_parity_rls_hardening.sql` (RPCs). The RPCs are
/// `security definer` and scope every read/write to `auth.uid()`, so this
/// source only forwards the post id / limit and maps the rows.
///
/// All methods degrade gracefully when Supabase is not configured or there is
/// no authenticated user: writes become no-ops and reads return empty lists.
class PostViewsRemoteDataSource {
  const PostViewsRemoteDataSource({required this.isConfigured});

  /// Convenience factory used by hosts that cannot see the app config: detects
  /// configuration from whether the Supabase singleton was initialised.
  factory PostViewsRemoteDataSource.autoDetect() {
    return PostViewsRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _viewHistoryTable = 'post_view_history';

  static bool _supabaseAvailable() {
    try {
      // Accessing the instance throws if Supabase was never initialised.
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

  /// Record that the current user viewed [postId]. Best-effort: the RPC upserts
  /// into `post_view_history` and bumps the post's `views_count`, but a failure
  /// must never disrupt the feed, so errors are swallowed.
  Future<void> recordView(String postId) async {
    final client = _client;
    if (client == null || _currentUserId == null || postId.isEmpty) return;
    try {
      await client.rpc<void>(
        'record_post_view',
        params: {'p_post_id': postId},
      );
    } catch (_) {
      // View recording is non-critical telemetry; ignore RLS / network errors.
    }
  }

  /// The current user's posts viewed in the last 48 hours, newest first. Throws
  /// on failure so the caller can render an explicit unavailable state.
  Future<List<ViewedPost>> fetchViewHistory({int limit = 50}) async {
    final client = _client;
    if (client == null || _currentUserId == null) return const [];

    final rows = await client.rpc<List<dynamic>>(
      'get_view_history',
      params: {'p_limit': limit},
    );

    return [
      for (final row in rows.whereType<Map>())
        ViewedPost.fromJson(Map<String, Object?>.from(row)),
    ];
  }

  /// Clear the current user's view history. RLS restricts the delete to the
  /// caller's own rows (`post_view_history` delete policy).
  Future<void> clearHistory() async {
    final client = _client;
    final userId = _currentUserId;
    if (client == null || userId == null) return;
    await client.from(_viewHistoryTable).delete().eq('user_id', userId);
  }
}
