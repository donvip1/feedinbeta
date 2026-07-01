import 'package:supabase_flutter/supabase_flutter.dart';

import 'channel_models.dart';

/// Live backend access for the Telegram-style Channels feature.
///
/// BACKEND MODEL (important): the channel tables DO NOT yet exist in the
/// applied native migrations. This source is written against a clear, minimal
/// schema (flagged in the module report) so it "just works" once the tables
/// land, and degrades to honest empty / "coming soon" states until then:
///
///   * `public.channels`
///       id uuid pk, owner_id uuid -> profiles(id), name text, slug text unique,
///       description text, avatar_url text, is_verified bool default false,
///       subscriber_count int default 0, created_at timestamptz, updated_at ...
///   * `public.channel_subscribers`
///       channel_id uuid -> channels(id), user_id uuid -> profiles(id),
///       role text default 'subscriber' check in ('owner','admin','subscriber'),
///       created_at timestamptz, primary key (channel_id, user_id)
///   * `public.channel_posts`
///       id uuid pk, channel_id uuid -> channels(id), author_id uuid ->
///       profiles(id), content text, media_url text, media_type text,
///       view_count int default 0, created_at timestamptz
///
/// RLS the module assumes (recommended shared change):
///   * anyone may SELECT `channels` (discoverable) + `channel_posts` of a
///     channel they can see; only owner/admin rows in `channel_subscribers`
///     may INSERT into `channel_posts`.
///   * a user may INSERT/DELETE their OWN `channel_subscribers` row (subscribe
///     / unsubscribe) via `using (auth.uid() = user_id)`.
///   * `subscriber_count` maintained by a trigger on `channel_subscribers`
///     (same pattern as `follows` -> `profiles.followers_count`); this source
///     never writes the count directly.
///
/// EVERY method degrades gracefully: when Supabase is unconfigured, there is no
/// auth session, OR the tables/columns are missing (PostgREST throws), reads
/// return empty and writes/creates become no-ops. Callers therefore never need
/// try/catch and the UI shows empty/"coming soon" instead of crashing.
class ChannelsRemoteDataSource {
  const ChannelsRemoteDataSource({required this.isConfigured});

