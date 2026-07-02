import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';

import 'call_media_engine.dart';
import 'call_models.dart';
import 'data/calls_remote_data_source.dart';

/// A real WebRTC [CallMediaEngine]: captures the mic/camera, negotiates a peer
/// connection, and exchanges SDP + ICE over the `call_signals` table (via
/// [CallsRemoteDataSource]) so a 1:1 call carries live audio/video.
///
/// Signalling model (mirrors the web `LiveKitCallManager` role split, but with
/// raw WebRTC): the CALLER ([CallSession.isOutgoing] == true) is the OFFERER —
/// it builds the peer connection and immediately creates/sends the offer. The
/// CALLEE waits for that `offer` signal, answers it, and sends the `answer`
/// back. This clean caller=offerer / callee=answerer split means there is never
/// a glare (two simultaneous offers), so no perfect-negotiation dance is needed
/// for 1:1.
///
/// # NAT traversal (FLAGGED — STUN only is not enough for cross-network calls)
///
/// The default [iceServers] are Google's public STUN servers. STUN lets peers
/// discover their public reflexive address, which is enough for many
/// same-network / cone-NAT cases, but it FAILS behind symmetric NAT (common on
/// mobile carriers and corporate networks). Reliable cross-network calling
/// requires a TURN relay. A TURN server can be injected via the [iceServers]
/// constructor argument, e.g.:
/// ```dart
/// WebRtcCallMediaEngine(iceServers: [
///   {'urls': 'stun:stun.l.google.com:19302'},
///   {
///     'urls': 'turn:turn.example.com:3478',
///     'username': shortLivedUser,   // minted server-side
///     'credential': shortLivedPass, // minted server-side
///   },
/// ]);
/// ```
/// TURN credentials MUST be server-owned and short-lived (minted by an edge
/// function per call) — never hardcode long-lived TURN credentials in the app.
class WebRtcCallMediaEngine implements CallMediaEngine {
  WebRtcCallMediaEngine({
    CallsRemoteDataSource? dataSource,
    List<Map<String, Object?>>? iceServers,
  })  : _dataSource = dataSource ?? CallsRemoteDataSource.autoDetect(),
        _iceServers = iceServers ?? _defaultIceServers;

