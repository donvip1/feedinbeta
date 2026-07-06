import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../call_models.dart';

/// Live data access for 1:1 audio/video calls.
///
/// Talks directly to the `call_logs` / `call_participants` / `call_signals`
/// tables (migration `20260624000600_native_advanced_live_calls_schema.sql`,
/// RLS in `20260624000700_native_extended_rls_policies.sql`). There are no
/// call RPCs on the backend, so — exactly like the web app
/// (`src/pages/Call.tsx`, `src/components/calls/IncomingCall.tsx`) — the call
/// state machine is implemented as plain insert/update statements against
/// `call_logs.status`:
///
///   caller inserts   -> status 'pending'          (ringing on callee)
///   callee accepts   -> status 'answered', started_at = now()
///   callee declines  -> status 'rejected', ended_at = now()
///   either hangs up  -> status 'ended',    ended_at = now(), duration_seconds
///   ring timeout     -> status 'missed',   ended_at = now()
///
/// All methods degrade gracefully when Supabase is unconfigured or there is no
/// authenticated user: writes become no-ops and reads return null/empty.
class CallsRemoteDataSource {
  const CallsRemoteDataSource({required this.isConfigured});

  /// Detects configuration from whether the Supabase singleton is available.
  factory CallsRemoteDataSource.autoDetect() {
    return CallsRemoteDataSource(isConfigured: _supabaseAvailable());
  }

  final bool isConfigured;

  static const _callLogsTable = 'call_logs';
  static const _callParticipantsTable = 'call_participants';
  static const _callSignalsTable = 'call_signals';
  static const _profilesTable = 'profiles';

  // Only columns that exist on the live `call_logs` table (see migration). We
  // deliberately avoid selecting anything else so PostgREST does not raise a
  // schema-cache error.
  static const _callLogColumns =
      'id, caller_id, receiver_id, call_type, status, started_at, ended_at, '
      'duration_seconds, created_at';

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

  // ---------------------------------------------------------------------------
  // Placing / answering / ending calls
  // ---------------------------------------------------------------------------

  /// Insert a new outgoing call row (status `pending`) and return the resolved
  /// [CallSession] (direction: outgoing). Returns null when unconfigured, not
  /// authenticated, or the insert fails.
  Future<CallSession?> startCall({
    required CallParticipant callee,
    required CallType type,
  }) async {
    final client = _client;
    final callerId = currentUserId;
    if (client == null || callerId == null) return null;
    if (callerId == callee.userId) return null;

    final row = await client
        .from(_callLogsTable)
        .insert({
          'caller_id': callerId,
          'receiver_id': callee.userId,
          'call_type': type.wireValue,
          'status': CallStatus.pending.wireValue,
        })
        .select(_callLogColumns)
        .single();

    // Register the caller as a participant (best-effort; RLS lets me add self).
    final callId = row['id'].toString();
    await _addSelfParticipant(callId);

    // Ring the callee's native devices via the server-owned data-only push, so
    // the call surfaces (CallKit) even when their app is killed. Best-effort:
    // realtime still delivers the ring while their app is alive.
    unawaited(_sendCallPush(client, callId));

    return _sessionFromRow(
      Map<String, Object?>.from(row),
      viewerId: callerId,
      peerOverride: callee,
    );
  }

  /// Mark a pending call as answered (callee side). Also adds the callee as a
  /// participant. Mirrors `IncomingCall.handleAccept` on the web.
  Future<void> answerCall(String callId) async {
    final client = _client;
    if (client == null) return;
    await client
        .from(_callLogsTable)
        .update({
          'status': CallStatus.answered.wireValue,
          'started_at': DateTime.now().toUtc().toIso8601String(),
        })
        .eq('id', callId);
    await _addSelfParticipant(callId);
  }

  /// Mark a pending call as rejected (callee declined). Mirrors
  /// `IncomingCall.handleReject`.
  Future<void> rejectCall(String callId) async {
    await _finishCall(callId, CallStatus.rejected, durationSeconds: 0);
  }

