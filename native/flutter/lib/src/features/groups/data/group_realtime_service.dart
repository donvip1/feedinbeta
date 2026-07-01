import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Realtime message updates for a single group conversation.
///
/// Mirrors the calls module's `CallRealtimeService` structure and the web
/// `useGroupRealtime` hook: it subscribes to `messages` INSERTs scoped to one
/// `conversation_id` so an open group room reflects new messages from other
/// members live, without polling. It is deliberately SEPARATE from the app-wide
/// realtime service (which the groups module may not edit) and from the
/// messages feature.
///
/// The emitted [GroupRealtimeMessageEvent] carries only the raw row fields the
/// screen needs to decide whether to refresh (id + sender). Profile hydration
/// stays in [GroupsRemoteDataSource] so this layer is thin. Every method
/// degrades to a no-op when Supabase is unconfigured or there is no session.
class GroupRealtimeService {
  GroupRealtimeService({required this.conversationId, required this.isConfigured});

  factory GroupRealtimeService.autoDetect(String conversationId) {
    return GroupRealtimeService(
      conversationId: conversationId,
      isConfigured: _supabaseAvailable(),
    );
  }

  final String conversationId;
  final bool isConfigured;

  RealtimeChannel? _channel;
  final _messages =
      StreamController<GroupRealtimeMessageEvent>.broadcast();

  /// Fires once per new message inserted into this conversation.
  Stream<GroupRealtimeMessageEvent> get messages => _messages.stream;

  bool get isConnected => _channel != null;

  static bool _supabaseAvailable() {
    try {
      Supabase.instance.client;
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Subscribe to inserts on this conversation. Idempotent; no-op when
  /// unconfigured.
  Future<void> connect() async {
    if (!isConfigured || _channel != null) return;

    final SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (_) {
      return;
    }

    _channel = client
        .channel('feedin-group:$conversationId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: conversationId,
          ),
          callback: (payload) => _emit(payload.newRecord),
        );

    _channel!.subscribe();
  }

  void _emit(Map<String, dynamic> record) {
    if (record.isEmpty) return;
    final id = record['id']?.toString();
    if (id == null) return;
    _messages.add(
      GroupRealtimeMessageEvent(
        messageId: id,
        conversationId: record['conversation_id']?.toString() ?? conversationId,
        senderId: record['sender_id']?.toString(),
      ),
    );
  }

  Future<void> disconnect() async {
    final channel = _channel;
    if (channel == null) return;
    _channel = null;
    try {
      await Supabase.instance.client.removeChannel(channel);
    } catch (_) {
      // Client may already be torn down; ignore.
    }
  }

  Future<void> dispose() async {
    await disconnect();
    await _messages.close();
  }
}

/// A new message inserted into the watched conversation.
class GroupRealtimeMessageEvent {
  const GroupRealtimeMessageEvent({
    required this.messageId,
    required this.conversationId,
    this.senderId,
  });

  final String messageId;
  final String conversationId;
  final String? senderId;
}
