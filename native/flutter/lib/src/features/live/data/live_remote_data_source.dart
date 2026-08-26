import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'live_models.dart';

/// Honest failure reason for audio-space actions that cannot be completed.
///
/// The browse/read paths still degrade to empty data because they are passive
/// surfaces, but room participation actions should not silently disappear: the
/// room catches this and explains whether Supabase, auth, or backend RLS/schema
/// support is missing.
class LiveSpaceUnavailableException implements Exception {
  const LiveSpaceUnavailableException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Honest failure reason for live-stream browse/watch actions.
class LiveDataException implements Exception {
  const LiveDataException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() => message;
}

/// Live access to the video-stream + audio-space consumption surface.
///
/// Modeled on [SocialGraphRemoteDataSource] / [ProfileSectionsRemoteDataSource]:
/// auto-detects the Supabase singleton, exposes an `isConfigured` flag, and
/// read methods degrade gracefully where that makes sense; stream browse/watch
/// actions throw [LiveDataException] when failure should be visible to the user
/// instead of becoming a silent no-op.
///
/// Talks directly to the native tables (there are no `join_live_stream` /
/// `send_live_gift` RPCs in the applied migrations, unlike the web build which
/// calls `send_live_gift` / `send_space_gift`). Every column referenced here is
/// present on the live schema:
///   * `live_streams`  : id, user_id, title, description, status, viewer_count,
///                       thumbnail_url, playback_url, started_at,
///                       stream_features, group_conversation_id
///   * `live_spaces`   : id, user_id, title, description, status, viewer_count,
///                       topic_category, started_at
///   * `live_stream_viewers`   : (stream_id, user_id) pk, joined_at, left_at
///   * `live_stream_comments`  : id, stream_id, user_id, content, created_at
///   * `live_stream_reactions` : id, stream_id, user_id, reaction_type, created_at
///   * `live_stream_gifts`     : id, stream_id, sender_id, receiver_id,
///                               gift_type, credit_value, created_at
///   * `live_space_speakers`   : id, space_id, user_id, role, status, muted,
///                               joined_at, left_at
///   * `live_space_messages`   : id, space_id, user_id, content, created_at
///   * `live_space_reactions`  : id, space_id, user_id, reaction_type, created_at
///   * `live_space_gifts`      : id, space_id, sender_id, receiver_id,
///                               gift_type, credit_value, created_at
class LiveRemoteDataSource {
  const LiveRemoteDataSource({required this.isConfigured});

