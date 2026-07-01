import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../call_models.dart';

/// Realtime signalling for 1:1 calls, scoped to `call_logs` changes involving
/// the current user.
///
/// This is intentionally SEPARATE from the app-wide
/// `core/realtime/feedin_realtime_service.dart` (which the calls module may not
/// edit and which does not watch `call_logs`). It subscribes to two streams,
/// exactly like the web `IncomingCallListener`:
///
///   * INSERT on `call_logs` where `receiver_id = me`  -> incoming call ringing
///   * UPDATE on `call_logs` where `receiver_id = me` OR `caller_id = me`
///       -> the other party accepted / rejected / ended the call
///
/// Emitted events carry the changed row so the [CallController] can react
/// without re-fetching. Profile resolution (caller name/avatar) is left to the
/// controller via [CallsRemoteDataSource] to keep this layer thin.
class CallRealtimeService {
  CallRealtimeService({required this.isConfigured});

  factory CallRealtimeService.autoDetect() {
    return CallRealtimeService(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  RealtimeChannel? _channel;
  final _events = StreamController<CallRealtimeEvent>.broadcast();

  Stream<CallRealtimeEvent> get events => _events.stream;
  bool get isConnected => _channel != null;

  static bool _supabaseAvailable() {
    try {
      Supabase.instance.client;
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Subscribe to call changes for the current authenticated user. Idempotent:
  /// calling twice keeps the first subscription. No-op when unconfigured or
  /// signed out.
  Future<void> connect() async {
    if (!isConfigured || _channel != null) return;

    final SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (_) {
      return;
    }
    final userId = client.auth.currentUser?.id;
    if (userId == null) return;

    _channel = client
        .channel('feedin-calls:$userId')
        // Incoming calls: a new row where I'm the receiver.
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'call_logs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'receiver_id',
            value: userId,
          ),
          callback: (payload) => _emitFromRow(
            payload.newRecord,
            kind: CallRealtimeEventKind.incoming,
          ),
        )
        // Status changes on calls I received (I'm the callee): the caller
        // cancelled / it was answered elsewhere / ended.
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'call_logs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'receiver_id',
            value: userId,
          ),
          callback: (payload) => _emitFromRow(
            payload.newRecord,
            kind: CallRealtimeEventKind.statusChanged,
          ),
        )
        // Status changes on calls I placed (I'm the caller): the callee
        // answered / rejected / ended.
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'call_logs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'caller_id',
            value: userId,
          ),
          callback: (payload) => _emitFromRow(
            payload.newRecord,
            kind: CallRealtimeEventKind.statusChanged,
          ),
        );

    _channel!.subscribe();
  }

  void _emitFromRow(
    Map<String, dynamic> record, {
    required CallRealtimeEventKind kind,
  }) {
    if (record.isEmpty) return;
    final callId = record['id']?.toString();
    if (callId == null) return;
    _events.add(
      CallRealtimeEvent(
        kind: kind,
        callId: callId,
        callerId: record['caller_id']?.toString(),
        receiverId: record['receiver_id']?.toString(),
        type: CallType.fromWire(record['call_type']),
        status: CallStatus.fromWire(record['status']),
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
      // Client may have been torn down; ignore.
    }
  }

  Future<void> dispose() async {
    await disconnect();
    await _events.close();
  }
}

/// What kind of call change occurred.
enum CallRealtimeEventKind {
  /// A brand-new incoming call (INSERT where I'm the receiver).
  incoming,

  /// An existing call's status changed (UPDATE on a call I'm part of).
  statusChanged,
}

/// A realtime call change, carrying the resolved row fields the controller
/// needs to react (without re-querying).
class CallRealtimeEvent {
  const CallRealtimeEvent({
    required this.kind,
    required this.callId,
    required this.type,
    required this.status,
    this.callerId,
    this.receiverId,
  });

  final CallRealtimeEventKind kind;
  final String callId;
  final String? callerId;
  final String? receiverId;
  final CallType type;
  final CallStatus status;
}
