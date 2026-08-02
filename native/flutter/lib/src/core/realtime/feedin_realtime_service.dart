import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

class FeedinRealtimeService {
  FeedinRealtimeService({required this.isConfigured});

  final bool isConfigured;
  RealtimeChannel? _channel;
  final _eventsController = StreamController<FeedinRealtimeEvent>.broadcast();

  Stream<FeedinRealtimeEvent> get events => _eventsController.stream;
  bool get isConnected => _channel != null;

  Future<void> connect() async {
    if (!isConfigured || _channel != null) return;

    final client = Supabase.instance.client;
    _channel = client
        .channel('feedin-mobile-realtime')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'posts',
          callback: (payload) {
            _eventsController.add(
              FeedinRealtimeEvent(
                kind: _kindFromPostgres(payload.eventType),
                type: FeedinRealtimeEventType.postChanged,
                recordId: _recordId(payload),
                messageRecord: payload.newRecord,
              ),
            );
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          callback: (payload) {
            _eventsController.add(
              FeedinRealtimeEvent(
                kind: _kindFromPostgres(payload.eventType),
                type: FeedinRealtimeEventType.messageChanged,
                recordId: _recordId(payload),
                messageRecord: payload.newRecord,
              ),
            );
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'post_likes',
          callback: (payload) {
            _eventsController.add(
              FeedinRealtimeEvent(
                kind: _kindFromPostgres(payload.eventType),
                type: FeedinRealtimeEventType.postChanged,
                recordId: _postId(payload),
                messageRecord: payload.newRecord,
              ),
            );
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'post_comments',
          callback: (payload) {
            _eventsController.add(
              FeedinRealtimeEvent(
                kind: _kindFromPostgres(payload.eventType),
                type: FeedinRealtimeEventType.postChanged,
                recordId: _postId(payload),
                messageRecord: payload.newRecord,
              ),
            );
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'notifications',
          callback: (payload) {
            _eventsController.add(
              FeedinRealtimeEvent(
                kind: _kindFromPostgres(payload.eventType),
                type: FeedinRealtimeEventType.notificationChanged,
                recordId: _recordId(payload),
                messageRecord: payload.newRecord,
              ),
            );
          },
        );

    _channel!.subscribe();
  }

  static FeedinRealtimeEventKind _kindFromPostgres(PostgresChangeEvent event) {
    switch (event) {
      case PostgresChangeEvent.insert:
        return FeedinRealtimeEventKind.insert;
      case PostgresChangeEvent.update:
        return FeedinRealtimeEventKind.update;
      case PostgresChangeEvent.delete:
        return FeedinRealtimeEventKind.delete;
      case PostgresChangeEvent.all:
        return FeedinRealtimeEventKind.unknown;
    }
  }

  String? _recordId(PostgresChangePayload payload) {
    final record = payload.newRecord.isNotEmpty
        ? payload.newRecord
        : payload.oldRecord;
    return record['id']?.toString();
  }

  String? _postId(PostgresChangePayload payload) {
    final record = payload.newRecord.isNotEmpty
        ? payload.newRecord
        : payload.oldRecord;
    return record['post_id']?.toString();
  }

  Future<void> disconnect() async {
    final channel = _channel;
    if (channel == null) return;
    await Supabase.instance.client.removeChannel(channel);
    _channel = null;
  }

  Future<void> dispose() async {
    await disconnect();
    await _eventsController.close();
  }
}

/// A single realtime change event. Existing callers continue to use
/// [type] / [recordId]; the newer fields ([kind], [messageRecord]) let
/// the in-app message overlay resolve a tappable banner without an
/// extra round trip.
class FeedinRealtimeEvent {
  const FeedinRealtimeEvent({
    required this.type,
    this.recordId,
    this.kind = FeedinRealtimeEventKind.unknown,
    this.messageRecord,
  });

  final FeedinRealtimeEventType type;
  final String? recordId;
  final FeedinRealtimeEventKind kind;

  /// The full row from the change payload. Only `messages` events are
  /// guaranteed to carry the fields the [IncomingMessageResolver]
  /// needs; for other tables this is mostly `null`/empty.
  final Map<String, dynamic>? messageRecord;

  /// Convenience for callers that need to know which conversation a
  /// message belongs to without inspecting the full record.
  String? get messageConversationId {
    final record = messageRecord;
    if (record == null) return null;
    final direct = record['conversation_id']?.toString();
    if (direct != null && direct.isNotEmpty) return direct;
    return null;
  }
}

enum FeedinRealtimeEventType {
  postChanged,
  messageChanged,
  notificationChanged,
}

/// Postgres change kind for `messages`. Lets the in-app overlay
/// distinguish a new incoming message from an update/delete on an
/// existing one.
enum FeedinRealtimeEventKind { insert, update, delete, unknown }