  /// Convenience factory used by hosts that cannot see the app config: detects
  /// configuration from whether the Supabase singleton was initialised.
  factory LiveRemoteDataSource.autoDetect() {
    return LiveRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  // --- Table names -----------------------------------------------------------
  static const _streamsTable = 'live_streams';
  static const _spacesTable = 'live_spaces';
  static const _streamViewersTable = 'live_stream_viewers';
  static const _streamCommentsTable = 'live_stream_comments';
  static const _streamReactionsTable = 'live_stream_reactions';
  static const _spaceSpeakersTable = 'live_space_speakers';
  static const _spaceMessagesTable = 'live_space_messages';
  static const _spaceReactionsTable = 'live_space_reactions';

  /// Embedded profile projections. Use concrete FK names from the native
  /// migrations so PostgREST does not fail on ambiguous `profiles` relations.
  static const _streamHostEmbed =
      'host:profiles!live_streams_user_id_fkey('
      'id, display_name, username, avatar_url)';
  static const _spaceHostEmbed =
      'host:profiles!live_spaces_user_id_fkey('
      'id, display_name, username, avatar_url)';
  static const _streamCommentAuthorEmbed =
      'author:profiles!live_stream_comments_user_id_fkey('
      'id, display_name, username, avatar_url)';
  static const _spaceMessageAuthorEmbed =
      'author:profiles!live_space_messages_user_id_fkey('
      'id, display_name, username, avatar_url)';

  Never _throwUnavailable() {
    throw const LiveDataException(
      'Live is unavailable because Supabase is not configured.',
    );
  }

  Never _throwSignIn(String action) {
    throw LiveDataException('Sign in to $action.');
  }

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

  // --- Profiles --------------------------------------------------------------

  /// Batch-resolve profiles by id, keyed by id. Used to hydrate the author of
  /// realtime chat / reaction / gift rows, whose INSERT payloads carry only the
  /// raw `user_id` (no embedded profile) — mirrors the web's `profileMap` fetch
  /// in `SpaceChat` / `FlyingChat`. Returns an empty map on any failure so the
  /// caller simply keeps the "feedIn user" fallback.
  Future<Map<String, LiveProfile>> fetchProfiles(Iterable<String> ids) async {
    final client = _client;
    final unique = {
      for (final id in ids)
        if (id.isNotEmpty) id,
    }.toList();
    if (client == null || unique.isEmpty) return const {};
    try {
      final rows = await client
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .inFilter('id', unique);
      final result = <String, LiveProfile>{};
      for (final row in rows.whereType<Map>()) {
        final profile = LiveProfile.tryFromEmbed(
          Map<String, Object?>.from(row),
        );
        if (profile != null) result[profile.id] = profile;
      }
      return result;
    } catch (_) {
      return const {};
    }
  }

  // --- Browse ----------------------------------------------------------------

  /// Active (live) video streams, most-watched first. Throws a
  /// [LiveDataException] on schema/RLS/network failures so browse can show a
  /// real error instead of silently pretending no streams exist.
  Future<List<LiveStreamSummary>> fetchLiveStreams({int limit = 30}) async {
    final client = _client;
    if (client == null) _throwUnavailable();
    try {
      final rows = await client
          .from(_streamsTable)
          .select(
            'id, user_id, title, description, status, viewer_count, '
            'thumbnail_url, playback_url, started_at, stream_features, '
            'group_conversation_id, $_streamHostEmbed',
          )
          .eq('status', 'live')
          .order('viewer_count', ascending: false)
          .limit(limit);
      return [
        for (final row in rows.whereType<Map>())
          LiveStreamSummary.fromJson(Map<String, Object?>.from(row)),
      ];
    } catch (error) {
      throw LiveDataException(
        'Could not load live streams. Check the live_streams schema/RLS and network.',
        cause: error,
      );
    }
  }

  /// Active (live) audio spaces, most-listened first.
  Future<List<LiveSpaceSummary>> fetchLiveSpaces({int limit = 30}) async {
    final client = _client;
    if (client == null) return const [];
    try {
      final rows = await client
          .from(_spacesTable)
          .select(
            'id, user_id, title, description, status, viewer_count, '
            'topic_category, started_at, $_spaceHostEmbed',
          )
          .eq('status', 'live')
          .order('viewer_count', ascending: false)
          .limit(limit);
      return [
        for (final row in rows.whereType<Map>())
          LiveSpaceSummary.fromJson(Map<String, Object?>.from(row)),
      ];
    } catch (_) {
      return const [];
    }
  }

  Future<LiveSpaceSummary> startLiveSpace({
    required String title,
    String? description,
    String? topicCategory,
  }) async {
    final client = _client;
    if (client == null) _throwUnavailable();
    final userId = currentUserId;
    if (userId == null) _throwSignIn('start an audio space');
    final normalizedTitle = title.trim();
    if (normalizedTitle.isEmpty) {
      throw const LiveDataException('An audio-space title is required.');
    }
    try {
      final row = await client
          .from(_spacesTable)
          .insert({
            'user_id': userId,
            'title': normalizedTitle,
            'description': description?.trim().isEmpty ?? true
                ? null
                : description!.trim(),
            'topic_category': topicCategory?.trim().isEmpty ?? true
                ? null
                : topicCategory!.trim(),
            'status': 'live',
            'started_at': DateTime.now().toUtc().toIso8601String(),
          })
          .select(
            'id, user_id, title, description, status, viewer_count, '
            'topic_category, started_at, $_spaceHostEmbed',
          )
          .single();
      final space = LiveSpaceSummary.fromJson(Map<String, Object?>.from(row));
      await joinSpace(space.id, role: 'host');
      return space;
    } catch (error) {
      if (error is LiveDataException) rethrow;
      throw LiveDataException('Could not start the audio space.', cause: error);
    }
  }

  /// Re-read a single stream (for the viewer header viewer-count refresh).
  Future<LiveStreamSummary?> fetchStream(String streamId) async {
    final client = _client;
    if (client == null || streamId.isEmpty) return null;
    try {
      final row = await client
          .from(_streamsTable)
          .select(
            'id, user_id, title, description, status, viewer_count, '
            'thumbnail_url, playback_url, started_at, stream_features, '
            'group_conversation_id, $_streamHostEmbed',
          )
          .eq('id', streamId)
          .maybeSingle();
      if (row == null) return null;
      return LiveStreamSummary.fromJson(Map<String, Object?>.from(row));
    } catch (_) {
      return null;
    }
  }

  /// Starts a LiveKit stream scoped to a group conversation. The RPC verifies
  /// membership and rejects direct (non-group) conversations server-side.
  Future<LiveStreamSummary> startGroupLiveStream({
    required String conversationId,
    required String title,
    String? description,
  }) async {
    final client = _client;
    if (client == null) _throwUnavailable();
    if (currentUserId == null) _throwSignIn('start a group livestream');
    if (conversationId.trim().isEmpty) {
      throw const LiveDataException('A group conversation is required.');
    }

    try {
      final raw = await client.rpc(
        'start_group_live_stream',
        params: {
          'p_group_conversation_id': conversationId,
          'p_title': title,
          'p_description': description,
        },
      );
      final row = raw is List ? (raw.isEmpty ? null : raw.first) : raw;
      if (row is! Map) {
        throw const LiveDataException('The livestream was not created.');
      }
      return LiveStreamSummary.fromJson(Map<String, Object?>.from(row));
    } catch (error) {
      if (error is LiveDataException) rethrow;
      throw LiveDataException(
        'Could not start the group livestream.',
        cause: error,
      );
    }
  }

  /// Starts a public livestream, matching the web app's normal Go Live flow.
  /// Group scoping remains optional through [startGroupLiveStream].
  Future<LiveStreamSummary> startLiveStream({
    required String title,
    String? description,
  }) async {
    final client = _client;
    if (client == null) _throwUnavailable();
    final userId = currentUserId;
    if (userId == null) _throwSignIn('start a livestream');

    final normalizedTitle = title.trim();
    if (normalizedTitle.isEmpty) {
      throw const LiveDataException('A livestream title is required.');
    }

    try {
      final row = await client
          .from(_streamsTable)
          .insert({
            'user_id': userId,
            'title': normalizedTitle,
            'description': description?.trim().isEmpty ?? true
                ? null
                : description!.trim(),
            'status': 'live',
            'started_at': DateTime.now().toUtc().toIso8601String(),
          })
          .select(
            'id, user_id, title, description, status, viewer_count, '
            'thumbnail_url, playback_url, started_at, stream_features, '
            'group_conversation_id, $_streamHostEmbed',
          )
          .single();
      return LiveStreamSummary.fromJson(Map<String, Object?>.from(row));
    } catch (error) {
      if (error is LiveDataException) rethrow;
      throw LiveDataException('Could not start the livestream.', cause: error);
    }
  }

  /// Marks a host-owned stream as ended before the host leaves LiveKit.
  Future<void> endStream(String streamId) async {
    final client = _client;
    if (client == null) _throwUnavailable();
    if (currentUserId == null) _throwSignIn('end this livestream');
    try {
      await client
          .from(_streamsTable)
          .update({
            'status': 'ended',
            'ended_at': DateTime.now().toUtc().toIso8601String(),
          })
          .eq('id', streamId);
    } catch (error) {
      throw LiveDataException('Could not end the livestream.', cause: error);
    }
  }

  /// Re-read a single space (for the room header viewer-count refresh).
  Future<LiveSpaceSummary?> fetchSpace(String spaceId) async {
    final client = _client;
    if (client == null || spaceId.isEmpty) return null;
    try {
      final row = await client
          .from(_spacesTable)
          .select(
            'id, user_id, title, description, status, viewer_count, '
            'topic_category, started_at, $_spaceHostEmbed',
          )
          .eq('id', spaceId)
          .maybeSingle();
      if (row == null) return null;
      return LiveSpaceSummary.fromJson(Map<String, Object?>.from(row));
    } catch (_) {
      return null;
    }
  }

  // --- Join / leave a stream -------------------------------------------------

  /// Mark the current user as an active viewer of [streamId]. Idempotent: the
  /// (stream_id, user_id) primary key makes a repeat join a no-op via upsert.
  ///
  /// Note: `viewer_count` on `live_streams` is host-owned (RLS only lets the
  /// host update the row), so the native viewer cannot increment it directly.
  /// The live count is instead derived from `live_stream_viewers` via
  /// [countStreamViewers]. See the report's backend-gaps section.
  Future<void> joinStream(String streamId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null || streamId.isEmpty) return;
    try {
      await client.from(_streamViewersTable).upsert({
        'stream_id': streamId,
        'user_id': userId,
        'joined_at': DateTime.now().toUtc().toIso8601String(),
        'left_at': null,
      }, onConflict: 'stream_id,user_id');
    } catch (_) {
      // Best-effort presence; never block entering the viewer.
    }
  }

