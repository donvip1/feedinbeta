import 'dart:async';

import 'package:flutter/widgets.dart';

import 'call_models.dart';

/// The clean seam where a real audio/video media transport attaches.
///
/// This module ships the FULL call UX + signalling data layer, but real media
/// (microphone capture, camera capture, peer connection, audio routing) needs a
/// WebRTC / LiveKit / Agora client SDK plus SERVER-OWNED provider config (SFU
/// URL + short-lived token minted by an edge function). Those are intentionally
/// NOT added here — no new pub dependency, no provider keys client-side.
///
/// The web app fulfils this role with `LiveKitCallManager`
/// (`src/lib/livekit-call-manager.ts`), driven by `CallContext`. To bring the
/// native app to media parity, implement [CallMediaEngine] with a WebRTC/LiveKit
/// client and swap [StubCallMediaEngine] for it via
/// [CallController]'s `mediaEngine` constructor argument. Nothing else in this
/// module needs to change.
///
/// Contract:
///  * [connect] is called once the call reaches the connecting phase (caller
///    after the callee answers; callee right after accepting). It should join
///    the media room / establish the peer connection and, when media is
///    flowing, transition [connectionState] to [CallMediaConnectionState.connected].
///  * Local control toggles ([setMuted], [setVideoEnabled], [setSpeakerOn],
///    [flipCamera], [setScreenShareEnabled]) mutate the live media session.
///  * [localVideoView] / [remoteVideoView] return the platform video render
///    surfaces; the stub returns `null` so the UI shows placeholders.
///  * [disconnect] tears everything down; safe to call multiple times.
///
/// # Screen sharing (FLAGGED DEPENDENCY — no pixels captured here)
///
/// [setScreenShareEnabled] flips the engine's *intent* to share the local
/// screen and is wired through [CallController] + the controls bar so the whole
/// UX (toggle, active tint, "you're sharing your screen" surface) is exercisable
/// end-to-end. The stub does NOT capture any pixels: real screen capture needs a
/// WebRTC/LiveKit client SDK plus platform screen-capture permissions
/// (`ReplayKit` on iOS, `MediaProjection` on Android, `getDisplayMedia` on web)
/// — the SAME dependency the media transport itself needs, which is
/// intentionally NOT added (no new pub dependency). A real engine publishes a
/// screen-capture track here; the stub only records the flag and invalidates its
/// render so the UI can show the sharing surface.
abstract class CallMediaEngine {
  /// Emits whenever the media transport connection state changes.
  Stream<CallMediaConnectionState> get connectionStates;

  /// Current media connection state (synchronous snapshot).
  CallMediaConnectionState get connectionState;

  /// Emits whenever a rendered video surface becomes available/unavailable, so
  /// the in-call screen can rebuild. Fires after [connect]/[flipCamera]/etc.
  Stream<void> get renderInvalidations;

  /// Join/establish the media session for [session]. [videoEnabled] reflects
  /// whether the local camera should start on (video call, camera not off).
  Future<void> connect(CallSession session, {required bool videoEnabled});

  /// Mute/unmute the local microphone.
  Future<void> setMuted(bool muted);

  /// Enable/disable the local camera track (video calls only).
  Future<void> setVideoEnabled(bool enabled);

  /// Route audio to the loudspeaker (true) or earpiece (false).
  Future<void> setSpeakerOn(bool speakerOn);

  /// Switch between front/back camera.
  Future<void> flipCamera();

  /// Whether the local screen is currently being shared (synchronous snapshot).
  bool get isScreenSharing;

  /// Start ([enabled] true) or stop ([enabled] false) sharing the local screen.
  ///
  /// A real engine acquires a screen-capture track (via the platform capture
  /// permission) and publishes/unpublishes it; the stub only records the intent
  /// and invalidates its render so the UI can show the sharing surface. See the
  /// class-level "Screen sharing" note for the flagged dependency.
  Future<void> setScreenShareEnabled(bool enabled);

  /// The local camera preview surface, or `null` when unavailable (audio call,
  /// camera off, or stub engine).
  Widget? localVideoView();

