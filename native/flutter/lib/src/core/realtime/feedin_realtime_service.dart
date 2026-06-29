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
                type: FeedinRealtimeEventType.postChanged,
                recordId: _recordId(payload),
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
                type: FeedinRealtimeEventType.messageChanged,
                recordId: _recordId(payload),
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
                type: FeedinRealtimeEventType.notificationChanged,
                recordId: _recordId(payload),
              ),
            );
          },
        );

    _channel!.subscribe();
  }

  String? _recordId(PostgresChangePayload payload) {
    final record = payload.newRecord.isNotEmpty
        ? payload.newRecord
        : payload.oldRecord;
    return record['id']?.toString();
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

class FeedinRealtimeEvent {
  const FeedinRealtimeEvent({required this.type, this.recordId});

  final FeedinRealtimeEventType type;
  final String? recordId;
}

enum FeedinRealtimeEventType {
  postChanged,
  messageChanged,
  notificationChanged,
}
