import 'package:supabase_flutter/supabase_flutter.dart';

/// One blocked or muted user, resolved from `blocked_users` / `muted_users`
/// joined to a public profile view. Ports the web BlockedUsers list item shape.
class ModeratedUser {
  const ModeratedUser({
    required this.rowId,
    required this.userId,
    this.displayName,
    this.username,
    this.avatarUrl,
    this.expiresAt,
  });

  /// Primary key of the block/mute row (used to delete on unblock/unmute).
  final String rowId;

  /// The blocked/muted profile id.
  final String userId;
  final String? displayName;
  final String? username;
  final String? avatarUrl;

  /// Mute-only: when the mute lapses (null == indefinite).
  final DateTime? expiresAt;
}

/// The outcome of a block/mute list read: either the resolved list, or a flag
/// that the backing table is missing so the UI can surface the gap instead of
/// an error.
class ModeratedListResult {
  const ModeratedListResult({required this.users, required this.available});

  const ModeratedListResult.unavailable()
    : users = const [],
      available = false;

  final List<ModeratedUser> users;

  /// False when the backing table does not exist / is not reachable.
  final bool available;
}

/// Live access to the block / mute lists.
///
/// IMPORTANT BACKEND GAP: the `blocked_users` and `muted_users` tables (and the
/// `public_profiles` view) exist in the archived web schema but are NOT part of
/// the native `supabase/migrations/*`. Every read therefore guards against a
/// missing relation and returns [ModeratedListResult.unavailable] so the screen
/// renders an explanatory empty state rather than throwing. Writes are no-ops
/// when the table is absent. Modelled on
/// `data/remote/social_graph_remote_data_source.dart`.
class BlockedUsersDataSource {
  const BlockedUsersDataSource({required this.isConfigured});

  factory BlockedUsersDataSource.autoDetect() {
    return BlockedUsersDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _blockedTable = 'blocked_users';
  static const _mutedTable = 'muted_users';
  static const _profilesTable = 'profiles';

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

  Future<ModeratedListResult> fetchBlocked() {
    return _fetch(
      table: _blockedTable,
      ownerColumn: 'blocker_id',
      targetColumn: 'blocked_id',
    );
  }

  Future<ModeratedListResult> fetchMuted() {
    return _fetch(
      table: _mutedTable,
      ownerColumn: 'muter_id',
      targetColumn: 'muted_id',
      withExpiry: true,
    );
  }

  /// Delete a block/mute row by primary key. Returns true when a delete was
  /// attempted (i.e. table reachable & authenticated).
  Future<bool> unblock(String rowId) => _delete(_blockedTable, rowId);

  Future<bool> unmute(String rowId) => _delete(_mutedTable, rowId);

  Future<bool> _delete(String table, String rowId) async {
    final client = _client;
    if (client == null || _currentUserId == null) return false;
    try {
      await client.from(table).delete().eq('id', rowId);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<ModeratedListResult> _fetch({
    required String table,
    required String ownerColumn,
    required String targetColumn,
    bool withExpiry = false,
  }) async {
    final client = _client;
    final userId = _currentUserId;
    if (client == null || userId == null) {
      return const ModeratedListResult.unavailable();
    }

    try {
      final rows = await client
          .from(table)
          .select(
            'id, $targetColumn${withExpiry ? ', expires_at' : ''}, '
            'profile:$_profilesTable!$targetColumn('
            'id, display_name, username, avatar_url)',
          )
          .eq(ownerColumn, userId);

      final users = <ModeratedUser>[];
      for (final row in rows.whereType<Map>()) {
        final profile = row['profile'];
        final targetId = row[targetColumn]?.toString();
        if (targetId == null) continue;
        DateTime? expiresAt;
        final rawExpiry = row['expires_at'];
        if (rawExpiry is String) {
          expiresAt = DateTime.tryParse(rawExpiry);
        }
        users.add(
          ModeratedUser(
            rowId: row['id'].toString(),
            userId: targetId,
            displayName: profile is Map
                ? profile['display_name']?.toString()
                : null,
            username: profile is Map
                ? profile['username']?.toString()
                : null,
            avatarUrl: profile is Map
                ? profile['avatar_url']?.toString()
                : null,
            expiresAt: expiresAt,
          ),
        );
      }
      return ModeratedListResult(users: users, available: true);
    } catch (_) {
      // Missing relation / RLS / column -> treat as unavailable so the screen
      // shows the backend-gap empty state instead of an error.
      return const ModeratedListResult.unavailable();
    }
  }
}
