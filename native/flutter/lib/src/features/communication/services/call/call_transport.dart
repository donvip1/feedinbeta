import '../../domain/call_session.dart';
import '../../domain/result.dart';

/// Media-plane connection states reported by a [CallTransport].
enum CallTransportState {
  idle,
  connecting,
  connected,
  reconnecting,
  disconnected,
  failed,
}

/// Participant roster changes flowing from the media plane (join/leave/track
/// or mute updates), used identically for 1:1 and group modes.
enum CallParticipantEventKind { joined, left, updated }

class CallParticipantEvent {
  const CallParticipantEvent(this.kind, this.participant);
  final CallParticipantEventKind kind;
  final CallParticipant participant;
}

/// The provider-agnostic media plane for calls, spaces, and broadcasts. The
/// LiveKit adapter implements this at integration time; tests use a fake. This
/// is the ONLY seam through which a media SDK enters the call engine — swapping
/// providers (or adding one per mode) never touches the engine.
abstract interface class CallTransport {
  Stream<CallTransportState> get states;
  CallTransportState get state;

  Stream<CallParticipantEvent> get participantEvents;

  /// Join the media room for [session]. Implementations mint their own token
  /// server-side. Completes when joined (or returns the failure).
  Future<Result<void>> connect(CallSession session, {required bool videoEnabled});

  Future<void> setMuted(bool muted);
  Future<void> setVideoEnabled(bool enabled);
  Future<void> setSpeakerOn(bool speakerOn);
  Future<void> flipCamera();
  Future<void> setScreenShareEnabled(bool enabled);

  /// Leave the room and release devices. Idempotent.
  Future<void> disconnect();
}
