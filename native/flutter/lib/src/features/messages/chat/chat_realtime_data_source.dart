import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Conversation-scoped realtime bridge for typing, presence, and read receipts.
///
/// The backing tables and RPCs are defined by
/// `20260627143100_native_messages_parity_contracts.sql`. This client only
/// consumes that contract and degrades to a no-op when Supabase is unavailable.
class ChatRealtimeDataSource {
  ChatRealtimeDataSource({required this.isConfigured});

  factory ChatRealtimeDataSource.autoDetect() {
    return ChatRealtimeDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;
  final _events = StreamController<ChatRealtimeEvent>.broadcast();

  RealtimeChannel? _channel;
  String? _conversationId;
  String? _currentUserId;
  String? _otherUserId;
  int _connectionGeneration = 0;
  bool _disposed = false;

  Stream<ChatRealtimeEvent> get events => _events.stream;

  static bool _supabaseAvailable() {
    try {
      Supabase.instance.client;
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> connect({
    required String conversationId,
    required String currentUserId,
    String? otherUserId,
  }) async {
    if (_disposed ||
        !isConfigured ||
        conversationId.isEmpty ||
        currentUserId.isEmpty) {
      return;
    }
    if (_channel != null &&
        _conversationId == conversationId &&
        _currentUserId == currentUserId &&
        _otherUserId == otherUserId) {
      await refresh();
      return;
    }

    final generation = ++_connectionGeneration;
    await _disconnectChannel();
    if (_disposed || generation != _connectionGeneration) return;

    final SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (_) {
      return;
    }

    _conversationId = conversationId;
    _currentUserId = currentUserId;
    _otherUserId = otherUserId;

    var channel = client
        .channel('feedin-chat:$conversationId:$currentUserId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'typing_indicators',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: conversationId,
          ),
          callback: (payload) => _emitTyping(
            payload.newRecord.isNotEmpty
                ? payload.newRecord
                : payload.oldRecord,
          ),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'message_read_receipts',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: conversationId,
          ),
          callback: (payload) => _emitReceipt(
            payload.newRecord.isNotEmpty
                ? payload.newRecord
                : payload.oldRecord,
          ),
        );

    if (otherUserId != null && otherUserId.isNotEmpty) {
      channel = channel.onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'user_presence',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq,
          column: 'user_id',
          value: otherUserId,
        ),
        callback: (payload) => _emitPresence(
          payload.newRecord.isNotEmpty ? payload.newRecord : payload.oldRecord,
        ),
      );
    }