  /// Mark the current user as no longer viewing [streamId].
  Future<void> leaveStream(String streamId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null || streamId.isEmpty) return;
    try {
      await client
          .from(_streamViewersTable)
          .update({'left_at': DateTime.now().toUtc().toIso8601String()})
          .eq('stream_id', streamId)
          .eq('user_id', userId);
    } catch (_) {
      // no-op
    }
  }

  /// Live viewer count derived from active viewer rows (left_at is null).
  Future<int> countStreamViewers(String streamId) async {
    final client = _client;
    if (client == null || streamId.isEmpty) return 0;
    try {
      final rows = await client
          .from(_streamViewersTable)
          .select('user_id')
          .eq('stream_id', streamId)
          .isFilter('left_at', null);
      return rows.whereType<Map>().length;
    } catch (_) {
      return 0;
    }
  }

  // --- Stream chat -----------------------------------------------------------

  Future<List<LiveComment>> fetchStreamComments(
    String streamId, {
    int limit = 100,
  }) async {
    final client = _client;
    if (client == null || streamId.isEmpty) return const [];
    try {
      final rows = await client
          .from(_streamCommentsTable)
          .select(
            'id, user_id, content, created_at, $_streamCommentAuthorEmbed',
          )
          .eq('stream_id', streamId)
          .order('created_at')
          .limit(limit);
      return [
        for (final row in rows.whereType<Map>())
          LiveComment.fromJson(Map<String, Object?>.from(row)),
      ];
    } catch (_) {
      return const [];
    }
  }

