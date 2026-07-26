import '../../domain/call_session.dart';

/// Pure translation between the domain [CallSession] and the `call_logs` wire
/// contract (columns: id, caller_id, receiver_id, call_type voice|video,
/// status pending|answered|rejected|ended|missed, started_at, ended_at,
/// duration_seconds, created_at).
///
/// The anti-corruption layer for calling: the ONLY place that knows the
/// server's status vocabulary, how far-side signals derive from row changes,
/// and the media room naming. Pure Dart — fully unit-tested without a network.
class CallWireCodec {
  const CallWireCodec._();

  /// Both participants join this LiveKit room; the token function authorizes
  /// membership server-side from the call row.
  static String roomName(String callId) => 'call-$callId';

  // -- Status vocabulary --------------------------------------------------------

  static const statusPending = 'pending';
  static const statusAnswered = 'answered';
  static const statusRejected = 'rejected';
  static const statusEnded = 'ended';
  static const statusMissed = 'missed';

  static CallLifecycleState stateFromStatus(String? status) =>
      switch (status) {
        statusPending => CallLifecycleState.ringing,
        statusAnswered => CallLifecycleState.connected,
        statusRejected => CallLifecycleState.rejected,
        statusEnded => CallLifecycleState.ended,
        statusMissed => CallLifecycleState.missed,
        _ => CallLifecycleState.idle,
      };

  static CallMode modeFromWire(Object? callType) =>
      callType?.toString() == 'video' ? CallMode.video : CallMode.voice;

  static String modeToWire(CallMode mode) => mode.isVideo ? 'video' : 'voice';

  // -- Row <-> session -----------------------------------------------------------

  static CallSession sessionFromRow(
    Map<String, Object?> row, {
    required String selfUserId,
  }) {
    final callerId = row['caller_id']?.toString() ?? '';
    final receiverId = row['receiver_id']?.toString() ?? '';
    return CallSession(
      id: row['id']?.toString() ?? '',
      // 1:1 wire rows carry no conversation id; the DM pair IS the scope.
      conversationId: row['conversation_id']?.toString() ?? '',
      mode: modeFromWire(row['call_type']),
      callerId: callerId,
      state: stateFromStatus(row['status']?.toString()),
      participants: [
        CallParticipant(userId: callerId),
        if (receiverId.isNotEmpty && receiverId != callerId)
          CallParticipant(userId: receiverId),
      ],
      startedAtMillis: _millis(row['started_at']),
      endedAtMillis: _millis(row['ended_at']),
    );
  }

  static Map<String, Object?> insertRowFor(
    CallSession session, {
    required String receiverId,
  }) => {
    'caller_id': session.callerId,
    'receiver_id': receiverId,
    'call_type': modeToWire(session.mode),
    'status': statusPending,
  };

  // -- Far-side signal derivation --------------------------------------------------

  /// Which control-plane signal (if any) a row change means FOR [selfUserId].
  /// Self-originated transitions return null (we already know what we did).
  ///
  ///  * callee + INSERT(pending)            -> incoming
  ///  * caller + pending->answered          -> accepted
  ///  * caller + pending->rejected          -> rejected (decline or busy)
  ///  * caller + pending->missed            -> null (we wrote it) — but callee
  ///    observing pending->missed           -> cancelled (caller gave up)
  ///  * either + answered->ended            -> ended (the OTHER side hung up;
  ///    local hangup is deduped by the engine's terminal-state guard)
  static CallSignalKindWire? signalFor({
    required Map<String, Object?> row,
    required String selfUserId,
    required bool isInsert,
  }) {
    final callerId = row['caller_id']?.toString();
    final receiverId = row['receiver_id']?.toString();
    final status = row['status']?.toString();
    final isCaller = selfUserId == callerId;
    final isCallee = selfUserId == receiverId;
    if (!isCaller && !isCallee) return null; // not our call

    if (isInsert) {
      return (isCallee && status == statusPending)
          ? CallSignalKindWire.incoming
          : null;
    }
    return switch (status) {
      statusAnswered => isCaller ? CallSignalKindWire.accepted : null,
      statusRejected => isCaller ? CallSignalKindWire.rejected : null,
      statusMissed => isCallee ? CallSignalKindWire.cancelled : null,
      statusEnded => CallSignalKindWire.ended,
      _ => null,
    };
  }

  static int? _millis(Object? value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
  }
}

/// Wire-level signal kinds (mapped 1:1 onto the engine's CallSignalKind by the
/// adapter; kept separate so the codec stays dependency-free).
enum CallSignalKindWire { incoming, accepted, rejected, cancelled, ended }
