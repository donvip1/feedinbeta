import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'live_models.dart';

/// Scoped realtime subscriptions for a single live stream, mirroring the web's
/// per-room `supabase.channel('...').on('postgres_changes', ...)` pattern in
/// `LiveKitViewer.tsx` / `SpaceChat.tsx`.
///
/// Subscribes to INSERTs on the stream's comment / reaction / gift tables,
/// filtered server-side by `stream_id`, and re-emits them as typed events. All
/// methods degrade to a no-op stream when Supabase is unavailable, so callers
/// always get a valid (possibly empty) stream and never crash offline.
class LiveStreamRealtime {
  LiveStreamRealtime({required this.streamId});

  final String streamId;

  RealtimeChannel? _channel;

  final _comments = StreamController<LiveComment>.broadcast();
  final _reactions = StreamController<LiveReactionEvent>.broadcast();
  final _gifts = StreamController<LiveGiftEvent>.broadcast();
  final _viewerChanges = StreamController<void>.broadcast();

  /// Newly-inserted chat lines. Note: the payload carries no embedded profile,
  /// so [LiveComment.author] is null on realtime events — the viewer hydrates
  /// the author name via a batched profile fetch.
  Stream<LiveComment> get comments => _comments.stream;
  Stream<LiveReactionEvent> get reactions => _reactions.stream;
  Stream<LiveGiftEvent> get gifts => _gifts.stream;

  /// Fires (payload-less) whenever a viewer row changes so the viewer can
  /// re-derive the live viewer count without waiting for the poll interval.
  Stream<void> get viewerChanges => _viewerChanges.stream;

  void connect() {
    if (_channel != null || streamId.isEmpty) return;
    final SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (_) {
      return;
    }

    final filter = PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'stream_id',
      value: streamId,
    );

    _channel =
        client
            .channel('live-stream-$streamId')
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'live_stream_comments',
              filter: filter,
              callback: (payload) {
                _comments.add(
                  LiveComment.fromJson(
                    Map<String, Object?>.from(payload.newRecord),
                  ),
                );
              },
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'live_stream_reactions',
              filter: filter,
              callback: (payload) {
                _reactions.add(
                  LiveReactionEvent.fromJson(
                    Map<String, Object?>.from(payload.newRecord),
                  ),
                );
              },
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'live_stream_gifts',
              filter: filter,
              callback: (payload) {
                _gifts.add(
                  LiveGiftEvent.fromJson(
                    Map<String, Object?>.from(payload.newRecord),
                  ),
                );
              },
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'live_stream_viewers',
              filter: filter,
              callback: (_) => _viewerChanges.add(null),
            )
          ..subscribe();
  }

  Future<void> dispose() async {
    final channel = _channel;
    _channel = null;
    if (channel != null) {
      try {
        await Supabase.instance.client.removeChannel(channel);
      } catch (_) {
        // ignore teardown errors
      }
    }
    await _comments.close();
    await _reactions.close();
    await _gifts.close();
    await _viewerChanges.close();
  }
}

/// Scoped realtime subscriptions for a single audio space (messages, reactions,
/// gifts, and speaker presence changes), filtered server-side by `space_id`.
class LiveSpaceRealtime {
  LiveSpaceRealtime({required this.spaceId});

  final String spaceId;

  RealtimeChannel? _channel;

  final _messages = StreamController<SpaceMessage>.broadcast();
  final _reactions = StreamController<LiveReactionEvent>.broadcast();
  final _gifts = StreamController<LiveGiftEvent>.broadcast();
  final _speakerChanges = StreamController<void>.broadcast();

  Stream<SpaceMessage> get messages => _messages.stream;
  Stream<LiveReactionEvent> get reactions => _reactions.stream;
  Stream<LiveGiftEvent> get gifts => _gifts.stream;

  /// Fires (payload-less) whenever a speaker row changes so the room can re-read
  /// the presence list.
  Stream<void> get speakerChanges => _speakerChanges.stream;

  bool connect() {
    if (_channel != null) return true;
    if (spaceId.isEmpty) return false;
    final SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (_) {
      return false;
    }

    final filter = PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'space_id',
      value: spaceId,
    );

    _channel =
        client
            .channel('live-space-$spaceId')
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'live_space_messages',
              filter: filter,
              callback: (payload) {
                _messages.add(
                  SpaceMessage.fromJson(
                    Map<String, Object?>.from(payload.newRecord),
                  ),
                );
              },
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'live_space_reactions',
              filter: filter,
              callback: (payload) {
                _reactions.add(
                  LiveReactionEvent.fromJson(
                    Map<String, Object?>.from(payload.newRecord),
                  ),
                );
              },
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'live_space_gifts',
              filter: filter,
              callback: (payload) {
                _gifts.add(
                  LiveGiftEvent.fromJson(
                    Map<String, Object?>.from(payload.newRecord),
                  ),
                );
              },
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'live_space_speakers',
              filter: filter,
              callback: (_) => _speakerChanges.add(null),
            )
          ..subscribe();
    return true;
  }

  Future<void> dispose() async {
    final channel = _channel;
    _channel = null;
    if (channel != null) {
      try {
        await Supabase.instance.client.removeChannel(channel);
      } catch (_) {
        // ignore teardown errors
      }
    }
    await _messages.close();
    await _reactions.close();
    await _gifts.close();
    await _speakerChanges.close();
  }
}
