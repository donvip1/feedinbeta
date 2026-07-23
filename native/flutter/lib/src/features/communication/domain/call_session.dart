/// Every real-time session — 1:1 voice/video, group calls, audio spaces,
/// creator broadcasts, future webinar/stage — is one [CallSession] with a
/// different [mode] and policy. Adding a mode never requires a new engine.
enum CallMode {
  voice,
  video,
  groupVoice,
  groupVideo,
  space,
  broadcast,
  webinar,
  stage,
  screenShare;

  bool get isVideo =>
      this == video || this == groupVideo || this == webinar || this == stage;

  bool get isGroup =>
      this == groupVoice ||
      this == groupVideo ||
      this == space ||
      this == broadcast ||
      this == webinar ||
      this == stage;
}

/// The full call lifecycle the engine drives. [canTransitionTo] encodes the
/// legal state machine so invalid jumps are caught in tests and rejected at
/// runtime.
enum CallLifecycleState {
  idle,
  inviting,
  ringing,
  connecting,
  connected,
  reconnecting,
  ended,
  rejected,
  busy,
  missed,
  failed;

  bool get isTerminal =>
      this == ended ||
      this == rejected ||
      this == busy ||
      this == missed ||
      this == failed;

  bool get isActive =>
      this == connecting || this == connected || this == reconnecting;

  bool canTransitionTo(CallLifecycleState next) {
    if (isTerminal) return false; // terminal is absorbing
    return switch (this) {
      idle => next == inviting || next == ringing,
      inviting =>
        next == ringing ||
            next == connecting ||
            next == rejected ||
            next == busy ||
            next == missed ||
            next == failed,
      ringing =>
        next == connecting ||
            next == rejected ||
            next == busy ||
            next == missed ||
            next == failed,
      connecting => next == connected || next == failed || next == ended,
      connected => next == reconnecting || next == ended || next == failed,
      reconnecting => next == connected || next == ended || next == failed,
      _ => false,
    };
  }
}

class CallParticipant {
  const CallParticipant({
    required this.userId,
    this.displayName = '',
    this.isMuted = false,
    this.isVideoOn = false,
    this.isSpeaking = false,
    this.isScreenSharing = false,
    this.joinedAtMillis,
  });

  final String userId;
  final String displayName;
  final bool isMuted;
  final bool isVideoOn;
  final bool isSpeaking;
  final bool isScreenSharing;
  final int? joinedAtMillis;

  CallParticipant copyWith({
    bool? isMuted,
    bool? isVideoOn,
    bool? isSpeaking,
    bool? isScreenSharing,
    int? joinedAtMillis,
  }) {
    return CallParticipant(
      userId: userId,
      displayName: displayName,
      isMuted: isMuted ?? this.isMuted,
      isVideoOn: isVideoOn ?? this.isVideoOn,
      isSpeaking: isSpeaking ?? this.isSpeaking,
      isScreenSharing: isScreenSharing ?? this.isScreenSharing,
      joinedAtMillis: joinedAtMillis ?? this.joinedAtMillis,
    );
  }
}

class CallSession {
  const CallSession({
    required this.id,
    required this.conversationId,
    required this.mode,
    required this.callerId,
    this.state = CallLifecycleState.idle,
    this.participants = const [],
    this.startedAtMillis,
    this.endedAtMillis,
  });

  final String id;
  final String conversationId;
  final CallMode mode;
  final String callerId;
  final CallLifecycleState state;
  final List<CallParticipant> participants;
  final int? startedAtMillis;
  final int? endedAtMillis;

  bool get isGroup => mode.isGroup;
  bool get isVideo => mode.isVideo;

  /// Attempt a lifecycle transition, returning the new session or `this`
  /// unchanged if the transition is illegal.
  CallSession transition(CallLifecycleState next) {
    if (!state.canTransitionTo(next)) return this;
    return copyWith(state: next);
  }

  CallSession copyWith({
    CallLifecycleState? state,
    List<CallParticipant>? participants,
    int? startedAtMillis,
    int? endedAtMillis,
  }) {
    return CallSession(
      id: id,
      conversationId: conversationId,
      mode: mode,
      callerId: callerId,
      state: state ?? this.state,
      participants: participants ?? this.participants,
      startedAtMillis: startedAtMillis ?? this.startedAtMillis,
      endedAtMillis: endedAtMillis ?? this.endedAtMillis,
    );
  }
}
