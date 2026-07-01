import 'package:supabase_flutter/supabase_flutter.dart';

/// One ended live space resolved from the `live_spaces` table for a user's
/// "Past Spaces" section. Decoupled from the UI view-models so the profile
/// presenter can map it into a `PastSpaceView` without this layer importing
/// widgets.
///
/// Column mapping mirrors the web `PastSpaces.tsx` query. The native
/// `live_spaces` table (migrations `20260624000100_native_core_schema.sql` +
/// `20260624000600_native_advanced_live_calls_schema.sql`) has: id, user_id,
/// title, description, status, viewer_count, recording_url, started_at,
/// ended_at. It does NOT have the web `cover_image_url` column, so cover
/// thumbnails are unavailable natively (the card falls back to the mic icon,
/// which matches the web behaviour when a space has no cover).
class PastSpace {
  const PastSpace({
    required this.id,
    required this.title,
    this.description,
    this.startedAtMillis,
    this.endedAtMillis,
    this.viewerCount = 0,
    this.recordingUrl,
    this.coverImageUrl,
  });

  final String id;
  final String title;
  final String? description;

  /// Epoch millis the space started / ended; null when the timestamp was unset.
  final int? startedAtMillis;
  final int? endedAtMillis;

  final int viewerCount;

  /// Non-null when a replay recording exists (drives the Replay pill + play
  /// overlay). The web renders a play glyph over the cover when present.
  final String? recordingUrl;

  /// Cover thumbnail. Always null natively (no `cover_image_url` column); kept
  /// on the model so the mapper/widget contract matches the web 1:1 and can
  /// light up automatically if the column is added later.
  final String? coverImageUrl;

  factory PastSpace.fromJson(Map<String, Object?> json) {
    String? text(String key) {
      final value = json[key]?.toString();
      return (value != null && value.isNotEmpty) ? value : null;
    }

    return PastSpace(
      id: json['id']?.toString() ?? '',
      title: text('title') ?? 'Live space',
      description: text('description'),
      startedAtMillis: _parseMillis(json['started_at']),
      endedAtMillis: _parseMillis(json['ended_at']),
      viewerCount: _parseInt(json['viewer_count']),
      recordingUrl: text('recording_url'),
      coverImageUrl: text('cover_image_url'),
    );
  }

  static int? _parseMillis(Object? value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
  }

  static int _parseInt(Object? value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}

/// Live access to the extra profile sections that native previously omitted:
/// a user's ended live spaces (web `PastSpaces`) and a total-likes aggregate
/// used by the header "Likes" stat.
///
/// Modeled on [SocialGraphRemoteDataSource]: it auto-detects the Supabase
/// singleton, exposes an `isConfigured` flag, and every method degrades
/// gracefully when Supabase is unavailable or there is no authenticated user
/// (reads return empty / zero rather than throwing).
class ProfileSectionsRemoteDataSource {
  const ProfileSectionsRemoteDataSource({required this.isConfigured});

  /// Convenience factory used by hosts that cannot see the app config: detects
  /// configuration from whether the Supabase singleton was initialised.
  factory ProfileSectionsRemoteDataSource.autoDetect() {
    return ProfileSectionsRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _liveSpacesTable = 'live_spaces';
  static const _postsTable = 'posts';

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

  /// A user's ended live spaces, newest first (web `PastSpaces` query:
  /// `status = 'ended'` ordered by `ended_at desc`, limited to 10). Returns an
  /// empty list when Supabase is unavailable so the card simply hides.
  Future<List<PastSpace>> fetchPastSpaces(String userId, {int limit = 10}) async {
    final client = _client;
    if (client == null || userId.isEmpty) return const [];

    try {
      final rows = await client
          .from(_liveSpacesTable)
          .select(
            'id, title, description, started_at, ended_at, '
            'viewer_count, recording_url',
          )
          .eq('user_id', userId)
          .eq('status', 'ended')
          .order('ended_at', ascending: false)
          .limit(limit);

      return [
        for (final row in rows.whereType<Map>())
          PastSpace.fromJson(Map<String, Object?>.from(row)),
      ];
    } catch (_) {
      // Section is best-effort; never let a schema/RLS hiccup break the profile.
      return const [];
    }
  }

  /// Total likes across a user's active posts (web header "Likes" stat, which
  /// mirrors the `get_user_total_likes` RPC). Native has no such RPC, so this
  /// sums `posts.likes_count` for the user's active posts client-side. Returns
  /// 0 on any failure.
  Future<int> fetchTotalLikes(String userId) async {
    final client = _client;
    if (client == null || userId.isEmpty) return 0;

    try {
      final rows = await client
          .from(_postsTable)
          .select('likes_count')
          .eq('user_id', userId)
          .eq('status', 'active');

      var total = 0;
      for (final row in rows.whereType<Map>()) {
        final value = row['likes_count'];
        if (value is int) {
          total += value;
        } else {
          total += int.tryParse(value?.toString() ?? '') ?? 0;
        }
      }
      return total;
    } catch (_) {
      return 0;
    }
  }
}