  /// The remote peer's video surface, or `null` when unavailable.
  Widget? remoteVideoView();

  /// Tear down the media session and release devices. Idempotent.
  Future<void> disconnect();

  /// Release all resources; the engine must not be reused afterwards.
  Future<void> dispose();
}

/// Media transport connection lifecycle, mirroring the web
/// `CallConnectionStatus` used by `ConnectionStatus.tsx`.
enum CallMediaConnectionState {
  idle,
  connecting,
  connected,
  reconnecting,
  disconnected,
  failed,
}

/// A no-op media engine used until a real WebRTC/LiveKit client is wired in.
///
/// It drives the call state machine to `connected` (after a short simulated
/// negotiation) so the entire call UX — controls, timers, video placeholders,
/// hang-up — is fully exercisable end-to-end without any media dependency. It
/// captures the mute/video/speaker/camera flags so the UI reflects them, but
/// never touches the microphone, camera, or audio routing. Video views return
/// `null`, so the in-call screen renders labelled placeholders.
class StubCallMediaEngine implements CallMediaEngine {
  StubCallMediaEngine({this.simulateConnect = true});

  /// When true, [connect] auto-advances to [CallMediaConnectionState.connected]
  /// after a short delay so the UI shows a live call. When false the engine
  /// stays in [CallMediaConnectionState.connecting] (useful for previewing the
  /// connecting UI).
  final bool simulateConnect;

  final _stateController =
      StreamController<CallMediaConnectionState>.broadcast();
  final _renderController = StreamController<void>.broadcast();

  CallMediaConnectionState _state = CallMediaConnectionState.idle;
  Timer? _connectTimer;
  bool _disposed = false;

  // Captured local control flags — surfaced only for debugging/parity; the
  // stub does not act on hardware.
  bool muted = false;
  bool videoEnabled = false;
  bool speakerOn = true;
  bool usingFrontCamera = true;
  bool _screenSharing = false;

  @override
  Stream<CallMediaConnectionState> get connectionStates =>
      _stateController.stream;

  @override
  CallMediaConnectionState get connectionState => _state;

  @override
  Stream<void> get renderInvalidations => _renderController.stream;

  void _emit(CallMediaConnectionState next) {
    if (_disposed || next == _state) return;
    _state = next;
    _stateController.add(next);
  }

  @override
  Future<void> connect(
    CallSession session, {
    required bool videoEnabled,
  }) async {
    this.videoEnabled = videoEnabled;
    _emit(CallMediaConnectionState.connecting);
    _connectTimer?.cancel();
    if (!simulateConnect) return;
    // Simulate SDP/ICE negotiation latency so the connecting UI is visible.
    _connectTimer = Timer(const Duration(milliseconds: 900), () {
      _emit(CallMediaConnectionState.connected);
    });
  }

  @override
  Future<void> setMuted(bool muted) async {
    this.muted = muted;
  }

  @override
  Future<void> setVideoEnabled(bool enabled) async {
    videoEnabled = enabled;
    _renderController.add(null);
  }

  @override
  Future<void> setSpeakerOn(bool speakerOn) async {
    this.speakerOn = speakerOn;
  }

  @override
  Future<void> flipCamera() async {
    usingFrontCamera = !usingFrontCamera;
    _renderController.add(null);
  }

  @override
  bool get isScreenSharing => _screenSharing;

  @override
  Future<void> setScreenShareEnabled(bool enabled) async {
    if (_screenSharing == enabled) return;
    _screenSharing = enabled;
    // No pixels captured in the stub; just invalidate the render so the UI can
    // swap in / out the "you're sharing your screen" surface.
    _renderController.add(null);
  }

  // No real surfaces in the stub — the UI shows placeholders.
  @override
  Widget? localVideoView() => null;

  @override
  Widget? remoteVideoView() => null;

  @override
  Future<void> disconnect() async {
    _connectTimer?.cancel();
    _connectTimer = null;
    _screenSharing = false;
    _emit(CallMediaConnectionState.disconnected);
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    _connectTimer?.cancel();
    await _stateController.close();
    await _renderController.close();
  }
}
