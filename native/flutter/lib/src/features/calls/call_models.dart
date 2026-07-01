import 'package:flutter/foundation.dart';

/// Domain models + enums for the 1:1 audio/video calling feature.
///
/// These are deliberately decoupled from Supabase and from any UI so the file
/// analyzes cleanly on its own and can be shared by the data layer, the
/// [CallController], and the call screens/widgets.
///
/// Backend mapping (live schema, migration
/// `20260624000600_native_advanced_live_calls_schema.sql`): 1:1 calls are
/// modelled on the `call_logs` table (columns: `id`, `caller_id`,
/// `receiver_id`, `call_type`, `status`, `started_at`, `ended_at`,
/// `duration_seconds`, `created_at`). This is the SAME contract the web app
/// uses (`src/pages/Call.tsx`, `src/components/calls/IncomingCall*.tsx`). The
/// `group_calls`/`group_call_participants` tables exist for multi-party rooms
/// but are NOT used for 1:1 chat calls — see the report for the gap analysis.

/// Media kind of a call. Web uses the string literals `'voice'` and `'video'`
/// in `call_logs.call_type`; the wire values here MUST match.
enum CallType {
  voice,
  video;

  String get wireValue => this == CallType.video ? 'video' : 'voice';

  bool get isVideo => this == CallType.video;

  static CallType fromWire(Object? value) {
    return value?.toString() == 'video' ? CallType.video : CallType.voice;
  }
}

/// Lifecycle status of a call row, mirroring the values the web app writes to
/// `call_logs.status`:
///   pending  -> just created by caller, receiver not yet answered (ringing)
///   answered -> receiver accepted; media session should connect
///   rejected -> receiver declined
///   ended    -> either side hung up after/while connected
///   missed   -> receiver never answered (ring timeout / caller cancelled)
///
/// The DB default is `'initiated'`; the web app immediately overwrites it with
/// `'pending'` on insert, so we treat unknown/initiated as [pending].
enum CallStatus {
  pending,
  answered,
  rejected,
  ended,
  missed;

  String get wireValue {
    switch (this) {
      case CallStatus.pending:
        return 'pending';
      case CallStatus.answered:
        return 'answered';
      case CallStatus.rejected:
        return 'rejected';
      case CallStatus.ended:
        return 'ended';
      case CallStatus.missed:
        return 'missed';
    }
  }

  static CallStatus fromWire(Object? value) {
    switch (value?.toString()) {
      case 'answered':
        return CallStatus.answered;
      case 'rejected':
        return CallStatus.rejected;
      case 'ended':
        return CallStatus.ended;
      case 'missed':
        return CallStatus.missed;
      case 'pending':
      case 'initiated':
      default:
        return CallStatus.pending;
    }
  }

  /// Whether this status means the call is finished (no live media session).
  bool get isTerminal =>
      this == CallStatus.rejected ||
      this == CallStatus.ended ||
      this == CallStatus.missed;
}

/// The high-level phase the local UI is in. Distinct from [CallStatus] because
/// it also captures caller-vs-callee framing and the local media-connect step
/// that the server row does not model.
enum CallPhase {
  /// No active call.
  idle,

  /// Local user is the caller; row inserted, waiting for the callee to answer.
  dialing,

  /// Local user is the callee; row is pending, ringing UI is shown.
  incoming,

  /// Callee accepted; the media engine is negotiating/connecting.
  connecting,

  /// Media session is live.
  connected,

  /// Call has finished (hung up / declined / missed / error).
  ended,
}

/// Direction of a call relative to the local user.
enum CallDirection { outgoing, incoming }

/// A lightweight participant descriptor used to render avatars/names on the
/// call screens. Sourced from `profiles`/`public_profiles` at call start; the
/// call layer never fetches profile rows itself beyond the remote data source.
@immutable
class CallParticipant {
  const CallParticipant({
    required this.userId,
    required this.displayName,
    this.username,
    this.avatarUrl,
  });

  final String userId;
  final String displayName;
  final String? username;
  final String? avatarUrl;

  /// Single-character avatar fallback (matches web `callerName[0]`).
  String get initial {
    final source = displayName.isNotEmpty ? displayName : (username ?? '');
    return source.isEmpty ? 'U' : source.substring(0, 1).toUpperCase();
  }

  factory CallParticipant.fromProfileJson(Map<String, Object?> json) {
    final username = json['username']?.toString();
    final displayName = json['display_name']?.toString();
    final resolvedName = (displayName != null && displayName.isNotEmpty)
        ? displayName
        : (username != null && username.isNotEmpty)
            ? username
            : 'feedIn user';
    return CallParticipant(
      userId: json['id'].toString(),
      displayName: resolvedName,
      username: username,
      avatarUrl: json['avatar_url']?.toString(),
    );
  }
}

/// An immutable snapshot of a `call_logs` row plus the resolved participants.
///
/// The [self] / [peer] split is computed at the data layer from the viewer's
/// auth id so the UI never has to reason about caller/receiver columns.
@immutable
class CallSession {
  const CallSession({
    required this.id,
    required this.callerId,
    required this.receiverId,
    required this.type,
    required this.status,
    required this.direction,
    required this.peer,
    this.startedAtMillis,
    this.endedAtMillis,
    this.durationSeconds = 0,
    this.createdAtMillis,
  });

  final String id;
  final String callerId;
  final String receiverId;
  final CallType type;
  final CallStatus status;

  /// Direction relative to the local viewer.
  final CallDirection direction;

  /// The OTHER user in the call (the person to show on screen).
  final CallParticipant peer;

  final int? startedAtMillis;
  final int? endedAtMillis;
  final int durationSeconds;
  final int? createdAtMillis;

  bool get isOutgoing => direction == CallDirection.outgoing;

  CallSession copyWith({
    CallStatus? status,
    int? startedAtMillis,
    int? endedAtMillis,
    int? durationSeconds,
  }) {
    return CallSession(
      id: id,
      callerId: callerId,
      receiverId: receiverId,
      type: type,
      status: status ?? this.status,
      direction: direction,
      peer: peer,
      startedAtMillis: startedAtMillis ?? this.startedAtMillis,
      endedAtMillis: endedAtMillis ?? this.endedAtMillis,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      createdAtMillis: createdAtMillis,
    );
  }
}

/// A remote signalling message from the `call_signals` table. Reserved for the
/// real media engine (WebRTC SDP/ICE exchange). The stub engine ignores these,
/// but the data layer exposes the seam so the media integration does not need
/// to touch this module's public API later.
@immutable
class CallSignal {
  const CallSignal({
    required this.callId,
    required this.senderId,
    required this.signalType,
    required this.payload,
    this.recipientId,
  });

  final String callId;
  final String senderId;
  final String? recipientId;
  final String signalType;
  final Map<String, Object?> payload;

  factory CallSignal.fromJson(Map<String, Object?> json) {
    final rawPayload = json['payload'];
    return CallSignal(
      callId: json['call_id'].toString(),
      senderId: json['sender_id'].toString(),
      recipientId: json['recipient_id']?.toString(),
      signalType: json['signal_type']?.toString() ?? 'unknown',
      payload: rawPayload is Map
          ? Map<String, Object?>.from(rawPayload)
          : const {},
    );
  }
}