    _channel = channel;
    channel.subscribe();
    await refresh();
  }

  /// Loads current rows after subscribing so the header is correct before the
  /// next realtime change arrives.
  Future<void> refresh() async {
    if (_disposed || !isConfigured) return;
    final conversationId = _conversationId;
    final otherUserId = _otherUserId;
    if (conversationId == null) return;

    final SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (_) {
      return;
    }

    await Future.wait(<Future<void>>[
      _refreshTyping(client, conversationId, otherUserId),
      if (otherUserId != null && otherUserId.isNotEmpty)
        _refreshPresence(client, otherUserId),
    ]);
  }

  Future<void> _refreshTyping(
    SupabaseClient client,
    String conversationId,
    String? otherUserId,
  ) async {
    if (otherUserId == null || otherUserId.isEmpty) return;
    try {
      final row = await client
          .from('typing_indicators')
          .select('conversation_id, user_id, activity, updated_at')
          .eq('conversation_id', conversationId)
          .eq('user_id', otherUserId)
          .maybeSingle();
      if (row != null) _emitTyping(row);
    } catch (_) {
      // Typing metadata must never make the message thread unavailable.
    }
  }

  Future<void> _refreshPresence(
    SupabaseClient client,
    String otherUserId,
  ) async {
    try {
      final row = await client
          .from('user_presence')
          .select('user_id, status, last_seen_at, updated_at')
          .eq('user_id', otherUserId)
          .maybeSingle();
      if (row != null) _emitPresence(row);
    } catch (_) {
      // Presence is optional metadata; the stored summary remains the fallback.
    }
  }

  Future<void> setTyping(bool active) async {
    if (_disposed || !isConfigured) return;
    final conversationId = _conversationId;
    if (conversationId == null || conversationId.isEmpty) return;
    try {
      await Supabase.instance.client.rpc<void>(
        'set_typing_indicator',
        params: {
          'p_conversation_id': conversationId,
          'p_activity': active ? 'typing' : 'idle',
        },
      );
    } catch (_) {
      // Typing is best-effort and should never block composing.
    }
  }

  Future<void> updatePresence(String status) async {
    if (_disposed || !isConfigured) return;
    try {
      await Supabase.instance.client.rpc<void>(
        'update_presence',
        params: {'p_status': status},
      );
    } catch (_) {
      // Presence is best-effort and should never affect navigation.
    }
  }

  void _emitTyping(Map<String, dynamic> row) {
    _addEvent(
      ChatRealtimeEvent.fromTypingRow(row, currentUserId: _currentUserId),
    );
  }

  void _emitPresence(Map<String, dynamic> row) {
    _addEvent(
      ChatRealtimeEvent.fromPresenceRow(row, currentUserId: _currentUserId),
    );
  }

  void _emitReceipt(Map<String, dynamic> row) {
    _addEvent(
      ChatRealtimeEvent.fromReadReceiptRow(row, currentUserId: _currentUserId),
    );
  }

  void _addEvent(ChatRealtimeEvent? event) {
    if (event == null || _disposed || _events.isClosed) return;
    _events.add(event);
  }

  Future<void> disconnect() async {
    _connectionGeneration++;
    await _disconnectChannel();
  }

  Future<void> _disconnectChannel() async {
    final channel = _channel;
    _channel = null;
    _conversationId = null;
    _currentUserId = null;
    _otherUserId = null;
    if (channel == null) return;
    try {
      await Supabase.instance.client.removeChannel(channel);
    } catch (_) {
      // The client may already be torn down during application shutdown.
    }
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    _connectionGeneration++;
    await _disconnectChannel();
    await _events.close();
  }
}

enum ChatRealtimeEventType { typing, presence, readReceipt }

class ChatRealtimeEvent {
  const ChatRealtimeEvent({
    required this.type,
    required this.userId,
    this.activity,
    this.presence,
    this.messageId,
    this.occurredAtMillis,
  });

  final ChatRealtimeEventType type;
  final String userId;
  final String? activity;
  final String? presence;
  final String? messageId;
  final int? occurredAtMillis;

  static ChatRealtimeEvent? fromTypingRow(
    Map<String, dynamic> row, {
    String? currentUserId,
  }) {
    final userId = _rowUserId(row, currentUserId: currentUserId);
    if (userId == null) return null;
    return ChatRealtimeEvent(
      type: ChatRealtimeEventType.typing,
      userId: userId,
      activity: row['activity']?.toString(),
      occurredAtMillis: _parseNullableMillis(row['updated_at']),
    );
  }

  static ChatRealtimeEvent? fromPresenceRow(
    Map<String, dynamic> row, {
    String? currentUserId,
  }) {
    final userId = _rowUserId(row, currentUserId: currentUserId);
    if (userId == null) return null;
    return ChatRealtimeEvent(
      type: ChatRealtimeEventType.presence,
      userId: userId,
      presence: row['status']?.toString(),
      occurredAtMillis:
          _parseNullableMillis(row['last_seen_at']) ??
          _parseNullableMillis(row['updated_at']),
    );
  }

  static ChatRealtimeEvent? fromReadReceiptRow(
    Map<String, dynamic> row, {
    String? currentUserId,
  }) {
    final userId = _rowUserId(row, currentUserId: currentUserId);
    if (userId == null) return null;
    return ChatRealtimeEvent(
      type: ChatRealtimeEventType.readReceipt,
      userId: userId,
      messageId: row['message_id']?.toString(),
      occurredAtMillis: _parseNullableMillis(row['read_at']),
    );
  }
}

int? _parseNullableMillis(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}

String? _rowUserId(Map<String, dynamic> row, {required String? currentUserId}) {
  final userId = row['user_id']?.toString();
  if (userId == null || userId.isEmpty || userId == currentUserId) return null;
  return userId;
}
