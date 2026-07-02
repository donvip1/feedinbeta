import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'call_media_engine.dart';
import 'call_models.dart';

/// A real LiveKit [CallMediaEngine]: joins the SFU room for a 1:1 call, captures
/// the mic/camera, and subscribes to the peer's tracks so live audio/video
/// flows. This is the native counterpart of the web app's `LiveKitCallManager`
/// (`src/lib/livekit-call-manager.ts`) and brings the two clients to media
/// parity on the SAME provider.
///
/// # Why LiveKit over raw WebRTC (see [webrtc_call_media_engine.dart])
///
/// The raw-WebRTC engine is STUN-only and cannot traverse symmetric NAT (common
/// on mobile carriers / corporate networks), so cross-network calls silently
/// fail to connect. LiveKit routes media through a managed SFU with its own TURN
/// relay, which fixes traversal without shipping any TURN credentials in the
/// app. This engine is therefore the primary transport; the WebRTC engine is
/// kept as a fallback.
///
/// # Token model (server-owned; the app holds NO LiveKit secret)
///
/// The SFU URL + a short-lived join token are minted per call by the Supabase
/// edge function `livekit-token`. Both participants join the room
/// `call-<session.id>`; the server forces each participant's identity, so the
/// `participantName` we pass is display-only. If the function isn't deployed (or
/// otherwise fails) [connect] degrades to [CallMediaConnectionState.failed] and
/// the call UI shows a "connection failed" + retry — it never crashes.
///
/// # Screen sharing (FLAGGED — Android needs a foreground service)
///
/// [setScreenShareEnabled] publishes a screen-capture track via
/// [LocalParticipant.setScreenShareEnabled]. Reliable Android capture requires a
/// foreground service (MediaProjection) started before capture; the basic path
/// here is fine for now and iOS uses ReplayKit (broadcast extension).
class LiveKitCallMediaEngine implements CallMediaEngine {
  LiveKitCallMediaEngine();

  final _stateController =
      StreamController<CallMediaConnectionState>.broadcast();
  final _renderController = StreamController<void>.broadcast();

  CallMediaConnectionState _state = CallMediaConnectionState.idle;
  bool _disposed = false;

  Room? _room;
  EventsListener<RoomEvent>? _listener;

  /// The remote peer's subscribed video track (camera or screen share), or null
  /// when the peer isn't sending video. Stored from TrackSubscribed events so
  /// [remoteVideoView] can render it synchronously.
  VideoTrack? _remoteVideoTrack;

  bool _videoEnabled = false;
  bool _usingFrontCamera = true;
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

  void _invalidateRender() {
    if (_disposed) return;
    _renderController.add(null);
  }

  // ---------------------------------------------------------------------------
  // Connect / join
  // ---------------------------------------------------------------------------

  @override
  Future<void> connect(
    CallSession session, {
    required bool videoEnabled,
  }) async {
    if (_disposed) return;
    // Reflect the connecting phase immediately (before any async work), matching
    // the stub's behaviour so the UI shows the connecting state right away.
    _emit(CallMediaConnectionState.connecting);

    // A retry (CallController.retryConnection re-invokes connect without a
    // disconnect) must not stack rooms / listeners — tear down any prior one.
    await _teardownSession();

    try {
      final wantsVideo = session.type.isVideo && videoEnabled;
      _videoEnabled = wantsVideo;

      // Permissions: microphone always, camera only for video calls.
      final granted = await _ensurePermissions(video: session.type.isVideo);
      if (!granted) {
        _emit(CallMediaConnectionState.failed);
        return;
      }

      // Mint the SFU URL + join token server-side. A missing/failed function
      // (e.g. not deployed yet) degrades to `failed` rather than crashing.
      final credentials = await _fetchToken(session);
      if (credentials == null) {
        _emit(CallMediaConnectionState.failed);
        return;
      }

      // adaptiveStream lets LiveKit pick a resolution for the visible video
      // surface; dynacast pauses layers nobody is consuming — both trim mobile
      // CPU/bandwidth for a 1:1 call.
      final room = Room(
        roomOptions: const RoomOptions(
          adaptiveStream: true,
          dynacast: true,
        ),
      );
      _room = room;

      // Register handlers on a dedicated listener BEFORE connecting so no early
      // join/track event is missed.
      final listener = room.createListener();
      _listener = listener;
      _wireRoomListener(listener);

      await room.connect(credentials.url, credentials.token);

      // Publish local media once joined. The mic is always on; the camera only
      // for a video call whose camera isn't off.
      await room.localParticipant?.setMicrophoneEnabled(true);
      if (wantsVideo) {
        await room.localParticipant?.setCameraEnabled(true);
      }

      // room.connect() only returns once the room is connected (it throws
      // otherwise), so surface `connected` here to start the controller's call
      // timer. The RoomConnectedEvent handler emits it too; _emit is idempotent.
      _emit(CallMediaConnectionState.connected);
      _invalidateRender();
    } catch (_) {
      // Any media/token/join failure degrades to `failed` (the call UI offers a
      // retry) rather than crashing the app.
      _emit(CallMediaConnectionState.failed);
    }
  }

