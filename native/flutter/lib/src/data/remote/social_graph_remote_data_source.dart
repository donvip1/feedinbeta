import 'package:supabase_flutter/supabase_flutter.dart';

/// One follower/following row resolved from the `follows` table joined to
/// `profiles`. Decoupled from the UI view-models so the profile presenter can
/// map it into a [FollowRowView] without this layer importing widgets.
class SocialConnection {
  const SocialConnection({
    required this.userId,
    this.displayName,
    this.username,
    this.avatarUrl,
    this.bio,
    this.isFollowedByMe = false,
  });

  final String userId;
  final String? displayName;
  final String? username;
  final String? avatarUrl;
  final String? bio;

  /// Whether the viewer (current auth user) already follows this user. Used to
  /// render the Follow / Following toggle state in the connections modal.
  final bool isFollowedByMe;
}

/// Live social-graph access for the follow graph.
///
/// Talks to the `follows` table (columns: `follower_id`, `following_id`,
/// `created_at`) defined in the archive web schema and re-created in the native
/// migration `20260628020000_social_graph.sql`. Profile follower/following
/// counts are maintained by the DB trigger on that table, so this source only
/// performs the insert/delete and the list reads.
///
/// All methods degrade gracefully when Supabase is not configured or there is
/// no authenticated user: writes become no-ops and reads return empty lists.
class SocialGraphRemoteDataSource {
  const SocialGraphRemoteDataSource({required this.isConfigured});

  /// Convenience factory used by hosts that cannot see the app config: detects
  /// configuration from whether the Supabase singleton has an auth session.
  factory SocialGraphRemoteDataSource.autoDetect() {
    return SocialGraphRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _followsTable = 'follows';
  static const _profilesTable = 'profiles';

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

  /// Whether [followerId] follows [followingId] right now.
  Future<bool> isFollowing({
    required String followerId,
    required String followingId,
  }) async {
    final client = _client;
    if (client == null) return false;

    final row = await client
        .from(_followsTable)
        .select('follower_id')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
    return row != null;
  }

  /// Follow [followingId] as the current user. Idempotent: the table's unique
  /// (follower_id, following_id) constraint makes a repeat insert a no-op.
  Future<void> follow(String followingId) async {
    final client = _client;
    final followerId = _currentUserId;
    if (client == null || followerId == null) return;
    if (followerId == followingId) return;

    await client.from(_followsTable).upsert({
      'follower_id': followerId,
      'following_id': followingId,
    }, onConflict: 'follower_id,following_id', ignoreDuplicates: true);
  }

  /// Unfollow [followingId] as the current user.
  Future<void> unfollow(String followingId) async {
    final client = _client;
    final followerId = _currentUserId;
    if (client == null || followerId == null) return;

    await client
        .from(_followsTable)
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
  }

  /// Toggle the current user's follow relationship with [followingId].
  /// Returns the resulting state (true == now following).
  Future<bool> toggleFollow(String followingId) async {
    final followerId = _currentUserId;
    if (_client == null || followerId == null) return false;

    final following = await isFollowing(
      followerId: followerId,
      followingId: followingId,
    );
    if (following) {
      await unfollow(followingId);
      return false;
    }
    await follow(followingId);
    return true;
  }

  /// Users who follow [userId] (the Followers tab), newest first.
  Future<List<SocialConnection>> fetchFollowers(String userId) async {
    return _fetchConnections(
      pivotColumn: 'following_id',
      pivotValue: userId,
      profileColumn: 'follower_id',
    );
  }

  /// Users [userId] follows (the Following tab), newest first.
  Future<List<SocialConnection>> fetchFollowing(String userId) async {
    return _fetchConnections(
      pivotColumn: 'follower_id',
      pivotValue: userId,
      profileColumn: 'following_id',
    );
  }

  /// Shared list reader. Selects rows where [pivotColumn] == [pivotValue] and
  /// embeds the profile referenced by [profileColumn]. Marks each row with
  /// whether the current viewer follows that user so the toggle renders right.
  Future<List<SocialConnection>> _fetchConnections({
    required String pivotColumn,
    required String pivotValue,
    required String profileColumn,
  }) async {
    final client = _client;
    if (client == null) return const [];

    // Disambiguate the embed by FK column (`follows` has two FKs to profiles)
    // using PostgREST's `relation!column` hint, which does not depend on the
    // auto-generated constraint name.
    final rows = await client
        .from(_followsTable)
        .select(
          '$profileColumn, created_at, '
          'profile:$_profilesTable!$profileColumn('
          'id, display_name, username, avatar_url, bio)',
        )
        .eq(pivotColumn, pivotValue)
        .order('created_at', ascending: false);

    final list = rows.whereType<Map>().toList();
    if (list.isEmpty) return const [];

    // Resolve which of these users the viewer already follows in one query.
    final viewerId = _currentUserId;
    final ids = <String>[
      for (final row in list)
        if (_profileId(row, profileColumn) case final id?) id,
    ];
    final followedByMe = await _viewerFollowingSet(viewerId, ids);

    return [
      for (final row in list)
        if (_mapConnection(row, profileColumn, followedByMe) case final c?) c,
    ];
  }

  /// Of [candidateIds], the subset that [viewerId] currently follows.
  Future<Set<String>> _viewerFollowingSet(
    String? viewerId,
    List<String> candidateIds,
  ) async {
    final client = _client;
    if (client == null || viewerId == null || candidateIds.isEmpty) {
      return const {};
    }

    final rows = await client
        .from(_followsTable)
        .select('following_id')
        .eq('follower_id', viewerId)
        .inFilter('following_id', candidateIds);

    return {
      for (final row in rows.whereType<Map>())
        if (row['following_id']?.toString() case final id?) id,
    };
  }

  static String? _profileId(Map<dynamic, dynamic> row, String profileColumn) {
    final profile = row['profile'];
    if (profile is Map && profile['id'] != null) {
      return profile['id'].toString();
    }
    // Fallback to the raw FK value if the embed did not resolve.
    return row[profileColumn]?.toString();
  }

  static SocialConnection? _mapConnection(
    Map<dynamic, dynamic> row,
    String profileColumn,
    Set<String> followedByMe,
  ) {
    final profile = row['profile'];
    final id = _profileId(row, profileColumn);
    if (id == null || id.isEmpty) return null;

    String? text(String key) {
      if (profile is Map) {
        final value = profile[key]?.toString();
        if (value != null && value.isNotEmpty) return value;
      }
      return null;
    }

    return SocialConnection(
      userId: id,
      displayName: text('display_name'),
      username: text('username'),
      avatarUrl: text('avatar_url'),
      bio: text('bio'),
      isFollowedByMe: followedByMe.contains(id),
    );
  }
}
