import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

class CommunityRealtimeService {
  CommunityRealtimeService({required this.groupId, required this.isConfigured});

  factory CommunityRealtimeService.autoDetect(String groupId) {
    try {
      Supabase.instance.client;
      return CommunityRealtimeService(groupId: groupId, isConfigured: true);
    } catch (_) {
      return CommunityRealtimeService(groupId: groupId, isConfigured: false);
    }
  }

  final String groupId;
  final bool isConfigured;
  RealtimeChannel? _channel;
  final _changes = StreamController<void>.broadcast();

  Stream<void> get changes => _changes.stream;

  void connect() {
    if (!isConfigured || _channel != null) return;
    _channel = Supabase.instance.client
        .channel('community:$groupId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'group_messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'group_id',
            value: groupId,
          ),
          callback: (_) => _changes.add(null),
        );
    _channel!.subscribe();
  }

  Future<void> dispose() async {
    final channel = _channel;
    _channel = null;
    if (channel != null) {
      await Supabase.instance.client.removeChannel(channel);
    }
    await _changes.close();
  }
}