  Future<bool> _ensurePermissions({required bool video}) async {
    try {
      final requested = <Permission>[Permission.microphone];
      if (video) requested.add(Permission.camera);
      final statuses = await requested.request();
      return statuses.values.every((status) => status.isGranted);
    } catch (_) {
      return false;
    }
  }

  /// Calls the `livekit-token` edge function and returns the URL + token, or
  /// null on any failure (non-200, null body, or a missing token/url field).
  Future<_LiveKitCredentials?> _fetchToken(CallSession session) async {
    try {
      final res = await Supabase.instance.client.functions.invoke(
        'livekit-token',
        body: {
          'roomName': 'call-${session.id}', // BOTH participants join this room
          'participantName': session.peer.displayName, // display only
          'isHost': true,
        },
      );
      if (res.status != 200) return null;
      final data = res.data;
      if (data is! Map) return null;
      final token = data['token']?.toString();
      final url = data['url']?.toString();
      if (token == null || token.isEmpty || url == null || url.isEmpty) {
        return null;
      }
      return _LiveKitCredentials(url: url, token: token);
    } catch (_) {
      return null;
    }
  }

  void _wireRoomListener(EventsListener<RoomEvent> listener) {
    listener
      ..on<RoomConnectedEvent>((_) => _emit(CallMediaConnectionState.connected))
      ..on<RoomReconnectingEvent>(
          (_) => _emit(CallMediaConnectionState.reconnecting))
      ..on<RoomReconnectedEvent>(
          (_) => _emit(CallMediaConnectionState.connected))
      ..on<RoomDisconnectedEvent>(
          (_) => _emit(CallMediaConnectionState.disconnected))
      ..on<ParticipantConnectedEvent>((_) => _invalidateRender())
      ..on<ParticipantDisconnectedEvent>((_) => _invalidateRender())
      ..on<TrackSubscribedEvent>((event) {
        // Store the peer's video so remoteVideoView can render it.
        final track = event.track;
        if (track is VideoTrack) {
          _remoteVideoTrack = track;
          _invalidateRender();
        }
      })
      ..on<TrackUnsubscribedEvent>((event) {
        if (identical(event.track, _remoteVideoTrack)) {
          _remoteVideoTrack = null;
          _invalidateRender();
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Local control toggles
  // ---------------------------------------------------------------------------

  @override
  Future<void> setMuted(bool muted) async {
    try {
      await _room?.localParticipant?.setMicrophoneEnabled(!muted);
    } catch (_) {
      // Muting is best-effort; never crash a live call over it.
    }
  }

  @override
  Future<void> setVideoEnabled(bool enabled) async {
    _videoEnabled = enabled;
    try {
      await _room?.localParticipant?.setCameraEnabled(enabled);
    } catch (_) {
      // Ignore — the render invalidation below still refreshes the UI.
    }
    _invalidateRender();
  }

  @override
  Future<void> setSpeakerOn(bool speakerOn) async {
    try {
      await Hardware.instance.setSpeakerphoneOn(speakerOn);
    } catch (_) {
      // Audio routing is platform-dependent (mobile only); a failure just keeps
      // the current output.
    }
  }

  @override
  Future<void> flipCamera() async {
    try {
      final track = _localCameraTrack();
      if (track == null) return; // no-op for audio-only / camera-off
      // Restart the camera track on the opposite position.
      final next =
          _usingFrontCamera ? CameraPosition.back : CameraPosition.front;
      await track.setCameraPosition(next);
      _usingFrontCamera = !_usingFrontCamera;
      _invalidateRender();
    } catch (_) {
      // Camera switch can fail on a single-camera device; leave state as-is.
    }
  }

  // ---------------------------------------------------------------------------
  // Screen sharing
  // ---------------------------------------------------------------------------

  @override
  bool get isScreenSharing => _screenSharing;

  @override
  Future<void> setScreenShareEnabled(bool enabled) async {
    if (_screenSharing == enabled) return;
    try {
      // NOTE: reliable Android screen capture needs a foreground service
      // (MediaProjection) started before capture — FLAGGED as a follow-up. iOS
      // uses ReplayKit; the basic path is fine for now.
      final pub = await _room?.localParticipant?.setScreenShareEnabled(enabled);
      // Track the flag from the actual result: on iOS enabling may return null
      // while waiting for broadcast activation, so only mark sharing on when a
      // publication came back; disabling always clears the flag.
      _screenSharing = enabled && pub != null;
      _invalidateRender();
    } catch (_) {
      // Leave [_screenSharing] unchanged on failure so the flag reflects what's
      // actually being published.
    }
  }

  // ---------------------------------------------------------------------------
  // Render surfaces
  // ---------------------------------------------------------------------------

  @override
  Widget? localVideoView() {
    try {
      if (!_videoEnabled && !_screenSharing) return null;
      final track = _localVideoTrack();
      if (track == null) return null;
      return VideoTrackRenderer(track, fit: VideoViewFit.cover);
    } catch (_) {
      return null; // fall back to the UI placeholder
    }
  }

  @override
  Widget? remoteVideoView() {
    try {
      final track = _remoteVideoTrack;
      if (track == null) return null;
      return VideoTrackRenderer(track, fit: VideoViewFit.cover);
    } catch (_) {
      return null; // fall back to the UI placeholder
    }
  }

  /// The local participant's first published video track (camera or, while
  /// sharing, screen), or null when none is published.
  VideoTrack? _localVideoTrack() {
    final pubs = _room?.localParticipant?.videoTrackPublications;
    if (pubs == null || pubs.isEmpty) return null;
    return pubs.first.track;
  }

  /// The local camera track specifically, for camera-position switching.
  LocalVideoTrack? _localCameraTrack() {
    final track = _room?.localParticipant
        ?.getTrackPublicationBySource(TrackSource.camera)
        ?.track;
    return track is LocalVideoTrack ? track : null;
  }

  // ---------------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------------

  @override
  Future<void> disconnect() async {
    if (_disposed) return;
    await _teardownSession();
    _emit(CallMediaConnectionState.disconnected);
  }

  /// Tear down the live room + listener and drop track references WITHOUT
  /// closing the stream controllers, so a [connect] retry can rebuild cleanly.
  /// Safe to call when nothing is active. Disposes the listener first so a
  /// resulting RoomDisconnectedEvent can't emit onto the stream.
  Future<void> _teardownSession() async {
    final listener = _listener;
    _listener = null;
    if (listener != null) {
      try {
        await listener.dispose();
      } catch (_) {}
    }

    final room = _room;
    _room = null;
    if (room != null) {
      try {
        await room.disconnect();
      } catch (_) {}
      try {
        await room.dispose();
      } catch (_) {}
    }

    _remoteVideoTrack = null;
    _screenSharing = false;
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await _teardownSession();
    await _stateController.close();
    await _renderController.close();
  }
}

/// The SFU URL + short-lived join token minted by the `livekit-token` edge
/// function.
class _LiveKitCredentials {
  const _LiveKitCredentials({required this.url, required this.token});

  final String url;
  final String token;
}
