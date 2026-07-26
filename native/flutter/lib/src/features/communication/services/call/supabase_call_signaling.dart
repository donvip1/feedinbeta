import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/call_session.dart';
import '../../domain/result.dart';
import 'call_signaling.dart';
import 'call_transport.dart' show CallTransport; // doc reference only
import 'call_wire_codec.dart';

/// [CallSignaling] over Supabase: `call_logs` writes + realtime row changes,
/// with the ring push fired via the `send-call-push` edge function (data-only
/// FCM → CallKit on a killed device).
///
/// Deliberately THIN — every mapping/derivation decision lives in the pure
/// [CallWireCodec]; this class only performs I/O. The media plane
/// ([CallTransport]) is entirely separate.
class SupabaseCallSignaling implements CallSignaling {
  SupabaseCallSignaling({required this.selfUserId, SupabaseClient? client})
    : _client = client;

  final String selfUserId;
  final SupabaseClient? _client;

  static const _table = 'call_logs';
  static const _columns =
      'id, caller_id, receiver_id, call_type, status, started_at, ended_at, '
      'duration_seconds, created_at';

  final _signals = StreamController<CallSignal>.broadcast();
  RealtimeChannel? _channel;

  SupabaseClient? get _resolved {
    if (_client != null) return _client;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<CallSignal> get signals => _signals.stream;

  /// Subscribe to call-row changes involving this user. Idempotent.
  Future<void> connect() async {
    final client = _resolved;
    if (client == null || _channel != null) return;
    _channel = client
        .channel('comms-calls:$selfUserId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: _table,
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'receiver_id',
            value: selfUserId,
          ),
          callback: (payload) => _emitFromRow(payload.newRecord, isInsert: true),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: _table,
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'receiver_id',
            value: selfUserId,
          ),
          callback: (payload) => _emitFromRow(payload.newRecord, isInsert: false),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: _table,
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'caller_id',
            value: selfUserId,
          ),
          callback: (payload) => _emitFromRow(payload.newRecord, isInsert: false),
        )
      ..subscribe();
  }

  void _emitFromRow(Map<String, dynamic> record, {required bool isInsert}) {
    if (record.isEmpty || _signals.isClosed) return;
    final wireKind = CallWireCodec.signalFor(
      row: record,
      selfUserId: selfUserId,
      isInsert: isInsert,
    );
    if (wireKind == null) return;
    final session = CallWireCodec.sessionFromRow(
      Map<String, Object?>.from(record),
      selfUserId: selfUserId,
    );
    _signals.add(CallSignal(_mapKind(wireKind), session));
  }

  CallSignalKind _mapKind(CallSignalKindWire wire) => switch (wire) {
    CallSignalKindWire.incoming => CallSignalKind.incoming,
    CallSignalKindWire.accepted => CallSignalKind.accepted,
    CallSignalKindWire.rejected => CallSignalKind.rejected,
    CallSignalKindWire.cancelled => CallSignalKind.cancelled,
    CallSignalKindWire.ended => CallSignalKind.ended,
  };

  // -- Control-plane writes -----------------------------------------------------

  @override
  Future<Result<CallSession>> invite(CallSession session) async {
    final client = _resolved;
    if (client == null) return Err(CommError.network('Backend not configured'));
    final receiverId = session.participants
        .map((p) => p.userId)
        .firstWhere((id) => id != session.callerId, orElse: () => '');
    if (receiverId.isEmpty) {
      return Err(CommError.validation('Call has no callee'));
    }
    try {
      final row = await client
          .from(_table)
          .insert(CallWireCodec.insertRowFor(session, receiverId: receiverId))
          .select(_columns)
          .single();
      final created = CallWireCodec.sessionFromRow(
        Map<String, Object?>.from(row),
        selfUserId: selfUserId,
      );
      // Ring the callee's devices even when their app is killed. Best-effort:
      // realtime is the primary path while the app is alive.
      unawaited(_sendRingPush(client, created.id));
      return Ok(
        CallSession(
          id: created.id,
          conversationId: session.conversationId,
          mode: session.mode,
          callerId: session.callerId,
          state: session.state,
          participants: session.participants,
        ),
      );
    } on PostgrestException catch (error) {
      return Err(CommError.network(error.message, cause: error));
    } catch (error) {
      return Err(CommError.network('invite failed', cause: error));
    }
  }

  Future<void> _sendRingPush(SupabaseClient client, String callId) async {
    try {
      await client.functions.invoke('send-call-push', body: {'call_id': callId});
    } catch (_) {/* non-critical */}
  }

  @override
  Future<Result<void>> accept(String callId) => _setStatus(
    callId,
    CallWireCodec.statusAnswered,
    startedAt: true,
  );

  @override
  Future<Result<void>> reject(String callId) =>
      _setStatus(callId, CallWireCodec.statusRejected, endedAt: true);

  @override
  Future<Result<void>> busy(String callId) =>
      // Busy rides the rejected status on this contract; the caller UI reads
      // it as declined-or-busy either way.
      _setStatus(callId, CallWireCodec.statusRejected, endedAt: true);

  @override
  Future<Result<void>> cancel(String callId) =>
      _setStatus(callId, CallWireCodec.statusMissed, endedAt: true);

  @override
  Future<Result<void>> markMissed(String callId) =>
      _setStatus(callId, CallWireCodec.statusMissed, endedAt: true);

  @override
  Future<Result<void>> end(String callId, {required int durationSeconds}) =>
      _setStatus(
        callId,
        CallWireCodec.statusEnded,
        endedAt: true,
        durationSeconds: durationSeconds,
      );

  Future<Result<void>> _setStatus(
    String callId,
    String status, {
    bool startedAt = false,
    bool endedAt = false,
    int? durationSeconds,
  }) async {
    final client = _resolved;
    if (client == null) return Err(CommError.network('Backend not configured'));
    try {
      await client
          .from(_table)
          .update({
            'status': status,
            if (startedAt)
              'started_at': DateTime.now().toUtc().toIso8601String(),
            if (endedAt) 'ended_at': DateTime.now().toUtc().toIso8601String(),
            if (durationSeconds != null && durationSeconds > 0)
              'duration_seconds': durationSeconds,
          })
          .eq('id', callId);
      return const Ok(null);
    } on PostgrestException catch (error) {
      return Err(CommError.network(error.message, cause: error));
    } catch (error) {
      return Err(CommError.network('call update failed', cause: error));
    }
  }

  @override
  Future<CallSession?> fetchCall(String callId) async {
    final client = _resolved;
    if (client == null) return null;
    try {
      final row = await client
          .from(_table)
          .select(_columns)
          .eq('id', callId)
          .maybeSingle();
      if (row == null) return null;
      return CallWireCodec.sessionFromRow(
        Map<String, Object?>.from(row),
        selfUserId: selfUserId,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> dispose() async {
    final channel = _channel;
    _channel = null;
    if (channel != null) {
      try {
        await _resolved?.removeChannel(channel);
      } catch (_) {}
    }
    await _signals.close();
  }
}