  /// Mark an in-progress or dialing call as ended (either side hangs up),
  /// recording the elapsed [durationSeconds].
  Future<void> endCall(String callId, {int durationSeconds = 0}) async {
    await _finishCall(
      callId,
      CallStatus.ended,
      durationSeconds: durationSeconds,
    );
  }

  /// Mark an unanswered outgoing call as missed (ring timeout / caller cancel
  /// before answer).
  Future<void> markMissed(String callId) async {
    await _finishCall(callId, CallStatus.missed, durationSeconds: 0);
  }

  Future<void> _finishCall(
    String callId,
    CallStatus status, {
    required int durationSeconds,
  }) async {
    final client = _client;
    if (client == null) return;
    await client
        .from(_callLogsTable)
        .update({
          'status': status.wireValue,
          'ended_at': DateTime.now().toUtc().toIso8601String(),
          if (durationSeconds > 0) 'duration_seconds': durationSeconds,
        })
        .eq('id', callId);
  }

  /// Ask the server to ring the callee's native devices (data-only FCM →
  /// full-screen CallKit). Best-effort: swallow any error so a push hiccup never
  /// fails placing the call — the callee's realtime listener is the primary path
  /// while their app is alive.
  Future<void> _sendCallPush(SupabaseClient client, String callId) async {
    try {
      await client.functions.invoke(
        'send-call-push',
        body: {'call_id': callId},
      );
    } catch (_) {
      // ignore — non-critical
    }
  }