  /// Post a chat line to [streamId] as the current user. RLS requires
  /// `user_id == auth.uid()`.
  Future<void> sendStreamComment(String streamId, String content) async {
    final client = _client;
    final userId = currentUserId;
    final body = content.trim();
    if (client == null) _throwUnavailable();
    if (userId == null) _throwSignIn('chat');
    if (streamId.isEmpty || body.isEmpty) {
      throw const LiveDataException('Cannot send an empty live chat message.');
    }
    await client.from(_streamCommentsTable).insert({
      'stream_id': streamId,
      'user_id': userId,
      'content': body,
    });
  }

  // --- Stream reactions ------------------------------------------------------

  Future<void> sendStreamReaction(String streamId, String reactionType) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null) _throwUnavailable();
    if (userId == null) _throwSignIn('react');
    if (streamId.isEmpty) {
      throw const LiveDataException(
        'Cannot react because the stream is missing.',
      );
    }
    await client.from(_streamReactionsTable).insert({
      'stream_id': streamId,
      'user_id': userId,
      'reaction_type': reactionType,
    });
  }

  // --- Stream gifts ----------------------------------------------------------

  /// Send a gift in a stream via the server-authoritative `send_live_stream_gift`
  /// RPC: the cost is derived from the `live_gift_types` catalog (never the
  /// client), the sender is debited and the host credited atomically, and the
  /// insert happens inside the SECURITY DEFINER function. [receiverId] must be
  /// the stream host; a fresh idempotency key guards against double-charge.
  Future<void> sendStreamGift({
    required String streamId,
    required String giftType,
    required String receiverId,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null) _throwUnavailable();
    if (userId == null) _throwSignIn('send gifts');
    if (streamId.isEmpty) {
      throw const LiveDataException(
        'Cannot send a gift because the stream is missing.',
      );
    }
    try {
      await client.rpc(
        'send_live_stream_gift',
        params: {
          'p_gift_type': giftType,
          'p_stream_id': streamId,
          'p_receiver_id': receiverId.isEmpty ? null : receiverId,
          'p_idempotency_key': const Uuid().v4(),
        },
      );
    } catch (error) {
      throw LiveDataException(_giftFailureMessage(error));
    }
  }

  /// Maps a gift settlement RPC error to a friendly, user-facing message.
  String _giftFailureMessage(Object error) {
    final raw = error is PostgrestException ? error.message : error.toString();
    if (raw.contains('INSUFFICIENT_CREDITS')) {
      return 'You don\'t have enough credits to send this gift.';
    }
    if (raw.contains('SELF_GIFT_NOT_ALLOWED')) {
      return 'You can\'t send a gift to your own room.';
    }
    if (raw.contains('GIFT_NOT_AVAILABLE')) {
      return 'That gift isn\'t available right now.';
    }
    if (raw.contains('NOT_AUTHENTICATED')) {
      return 'Sign in to send gifts.';
    }
    return 'Could not send the gift. Please try again.';
  }

  // --- Host PULSE cards (stream_features.host_cards) --------------------------

  /// Read the host-published PULSE cards for [streamId] from
  /// `live_streams.stream_features.host_cards`.
  ///
  /// The `stream_features` JSON column is NOT present on the deployed baseline
  /// schema (see the module report's backend-gaps section). This method probes
  /// it defensively: if the column is missing the select throws, which is caught
  /// and surfaced as an empty list, so the PULSE panel simply shows no cards
  /// rather than crashing. Once the column is added, cards round-trip for free.
  Future<List<HostCard>> fetchHostCards(String streamId) async {
    final client = _client;
    if (client == null || streamId.isEmpty) return const [];
    try {
      final row = await client
          .from(_streamsTable)
          .select('stream_features')
          .eq('id', streamId)
          .maybeSingle();
      if (row == null) return const [];
      return hostCardsFromFeatures(
        Map<String, Object?>.from(row)['stream_features'],
      );
    } catch (_) {
      // Column absent / RLS / offline — degrade to no cards.
      return const [];
    }
  }

  /// Persist the full ordered [cards] list under
  /// `live_streams.stream_features.host_cards`, preserving any sibling keys
  /// already present in `stream_features`. Only the stream host may write (RLS
  /// on `live_streams` restricts UPDATE to `user_id == auth.uid()`).
  ///
  /// Returns `true` if the write was accepted, `false` if it failed (e.g. the
  /// `stream_features` column does not exist, or the caller is not the host).
  /// The caller keeps its optimistic in-memory list either way, but a `false`
  /// return means the change did not persist across sessions — the panel uses
  /// this to warn the host.
  Future<bool> updateHostCards(String streamId, List<HostCard> cards) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null || streamId.isEmpty) return false;
    try {
      // Merge into any existing stream_features so we don't clobber sibling keys.
      Map<String, Object?> features = {};
      try {
        final existing = await client
            .from(_streamsTable)
            .select('stream_features')
            .eq('id', streamId)
            .maybeSingle();
        final raw = existing == null
            ? null
            : Map<String, Object?>.from(existing)['stream_features'];
        if (raw is Map) features = Map<String, Object?>.from(raw);
      } catch (_) {
        // Column may be absent; fall through and attempt the write anyway so the
        // failure (and the backend gap) surfaces via the update's catch below.
      }
      features['host_cards'] = [for (final card in cards) card.toJson()];
      await client
          .from(_streamsTable)
          .update({'stream_features': features})
          .eq('id', streamId);
      return true;
    } catch (_) {
      // Column absent / not the host / offline — the panel keeps the optimistic
      // list but signals that publishing did not persist.
      return false;
    }
  }

  // --- Space join / speakers -------------------------------------------------

  /// Register the current user as an active speaker/listener in [spaceId].
  /// The native `live_space_speakers` unique(space_id, user_id) makes this an
  /// upsert. Non-hosts join as `role: 'listener'` (a listener is still a row so
  /// the room can render presence); [role] lets a host self-register as 'host'.
  Future<bool> joinSpace(String spaceId, {String role = 'listener'}) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null || spaceId.isEmpty) return false;
    try {
      await client.from(_spaceSpeakersTable).upsert({
        'space_id': spaceId,
        'user_id': userId,
        'role': role,
        'status': 'active',
        'muted': role != 'host',
        'joined_at': DateTime.now().toUtc().toIso8601String(),
        'left_at': null,
      }, onConflict: 'space_id,user_id');
      return true;
    } catch (_) {
      // Best-effort presence. Current native RLS allows INSERT but may reject
      // UPDATE, so a repeat join/upsert can fail until backend policies include
      // self update for live_space_speakers.
      return false;
    }
  }

  Future<void> leaveSpace(String spaceId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null || spaceId.isEmpty) return;
    try {
      await client
          .from(_spaceSpeakersTable)
          .update({
            'status': 'left',
            'left_at': DateTime.now().toUtc().toIso8601String(),
          })
          .eq('space_id', spaceId)
          .eq('user_id', userId);
    } catch (_) {
      // no-op
    }
  }

  /// Active speakers/participants in [spaceId] (left_at is null), hosts first.
  Future<List<SpaceSpeaker>> fetchSpaceSpeakers(String spaceId) async {
    final client = _client;
    if (client == null || spaceId.isEmpty) return const [];
    try {
      final rows = await client
          .from(_spaceSpeakersTable)
          .select(
            'user_id, role, status, muted, '
            'profiles!user_id(id, display_name, username, avatar_url)',
          )
          .eq('space_id', spaceId)
          .isFilter('left_at', null);
      final speakers = [
        for (final row in rows.whereType<Map>())
          SpaceSpeaker.fromJson(Map<String, Object?>.from(row)),
      ];
      speakers.sort((a, b) {
        if (a.isHost == b.isHost) return 0;
        return a.isHost ? -1 : 1;
      });
      return speakers;
    } catch (_) {
      return const [];
    }
  }

  /// Live listener count for a space, derived from active speaker/listener rows.
  Future<int> countSpaceListeners(String spaceId) async {
    final client = _client;
    if (client == null || spaceId.isEmpty) return 0;
    try {
      final rows = await client
          .from(_spaceSpeakersTable)
          .select('user_id')
          .eq('space_id', spaceId)
          .isFilter('left_at', null);
      return rows.whereType<Map>().length;
    } catch (_) {
      return 0;
    }
  }

  // --- Space chat ------------------------------------------------------------

  Future<List<SpaceMessage>> fetchSpaceMessages(
    String spaceId, {
    int limit = 100,
  }) async {
    final client = _client;
    if (client == null || spaceId.isEmpty) return const [];
    try {
      final rows = await client
          .from(_spaceMessagesTable)
          .select('id, user_id, content, created_at, $_spaceMessageAuthorEmbed')
          .eq('space_id', spaceId)
          .order('created_at')
          .limit(limit);
      return [
        for (final row in rows.whereType<Map>())
          SpaceMessage.fromJson(Map<String, Object?>.from(row)),
      ];
    } catch (_) {
      return const [];
    }
  }

  Future<void> sendSpaceMessage(String spaceId, String content) async {
    final client = _client;
    final userId = currentUserId;
    final body = content.trim();
    if (body.isEmpty) return;
    if (client == null) {
      throw const LiveSpaceUnavailableException(
        'Audio-space chat is unavailable because Supabase is not configured.',
      );
    }
    if (userId == null) {
      throw const LiveSpaceUnavailableException(
        'Sign in to chat in this audio space.',
      );
    }
    if (spaceId.isEmpty) {
      throw const LiveSpaceUnavailableException(
        'Audio-space chat is unavailable for this room.',
      );
    }
    try {
      await client.from(_spaceMessagesTable).insert({
        'space_id': spaceId,
        'user_id': userId,
        'content': body,
      });
    } catch (_) {
      throw const LiveSpaceUnavailableException(
        'Audio-space chat is unavailable. The backend may be missing message table access.',
      );
    }
  }

  // --- Space reactions -------------------------------------------------------

  Future<void> sendSpaceReaction(String spaceId, String reactionType) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null) {
      throw const LiveSpaceUnavailableException(
        'Audio-space reactions are unavailable because Supabase is not configured.',
      );
    }
    if (userId == null) {
      throw const LiveSpaceUnavailableException(
        'Sign in to react in this audio space.',
      );
    }
    if (spaceId.isEmpty) {
      throw const LiveSpaceUnavailableException(
        'Audio-space reactions are unavailable for this room.',
      );
    }
    try {
      await client.from(_spaceReactionsTable).insert({
        'space_id': spaceId,
        'user_id': userId,
        'reaction_type': reactionType,
      });
    } catch (_) {
      throw const LiveSpaceUnavailableException(
        'Audio-space reactions are unavailable. The backend may be missing reaction table access.',
      );
    }
  }

  // --- Space gifts -----------------------------------------------------------

  Future<void> sendSpaceGift({
    required String spaceId,
    required String giftType,
    required String receiverId,
  }) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null) {
      throw const LiveSpaceUnavailableException(
        'Audio-space gifts are unavailable because Supabase is not configured.',
      );
    }
    if (userId == null) {
      throw const LiveSpaceUnavailableException(
        'Sign in to send gifts in this audio space.',
      );
    }
    if (spaceId.isEmpty) {
      throw const LiveSpaceUnavailableException(
        'Audio-space gifts are unavailable for this room.',
      );
    }
    try {
      await client.rpc(
        'send_live_space_gift',
        params: {
          'p_gift_type': giftType,
          'p_space_id': spaceId,
          'p_receiver_id': receiverId.isEmpty ? null : receiverId,
          'p_idempotency_key': const Uuid().v4(),
        },
      );
    } catch (error) {
      throw LiveSpaceUnavailableException(_giftFailureMessage(error));
    }
  }
}