  /// Public STUN-only default. See the class note: cross-network calls need a
  /// caller-injected TURN relay with server-minted, short-lived credentials.
  static const List<Map<String, Object?>> _defaultIceServers = [
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'stun:stun1.l.google.com:19302'},
  ];

  final CallsRemoteDataSource _dataSource;
  final List<Map<String, Object?>> _iceServers;

  final _stateController =
      StreamController<CallMediaConnectionState>.broadcast();
  final _renderController = StreamController<void>.broadcast();

  CallMediaConnectionState _state = CallMediaConnectionState.idle;
  bool _disposed = false;

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  MediaStream? _screenStream;
  RTCVideoRenderer? _localRenderer;
  RTCVideoRenderer? _remoteRenderer;
  StreamSubscription<CallSignal>? _signalSub;

  // ICE candidates that arrive before the remote description is applied MUST be
  // buffered — otherwise addCandidate throws. They're drained right after the
  // remote SDP is set.
  final List<RTCIceCandidate> _pendingCandidates = [];
  bool _remoteDescriptionSet = false;

  bool _usingFrontCamera = true;
  bool _videoEnabled = false;
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
  // Connect / negotiate
  // ---------------------------------------------------------------------------

  @override
  Future<void> connect(
    CallSession session, {
    required bool videoEnabled,
  }) async {
    if (_disposed) return;
    // Reflect the connecting phase immediately (before any async media work),
    // matching the stub's behaviour.
    _emit(CallMediaConnectionState.connecting);

    // A retry (CallController.retryConnection re-invokes connect without a
    // disconnect) must not stack peer connections / streams / subscriptions.
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

      await _ensureRenderers();

      // Capture local media and show the local preview.
      final localStream = await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': wantsVideo
            ? {
                'facingMode': _usingFrontCamera ? 'user' : 'environment',
              }
            : false,
      });
      _localStream = localStream;
      _localRenderer?.srcObject = localStream;

      // Build the peer connection and publish every local track.
      final pc = await createPeerConnection({
        'iceServers': _iceServers,
        'sdpSemantics': 'unified-plan',
      });
      _pc = pc;
      _wirePeerConnection(pc, session);
      for (final track in localStream.getTracks()) {
        await pc.addTrack(track, localStream);
      }

      // Listen for the peer's offer/answer/candidates.
      _signalSub = _dataSource.watchCallSignals(session.id).listen(
            (signal) => unawaited(_handleSignal(signal, session)),
            onError: (Object _) {},
          );

      // Caller offers straight away; callee waits for the incoming offer.
      if (session.isOutgoing) {
        await _createAndSendOffer(session);
      }

      _invalidateRender();
    } catch (_) {
      // Any media/negotiation failure degrades to `failed` (the call UI offers a
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

  Future<void> _ensureRenderers() async {
    if (_localRenderer == null) {
      final renderer = RTCVideoRenderer();
      await renderer.initialize();
      _localRenderer = renderer;
    }
    if (_remoteRenderer == null) {
      final renderer = RTCVideoRenderer();
      await renderer.initialize();
      _remoteRenderer = renderer;
    }
  }

  void _wirePeerConnection(RTCPeerConnection pc, CallSession session) {
    pc.onIceCandidate = (candidate) => _sendCandidate(candidate, session);
    pc.onTrack = (event) {
      try {
        if (event.streams.isNotEmpty) {
          _remoteRenderer?.srcObject = event.streams.first;
          _invalidateRender();
        }
      } catch (_) {
        // A render attach failure just leaves the placeholder in place.
      }
    };
    pc.onConnectionState = _onPeerConnectionState;
    pc.onIceConnectionState = _onIceConnectionState;
  }

  void _sendCandidate(RTCIceCandidate candidate, CallSession session) {
    if (candidate.candidate == null) return;
    unawaited(
      _dataSource.sendSignal(
        callId: session.id,
        signalType: 'ice-candidate',
        payload: {
          'candidate': candidate.candidate,
          'sdpMid': candidate.sdpMid,
          'sdpMLineIndex': candidate.sdpMLineIndex,
        },
        recipientId: session.peer.userId,
      ),
    );
  }

  void _onPeerConnectionState(RTCPeerConnectionState state) {
    switch (state) {
      case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
        _emit(CallMediaConnectionState.connected);
        break;
      case RTCPeerConnectionState.RTCPeerConnectionStateConnecting:
      case RTCPeerConnectionState.RTCPeerConnectionStateNew:
        _emit(CallMediaConnectionState.connecting);
        break;
      case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
        _emit(CallMediaConnectionState.failed);
        break;
      case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
        // A brief blip — surface "reconnecting" so the call clock keeps running.
        _emit(CallMediaConnectionState.reconnecting);
        break;
      case RTCPeerConnectionState.RTCPeerConnectionStateClosed:
        _emit(CallMediaConnectionState.disconnected);
        break;
    }
  }

  void _onIceConnectionState(RTCIceConnectionState state) {
    switch (state) {
      case RTCIceConnectionState.RTCIceConnectionStateConnected:
      case RTCIceConnectionState.RTCIceConnectionStateCompleted:
        _emit(CallMediaConnectionState.connected);
        break;
      case RTCIceConnectionState.RTCIceConnectionStateNew:
      case RTCIceConnectionState.RTCIceConnectionStateChecking:
        _emit(CallMediaConnectionState.connecting);
        break;
      case RTCIceConnectionState.RTCIceConnectionStateFailed:
        _emit(CallMediaConnectionState.failed);
        break;
      case RTCIceConnectionState.RTCIceConnectionStateDisconnected:
        _emit(CallMediaConnectionState.reconnecting);
        break;
      case RTCIceConnectionState.RTCIceConnectionStateClosed:
        _emit(CallMediaConnectionState.disconnected);
        break;
      case RTCIceConnectionState.RTCIceConnectionStateCount:
        break;
    }
  }

  Future<void> _createAndSendOffer(CallSession session) async {
    final pc = _pc;
    if (pc == null) return;
    final offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await _dataSource.sendSignal(
      callId: session.id,
      signalType: 'offer',
      payload: {'sdp': offer.sdp, 'type': offer.type},
      recipientId: session.peer.userId,
    );
  }

  // ---------------------------------------------------------------------------
  // Inbound signalling
  // ---------------------------------------------------------------------------

  Future<void> _handleSignal(CallSignal signal, CallSession session) async {
    try {
      switch (signal.signalType) {
        case 'offer':
          // Only the callee acts on an offer.
          if (session.isOutgoing) return;
          await _handleRemoteOffer(signal, session);
          break;
        case 'answer':
          // Only the caller acts on an answer.
          if (!session.isOutgoing) return;
          await _handleRemoteAnswer(signal);
          break;
        case 'ice-candidate':
          await _handleRemoteCandidate(signal);
          break;
      }
    } catch (_) {
      // A single malformed/late signal must never tear down the call.
    }
  }

  Future<void> _handleRemoteOffer(
    CallSignal signal,
    CallSession session,
  ) async {
    final pc = _pc;
    if (pc == null) return;
    final sdp = signal.payload['sdp']?.toString();
    if (sdp == null) return;
    final type = signal.payload['type']?.toString() ?? 'offer';
    await pc.setRemoteDescription(RTCSessionDescription(sdp, type));
    _remoteDescriptionSet = true;
    await _drainPendingCandidates();

    final answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await _dataSource.sendSignal(
      callId: session.id,
      signalType: 'answer',
      payload: {'sdp': answer.sdp, 'type': answer.type},
      recipientId: session.peer.userId,
    );
  }

  Future<void> _handleRemoteAnswer(CallSignal signal) async {
    final pc = _pc;
    if (pc == null) return;
    final sdp = signal.payload['sdp']?.toString();
    if (sdp == null) return;
    final type = signal.payload['type']?.toString() ?? 'answer';
    await pc.setRemoteDescription(RTCSessionDescription(sdp, type));
    _remoteDescriptionSet = true;
    await _drainPendingCandidates();
  }

  Future<void> _handleRemoteCandidate(CallSignal signal) async {
    final pc = _pc;
    if (pc == null) return;
    final candidate = RTCIceCandidate(
      signal.payload['candidate']?.toString(),
      signal.payload['sdpMid']?.toString(),
      _asInt(signal.payload['sdpMLineIndex']),
    );
    // Candidates routinely arrive before the remote SDP — buffer until then.
    if (_remoteDescriptionSet) {
      await pc.addCandidate(candidate);
    } else {
      _pendingCandidates.add(candidate);
    }
  }

  Future<void> _drainPendingCandidates() async {
    final pc = _pc;
    if (pc == null || _pendingCandidates.isEmpty) return;
    final pending = List<RTCIceCandidate>.from(_pendingCandidates);
    _pendingCandidates.clear();
    for (final candidate in pending) {
      try {
        await pc.addCandidate(candidate);
      } catch (_) {
        // Drop a single bad candidate; the others may still connect.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Local control toggles
  // ---------------------------------------------------------------------------

  @override
  Future<void> setMuted(bool muted) async {
    try {
      for (final track in _localStream?.getAudioTracks() ?? const []) {
        track.enabled = !muted;
      }
    } catch (_) {
      // Muting is best-effort; never crash a live call over it.
    }
  }

  @override
  Future<void> setVideoEnabled(bool enabled) async {
    try {
      _videoEnabled = enabled;
      for (final track in _localStream?.getVideoTracks() ?? const []) {
        track.enabled = enabled;
      }
    } catch (_) {
      // Ignore — the render invalidation below still refreshes the UI.
    }
    _invalidateRender();
  }

  @override
  Future<void> setSpeakerOn(bool speakerOn) async {
    try {
      await Helper.setSpeakerphoneOn(speakerOn);
    } catch (_) {
      // Audio routing is platform-dependent; a failure just keeps the default.
    }
  }

  @override
  Future<void> flipCamera() async {
    try {
      final track = _localVideoTrack;
      if (track == null) return; // no-op for audio-only / camera-off
      await Helper.switchCamera(track);
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
      if (enabled) {
        await _startScreenShare();
      } else {
        await _stopScreenShare();
      }
    } catch (_) {
      // Leave [_screenSharing] unchanged on failure so the flag reflects what's
      // actually being published (it's only flipped on the success paths below).
    }
  }

  Future<void> _startScreenShare() async {
    final pc = _pc;
    if (pc == null) return;
    // NOTE: reliable Android screen capture needs a foreground service
    // (MediaProjection) — FLAGGED as a follow-up. Basic getDisplayMedia is fine
    // for now; iOS uses ReplayKit, web uses getDisplayMedia directly.
    final screenStream = await navigator.mediaDevices.getDisplayMedia({
      'video': true,
      'audio': false,
    });
    final screenTracks = screenStream.getVideoTracks();
    if (screenTracks.isEmpty) {
      await screenStream.dispose();
      return;
    }
    final screenTrack = screenTracks.first;

    final sender = await _videoSender();
    if (sender == null) {
      // Audio-only call: no video transceiver to publish the screen on.
      await screenTrack.stop();
      await screenStream.dispose();
      return;
    }

    // Swap the outbound video from camera -> screen, release the camera, and
    // show the shared screen in the local preview.
    final cameraTrack = _localVideoTrack;
    await sender.replaceTrack(screenTrack);
    if (cameraTrack != null) {
      await _localStream?.removeTrack(cameraTrack);
      await cameraTrack.stop();
    }
    _screenStream = screenStream;
    _localRenderer?.srcObject = screenStream;
    _screenSharing = true;
    _invalidateRender();
  }

  Future<void> _stopScreenShare() async {
    final pc = _pc;
    if (pc == null) {
      _screenSharing = false;
      return;
    }
    final sender = await _videoSender();
    // Re-acquire a fresh camera track (the previous one was stopped on start).
    final cameraStream = _videoEnabled
        ? await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {
              'facingMode': _usingFrontCamera ? 'user' : 'environment',
            },
          })
        : null;
    final cameraTrack =
        cameraStream != null && cameraStream.getVideoTracks().isNotEmpty
            ? cameraStream.getVideoTracks().first
            : null;

    if (sender != null) {
      await sender.replaceTrack(cameraTrack);
    }
    if (cameraTrack != null) {
      await _localStream?.addTrack(cameraTrack);
    }
    _localRenderer?.srcObject = _localStream;

    // Tear down the screen capture.
    final screenStream = _screenStream;
    _screenStream = null;
    if (screenStream != null) {
      for (final track in screenStream.getVideoTracks()) {
        try {
          await track.stop();
        } catch (_) {}
      }
      await screenStream.dispose();
    }

    _screenSharing = false;
    _invalidateRender();
  }

  Future<RTCRtpSender?> _videoSender() async {
    final pc = _pc;
    if (pc == null) return null;
    final senders = await pc.getSenders();
    for (final sender in senders) {
      if (sender.track?.kind == 'video') return sender;
    }
    return null;
  }

  MediaStreamTrack? get _localVideoTrack {
    final tracks = _localStream?.getVideoTracks();
    if (tracks == null || tracks.isEmpty) return null;
    return tracks.first;
  }

  // ---------------------------------------------------------------------------
  // Render surfaces
  // ---------------------------------------------------------------------------

  @override
  Widget? localVideoView() {
    try {
      final renderer = _localRenderer;
      if (renderer == null || !_videoEnabled) return null;
      // Only render when there's an actual local video track flowing.
      final hasVideo = _localStream?.getVideoTracks().isNotEmpty ?? false;
      if (!hasVideo && !_screenSharing) return null;
      return RTCVideoView(
        renderer,
        mirror: _usingFrontCamera && !_screenSharing,
        objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
      );
    } catch (_) {
      return null; // fall back to the UI placeholder
    }
  }

  @override
  Widget? remoteVideoView() {
    try {
      final renderer = _remoteRenderer;
      if (renderer == null || renderer.srcObject == null) return null;
      return RTCVideoView(
        renderer,
        objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
      );
    } catch (_) {
      return null; // fall back to the UI placeholder
    }
  }

  // ---------------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------------

  @override
  Future<void> disconnect() async {
    if (_disposed) return;
    await _teardownSession();
    await _disposeRenderers();
    _emit(CallMediaConnectionState.disconnected);
  }

  /// Tear down the live media session (peer connection, local capture, signal
  /// subscription) WITHOUT disposing the renderers or stream controllers, so a
  /// [connect] retry can rebuild cleanly. Safe to call when nothing is active.
  Future<void> _teardownSession() async {
    await _signalSub?.cancel();
    _signalSub = null;

    final pc = _pc;
    _pc = null;
    if (pc != null) {
      // Detach handlers first so closing this (possibly stale, on a retry) peer
      // connection can't emit a bogus disconnected/failed state onto the stream.
      pc.onIceCandidate = null;
      pc.onTrack = null;
      pc.onConnectionState = null;
      pc.onIceConnectionState = null;
      try {
        await pc.close();
      } catch (_) {}
      try {
        await pc.dispose();
      } catch (_) {}
    }

    await _stopStream(_localStream);
    _localStream = null;
    await _stopStream(_screenStream);
    _screenStream = null;

    try {
      _localRenderer?.srcObject = null;
    } catch (_) {}
    try {
      _remoteRenderer?.srcObject = null;
    } catch (_) {}

    _pendingCandidates.clear();
    _remoteDescriptionSet = false;
    _screenSharing = false;
  }

  Future<void> _stopStream(MediaStream? stream) async {
    if (stream == null) return;
    for (final track in stream.getTracks()) {
      try {
        await track.stop();
      } catch (_) {}
    }
    try {
      await stream.dispose();
    } catch (_) {}
  }

  Future<void> _disposeRenderers() async {
    final local = _localRenderer;
    _localRenderer = null;
    if (local != null) {
      try {
        await local.dispose();
      } catch (_) {}
    }
    final remote = _remoteRenderer;
    _remoteRenderer = null;
    if (remote != null) {
      try {
        await remote.dispose();
      } catch (_) {}
    }
  }

  @override
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await _teardownSession();
    await _disposeRenderers();
    await _stateController.close();
    await _renderController.close();
  }

  static int? _asInt(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }
}