  Future<void> _addSelfParticipant(String callId) async {
    final client = _client;
    final userId = currentUserId;
    if (client == null || userId == null) return;
    try {
      await client.from(_callParticipantsTable).upsert({
        'call_id': callId,
        'user_id': userId,
        'joined_at': DateTime.now().toUtc().toIso8601String(),
      }, onConflict: 'call_id,user_id', ignoreDuplicates: true);
    } catch (_) {
      // Participant tracking is best-effort; never fail the call for it.
    }
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  /// Fetch a single call row as a [CallSession] resolved for the current
  /// viewer, or null if not found / unconfigured.
  Future<CallSession?> fetchCall(String callId) async {
    final client = _client;
    final viewerId = currentUserId;
    if (client == null || viewerId == null) return null;

    final row = await client
        .from(_callLogsTable)
        .select(_callLogColumns)
        .eq('id', callId)
        .maybeSingle();
    if (row == null) return null;

    final map = Map<String, Object?>.from(row);
    final peer = await _resolvePeer(map, viewerId);
    return _sessionFromRow(map, viewerId: viewerId, peerOverride: peer);
  }

  /// Fetch the most recent still-pending incoming call for the current user
  /// created within [freshnessWindow] (poll fallback for realtime, matching the
  /// web `IncomingCallListener.checkPendingCalls`). Returns null if none.
  Future<CallSession?> fetchPendingIncomingCall({
    Duration freshnessWindow = const Duration(seconds: 60),
  }) async {
    final client = _client;
    final viewerId = currentUserId;
    if (client == null || viewerId == null) return null;

    final rows = await client
        .from(_callLogsTable)
        .select(_callLogColumns)
        .eq('receiver_id', viewerId)
        .eq('status', CallStatus.pending.wireValue)
        .order('created_at', ascending: false)
        .limit(1);

    final list = rows.whereType<Map>().toList();
    if (list.isEmpty) return null;

    final map = Map<String, Object?>.from(list.first);
    final createdAt =
        DateTime.tryParse(map['created_at']?.toString() ?? '')?.toUtc();
    if (createdAt != null &&
        DateTime.now().toUtc().difference(createdAt) > freshnessWindow) {
      return null; // stale
    }

    final peer = await _resolvePeer(map, viewerId);
    return _sessionFromRow(map, viewerId: viewerId, peerOverride: peer);
  }

  /// Read the current status of a call (used by both sides to detect the other
  /// party accepting / rejecting / ending). Returns null if not found.
  Future<CallStatus?> fetchCallStatus(String callId) async {
    final client = _client;
    if (client == null) return null;
    final row = await client
        .from(_callLogsTable)
        .select('status')
        .eq('id', callId)
        .maybeSingle();
    if (row == null) return null;
    return CallStatus.fromWire(row['status']);
  }

  /// Resolve a [CallParticipant] for a peer user id from `profiles`.
  Future<CallParticipant?> fetchParticipant(String userId) async {
    final client = _client;
    if (client == null) return null;
    final row = await client
        .from(_profilesTable)
        .select('id, display_name, username, avatar_url')
        .eq('id', userId)
        .maybeSingle();
    if (row == null) return null;
    return CallParticipant.fromProfileJson(Map<String, Object?>.from(row));
  }

  // ---------------------------------------------------------------------------
  // Signalling (reserved for the real media engine — WebRTC SDP/ICE exchange)
  // ---------------------------------------------------------------------------

  /// Persist a signalling payload to `call_signals`. No-op unless configured.
  /// The stub media engine never calls this; it exists so a real WebRTC engine
  /// can exchange offers/answers/candidates without touching this module.
  Future<void> sendSignal({
    required String callId,
    required String signalType,
    required Map<String, Object?> payload,
    String? recipientId,
  }) async {
    final client = _client;
    final senderId = currentUserId;
    if (client == null || senderId == null) return;
    await client.from(_callSignalsTable).insert({
      'call_id': callId,
      'sender_id': senderId,
      if (recipientId != null) 'recipient_id': recipientId,
      'signal_type': signalType,
      'payload': payload,
    });
  }

  /// Realtime stream of signals for [callId] addressed to the current user
  /// (excludes the user's own signals). Empty stream when unconfigured.
  ///
  /// Backed by Supabase realtime on `call_signals`. The underlying stream
  /// re-emits the FULL matching row set on every change, so we de-dupe by row
  /// id (tracking a seen-id set) and emit each new signal exactly once, and we
  /// filter out rows this user sent so the media engine never processes its own
  /// offer/answer/candidate. RLS already restricts rows to the two call
  /// participants, so no recipient filter is needed here.
  Stream<CallSignal> watchCallSignals(String callId) {
    final client = _client;
    if (client == null) return const Stream.empty();
    final selfId = currentUserId;
    final seenIds = <String>{};

    return client
        .from(_callSignalsTable)
        .stream(primaryKey: ['id'])
        .eq('call_id', callId)
        .expand((rows) {
          final fresh = <CallSignal>[];
          for (final row in rows) {
            final map = Map<String, Object?>.from(row);
            final id = map['id']?.toString();
            // Skip rows we've already surfaced (the stream re-emits the whole
            // set on each change) and our own signals.
            if (id == null || !seenIds.add(id)) continue;
            if (selfId != null && map['sender_id']?.toString() == selfId) {
              continue;
            }
            fresh.add(CallSignal.fromJson(map));
          }
          return fresh;
        });
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  Future<CallParticipant> _resolvePeer(
    Map<String, Object?> row,
    String viewerId,
  ) async {
    final callerId = row['caller_id']?.toString() ?? '';
    final receiverId = row['receiver_id']?.toString() ?? '';
    final peerId = viewerId == callerId ? receiverId : callerId;
    final resolved = await fetchParticipant(peerId);
    return resolved ??
        CallParticipant(userId: peerId, displayName: 'feedIn user');
  }

  CallSession _sessionFromRow(
    Map<String, Object?> row, {
    required String viewerId,
    required CallParticipant peerOverride,
  }) {
    final callerId = row['caller_id']?.toString() ?? '';
    final receiverId = row['receiver_id']?.toString() ?? '';
    final direction = viewerId == callerId
        ? CallDirection.outgoing
        : CallDirection.incoming;

    return CallSession(
      id: row['id'].toString(),
      callerId: callerId,
      receiverId: receiverId,
      type: CallType.fromWire(row['call_type']),
      status: CallStatus.fromWire(row['status']),
      direction: direction,
      peer: peerOverride,
      startedAtMillis: _millis(row['started_at']),
      endedAtMillis: _millis(row['ended_at']),
      durationSeconds:
          int.tryParse(row['duration_seconds']?.toString() ?? '0') ?? 0,
      createdAtMillis: _millis(row['created_at']),
    );
  }

  static int? _millis(Object? value) {
    if (value == null) return null;
    if (value is DateTime) return value.millisecondsSinceEpoch;
    return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
  }
}