  /// Convenience factory for hosts that cannot see the app config: detects
  /// configuration from whether the Supabase singleton was initialised. Mirrors
  /// [SocialGraphRemoteDataSource.autoDetect] / [GroupsRemoteDataSource].
  factory ChannelsRemoteDataSource.autoDetect() {
    return ChannelsRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const String _channelsTable = 'channels';
  static const String _subscribersTable = 'channel_subscribers';
  static const String _postsTable = 'channel_posts';
  static const String _profilesView = 'public_profiles';

  static const String roleOwner = 'owner';
  static const String roleAdmin = 'admin';
  static const String roleSubscriber = 'subscriber';

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

  String? get currentUserId => _client?.auth.currentUser?.id;

  /// Whether the current viewer is signed in (used by the UI to gate the
  /// create-channel affordance and the subscribe toggle).
  bool get hasSession => currentUserId != null;

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /// Discoverable channels for the "Discover" tab, most-subscribed first. Marks
  /// each with whether the current viewer is subscribed (and their role) so the
  /// list can render the Join/Joined state without a second round trip.
  Future<List<RemoteChannel>> fetchDiscoverChannels({
    String query = '',
    int limit = 40,
  }) async {
    final client = _client;
    if (client == null) return const [];

    try {
      var request = client
          .from(_channelsTable)
          .select(
            'id, owner_id, name, slug, description, avatar_url, '
            'is_verified, subscriber_count, created_at',
          );

      final normalized = query.trim().replaceFirst(RegExp('^@'), '');
      if (normalized.isNotEmpty) {
        request = request.or(
          'name.ilike.%$normalized%,slug.ilike.%$normalized%,'
          'description.ilike.%$normalized%',
        );
      }

      final rows = await request
          .order('subscriber_count', ascending: false)
          .limit(limit);

      return _decorateWithMembership(client, rows.whereType<Map>().toList());
    } catch (_) {
      // Tables not provisioned yet, or RLS blocks the read: honest empty.
      return const [];
    }
  }

  /// Channels the current viewer subscribes to (the "My channels" tab),
  /// most-recently-joined first, each carrying the viewer's role.
  Future<List<RemoteChannel>> fetchMyChannels() async {
    final client = _client;
    final me = currentUserId;
    if (client == null || me == null) return const [];

    try {
      final memberships = await client
          .from(_subscribersTable)
          .select('channel_id, role, created_at')
          .eq('user_id', me)
          .order('created_at', ascending: false);

      final list = memberships.whereType<Map>().toList();
      if (list.isEmpty) return const [];

      final channelIds = <String>[];
      final roleByChannel = <String, String>{};
      for (final row in list) {
        final cid = row['channel_id']?.toString();
        if (cid == null) continue;
        channelIds.add(cid);
        roleByChannel[cid] = row['role']?.toString() ?? roleSubscriber;
      }
      if (channelIds.isEmpty) return const [];

      final channelRows = await client
          .from(_channelsTable)
          .select(
            'id, owner_id, name, slug, description, avatar_url, '
            'is_verified, subscriber_count, created_at',
          )
          .inFilter('id', channelIds);

      // Preserve the membership order (most-recently-joined first).
      final byId = <String, Map>{
        for (final row in channelRows.whereType<Map>())
          if (row['id']?.toString() case final id?) id: row,
      };
      final lastPost = await _latestPostPerChannel(client, channelIds);

      final channels = <RemoteChannel>[];
      for (final cid in channelIds) {
        final row = byId[cid];
        if (row == null) continue;
        final latest = lastPost[cid];
        channels.add(
          RemoteChannel.fromJson(
            Map<String, Object?>.from(row),
            isSubscribed: true,
            viewerRole: roleByChannel[cid],
            lastPostContent: latest?.content,
            lastPostCreatedAtMillis: latest?.createdAtMillis,
          ),
        );
      }
      return channels;
    } catch (_) {
      return const [];
    }
  }

  /// A single channel by id, decorated with the viewer's subscription state and
  /// role. Returns null when unconfigured or the channel/table is missing.
  Future<RemoteChannel?> fetchChannel(String channelId) async {
    final client = _client;
    if (client == null) return null;

    try {
      final row = await client
          .from(_channelsTable)
          .select(
            'id, owner_id, name, slug, description, avatar_url, '
            'is_verified, subscriber_count, created_at',
          )
          .eq('id', channelId)
          .maybeSingle();
      if (row == null) return null;

      final decorated = await _decorateWithMembership(client, [row]);
      return decorated.isEmpty ? null : decorated.first;
    } catch (_) {
      return null;
    }
  }

  /// The broadcast feed of a channel, newest first (ready for a top-anchored
  /// reversed list). Embeds the author profile for the byline.
  Future<List<RemoteChannelPost>> fetchPosts(
    String channelId, {
    int limit = 60,
  }) async {
    final client = _client;
    if (client == null) return const [];

    try {
      final rows = await client
          .from(_postsTable)
          .select(
            'id, channel_id, author_id, content, media_url, media_type, '
            'view_count, created_at, '
            'profiles!${_postsTable}_author_id_fkey('
            'display_name, username, avatar_url)',
          )
          .eq('channel_id', channelId)
          .order('created_at', ascending: false)
          .limit(limit);

      return rows
          .whereType<Map>()
          .map(
            (row) =>
                RemoteChannelPost.fromJson(Map<String, Object?>.from(row)),
          )
          .toList();
    } catch (_) {
      // FK-embed / table may not exist yet: try a plain read without the embed
      // before giving up, so a bare table still renders (author falls back).
      try {
        final rows = await client
            .from(_postsTable)
            .select(
              'id, channel_id, author_id, content, media_url, media_type, '
              'view_count, created_at',
            )
            .eq('channel_id', channelId)
            .order('created_at', ascending: false)
            .limit(limit);
        return rows
            .whereType<Map>()
            .map(
              (row) =>
                  RemoteChannelPost.fromJson(Map<String, Object?>.from(row)),
            )
            .toList();
      } catch (_) {
        return const [];
      }
    }
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  /// Whether [role] is allowed to broadcast posts into a channel.
  static bool roleCanPost(String? role) =>
      role == roleOwner || role == roleAdmin;

  /// Creates a channel owned by the current user and enrolls them as `owner`.
  /// Returns the new channel id, or null when unconfigured / unauthenticated /
  /// the tables are missing.
  ///
  /// The owner subscriber row is inserted best-effort; if a DB trigger already
  /// enrolls the owner (recommended), the duplicate is ignored.
  Future<String?> createChannel({
    required String name,
    String? description,
    String? avatarUrl,
    String? slug,
  }) async {
    final client = _client;
    final me = currentUserId;
    final trimmedName = name.trim();
    if (client == null || me == null || trimmedName.isEmpty) return null;

    try {
      final payload = <String, Object?>{
        'owner_id': me,
        'name': trimmedName,
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
        if (avatarUrl != null && avatarUrl.trim().isNotEmpty)
          'avatar_url': avatarUrl.trim(),
        if (slug != null && slug.trim().isNotEmpty)
          'slug': _normalizeSlug(slug),
      };

      final inserted = await client
          .from(_channelsTable)
          .insert(payload)
          .select('id')
          .single();
      final channelId = inserted['id']?.toString();
      if (channelId == null) return null;

      // Enroll the creator as owner (idempotent against an owner trigger).
      try {
        await client.from(_subscribersTable).upsert({
          'channel_id': channelId,
          'user_id': me,
          'role': roleOwner,
        }, onConflict: 'channel_id,user_id', ignoreDuplicates: true);
      } catch (_) {
        // Owner enrollment is best-effort; the channel still exists.
      }

      return channelId;
    } catch (_) {
      return null;
    }
  }

  /// Subscribes the current user to [channelId] as a plain `subscriber`.
  /// Idempotent via the (channel_id, user_id) primary key.
  Future<bool> subscribe(String channelId) async {
    final client = _client;
    final me = currentUserId;
    if (client == null || me == null) return false;

    try {
      await client.from(_subscribersTable).upsert({
        'channel_id': channelId,
        'user_id': me,
        'role': roleSubscriber,
      }, onConflict: 'channel_id,user_id', ignoreDuplicates: true);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Unsubscribes the current user from [channelId]. The owner cannot leave
  /// their own channel (guarded here so the UI never orphans a channel).
  Future<bool> unsubscribe(String channelId) async {
    final client = _client;
    final me = currentUserId;
    if (client == null || me == null) return false;

    try {
      await client
          .from(_subscribersTable)
          .delete()
          .eq('channel_id', channelId)
          .eq('user_id', me)
          .neq('role', roleOwner);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Publishes a broadcast post into [channelId] as the current user. Only the
  /// owner/admin should reach this (the UI hides the composer otherwise); the
  /// RLS insert policy is the real enforcement. Returns the new post id.
  Future<String?> publishPost({
    required String channelId,
    required String content,
    String? mediaUrl,
    String? mediaType,
  }) async {
    final client = _client;
    final me = currentUserId;
    final trimmed = content.trim();
    if (client == null || me == null || trimmed.isEmpty) return null;

    try {
      final inserted = await client
          .from(_postsTable)
          .insert({
            'channel_id': channelId,
            'author_id': me,
            'content': trimmed,
            if (mediaUrl != null && mediaUrl.isNotEmpty) 'media_url': mediaUrl,
            if (mediaType != null && mediaType.isNotEmpty)
              'media_type': mediaType,
          })
          .select('id')
          .single();
      return inserted['id']?.toString();
    } catch (_) {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /// Marks each raw channel row with the viewer's subscription state + role and
  /// a last-post preview, in as few round-trips as possible.
  Future<List<RemoteChannel>> _decorateWithMembership(
    SupabaseClient client,
    List<Map<dynamic, dynamic>> rows,
  ) async {
    if (rows.isEmpty) return const [];

    final ids = <String>[
      for (final row in rows)
        if (row['id']?.toString() case final id?) id,
    ];

    final me = currentUserId;
    final roleByChannel = await _viewerRoleFor(client, me, ids);
    final lastPost = await _latestPostPerChannel(client, ids);

    return [
      for (final row in rows)
        if (row['id']?.toString() case final id?)
          RemoteChannel.fromJson(
            Map<String, Object?>.from(row),
            isSubscribed: roleByChannel.containsKey(id),
            viewerRole: roleByChannel[id],
            lastPostContent: lastPost[id]?.content,
            lastPostCreatedAtMillis: lastPost[id]?.createdAtMillis,
          ),
    ];
  }

  /// The viewer's role per channel id (absent key == not subscribed).
  Future<Map<String, String>> _viewerRoleFor(
    SupabaseClient client,
    String? viewerId,
    List<String> channelIds,
  ) async {
    if (viewerId == null || channelIds.isEmpty) return const {};
    try {
      final rows = await client
          .from(_subscribersTable)
          .select('channel_id, role')
          .eq('user_id', viewerId)
          .inFilter('channel_id', channelIds);
      return {
        for (final row in rows.whereType<Map>())
          if (row['channel_id']?.toString() case final id?)
            id: row['role']?.toString() ?? roleSubscriber,
      };
    } catch (_) {
      return const {};
    }
  }

  /// Newest post per channel id in a single ordered read.
  Future<Map<String, RemoteChannelPost>> _latestPostPerChannel(
    SupabaseClient client,
    List<String> channelIds,
  ) async {
    if (channelIds.isEmpty) return const {};
    try {
      final rows = await client
          .from(_postsTable)
          .select(
            'id, channel_id, author_id, content, media_url, media_type, '
            'view_count, created_at',
          )
          .inFilter('channel_id', channelIds)
          .order('created_at', ascending: false);

      final latest = <String, RemoteChannelPost>{};
      for (final row in rows.whereType<Map>()) {
        final post = RemoteChannelPost.fromJson(
          Map<String, Object?>.from(row),
        );
        latest.putIfAbsent(post.channelId, () => post);
      }
      return latest;
    } catch (_) {
      return const {};
    }
  }

  /// Best-effort candidate handle from a display name (lowercase, a-z0-9_).
  static String _normalizeSlug(String raw) {
    final cleaned = raw
        .trim()
        .toLowerCase()
        .replaceFirst(RegExp('^@'), '')
        .replaceAll(RegExp('[^a-z0-9_]+'), '_')
        .replaceAll(RegExp('_+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '');
    return cleaned.isEmpty ? 'channel' : cleaned;
  }

  /// Exposed for the create sheet's live handle preview.
  static String suggestSlug(String raw) => _normalizeSlug(raw);

  /// Unused view reference kept intentionally so the profiles view name is
  /// documented in one place for any future "invite admins" flow.
  static String get profilesView => _profilesView;
}
