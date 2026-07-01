import 'dart:async';

import 'package:flutter/foundation.dart';

import 'call_media_engine.dart';
import 'call_models.dart';
import 'data/call_realtime_service.dart';
import 'data/calls_remote_data_source.dart';

/// The single public entry point / view-model for the calling feature.
///
/// A [ChangeNotifier] that owns the full 1:1 call state machine and coordinates
/// three collaborators:
///   * [CallsRemoteDataSource]  — inserts/updates `call_logs` (signalling state)
///   * [CallRealtimeService]    — pushes incoming-call + status-change events
///   * [CallMediaEngine]        — the media transport seam (stub by default)
///
/// Chat integration (the one public API the Chat screen needs):
/// ```dart
/// final controller = CallController();        // once, high in the tree
/// await controller.init();                    // starts the realtime listener
/// // ...on the call button in the chat header:
/// await controller.startCall(
///   callee: CallParticipant(userId: otherUserId, displayName: name, ...),
///   type: CallType.video,
/// );
/// // then push CallScreen(controller: controller) (see call_screen.dart).
/// ```
///
/// Incoming calls surface app-wide by listening to [incomingCall]; the app
/// shell shows the incoming UI (see the report for the wiring recommendation).
class CallController extends ChangeNotifier {
  CallController({
    CallsRemoteDataSource? dataSource,
    CallRealtimeService? realtime,
    CallMediaEngine? mediaEngine,
  })  : _data = dataSource ?? CallsRemoteDataSource.autoDetect(),
        _realtime = realtime ?? CallRealtimeService.autoDetect(),
        _media = mediaEngine ?? StubCallMediaEngine();

  final CallsRemoteDataSource _data;
  final CallRealtimeService _realtime;
  final CallMediaEngine _media;

  StreamSubscription<CallRealtimeEvent>? _realtimeSub;
  StreamSubscription<CallMediaConnectionState>? _mediaStateSub;
  StreamSubscription<void>? _renderSub;
  Timer? _durationTimer;
  Timer? _ringTimeoutTimer;
  Timer? _statusPollTimer;
  Timer? _incomingPollTimer;
  Timer? _incomingTimeoutTimer;

  /// How long an outgoing call rings before it is auto-marked missed, and how
  /// long an unanswered incoming banner lingers before it is auto-dismissed.
  static const Duration _ringTimeout = Duration(seconds: 45);

  bool _initialized = false;
  bool _disposed = false;

  // --- Public state ----------------------------------------------------------

  CallPhase _phase = CallPhase.idle;
  CallPhase get phase => _phase;

  CallSession? _session;
  CallSession? get session => _session;

  /// The active call's peer (person on screen), or null when idle.
  CallParticipant? get peer => _session?.peer;

  CallType get callType => _session?.type ?? CallType.voice;

  bool _isMuted = false;
  bool get isMuted => _isMuted;

  /// Whether the local camera is OFF (video calls). Audio calls: always true.
  bool _isVideoOff = false;
  bool get isVideoOff => _isVideoOff;

  bool _isSpeakerOn = true;
  bool get isSpeakerOn => _isSpeakerOn;

  int _elapsedSeconds = 0;
  int get elapsedSeconds => _elapsedSeconds;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  /// True after the media transport reports a failed connection while a call is
  /// live. The UI surfaces a retry affordance; [retryConnection] clears it.
  bool _connectFailed = false;
  bool get connectionFailed => _connectFailed;

  /// Whether the live media session is currently re-establishing (drives a
  /// "Reconnecting…" indicator). Only meaningful during an active call.
  bool get isReconnecting =>
      hasActiveCall &&
      _media.connectionState == CallMediaConnectionState.reconnecting;

  /// A pending INCOMING call awaiting the local user's accept/decline. Separate
  /// from [session] so the app shell can show an incoming banner/screen even
  /// while another surface is foregrounded. Null when there's no ringing call.
  CallSession? _incomingCall;
  CallSession? get incomingCall => _incomingCall;

  bool get isVideoCall => callType.isVideo;
  bool get hasActiveCall => _phase != CallPhase.idle && _phase != CallPhase.ended;

  /// A short human label for how a finished call ended, shown on the ended
  /// screen. Derived from the last known session status (matches the web call
  /// log labels: declined / missed / no answer / call ended).
  String get endedReason {
    if (_connectFailed) return 'Connection failed';
    switch (_session?.status) {
      case CallStatus.rejected:
        return (_session?.isOutgoing ?? false) ? 'Call declined' : 'Declined';
      case CallStatus.missed:
        return (_session?.isOutgoing ?? false) ? 'No answer' : 'Missed call';
      case CallStatus.ended:
      case CallStatus.answered:
      case CallStatus.pending:
      case null:
        return 'Call ended';
    }
  }

  /// Live media connection state (drives the "Connecting…" UI).
  CallMediaConnectionState get mediaState => _media.connectionState;

  // --- Media surfaces (null in stub -> UI shows placeholders) -----------------

  Object? get localVideoView => _media.localVideoView();
  Object? get remoteVideoView => _media.remoteVideoView();

  // --- Lifecycle -------------------------------------------------------------

  /// Start listening for incoming calls / status changes. Call once after the
  /// user is authenticated (e.g. from the app shell). Safe to call repeatedly.
  Future<void> init() async {
    if (_initialized || _disposed) return;
    _initialized = true;

    _realtimeSub = _realtime.events.listen(_onRealtimeEvent);
    _mediaStateSub = _media.connectionStates.listen(_onMediaState);
    _renderSub = _media.renderInvalidations.listen((_) => _safeNotify());
    await _realtime.connect();

    // Poll fallback for a call that arrived before the listener attached
    // (mirrors web IncomingCallListener.checkPendingCalls on mount).
    unawaited(_pollForPendingIncoming());
  }

  // --- OUTGOING: the public launcher the Chat screen calls -------------------

  /// Place an outgoing [type] call to [callee]. Inserts the `call_logs` row
  /// (status pending), moves to [CallPhase.dialing], and starts a ring timeout.
  ///
  /// Returns the created [CallSession], or null if the call could not be placed
  /// (unconfigured / signed out / calling self). On success the caller should
  /// present [CallScreen] bound to this controller.
  Future<CallSession?> startCall({
    required CallParticipant callee,
    required CallType type,
  }) async {
    if (_disposed) return null;
    if (hasActiveCall) return _session; // already in a call
    _errorMessage = null;
    _connectFailed = false;

    // Optimistically enter dialing so the UI can open immediately.
    _isVideoOff = false;
    _isMuted = false;
    _isSpeakerOn = type.isVideo; // video defaults to speaker, voice to earpiece
    _elapsedSeconds = 0;

    CallSession? created;
    try {
      created = await _data.startCall(callee: callee, type: type);
    } catch (error) {
      _errorMessage = 'Failed to start call';
      created = null;
    }

    if (created == null) {
      _errorMessage ??= 'Failed to start call';
      _setPhase(CallPhase.idle);
      return null;
    }

    _session = created;
    _setPhase(CallPhase.dialing);
    _startRingTimeout();
    _startStatusPolling(); // realtime fallback: detect answer/reject
    return created;
  }

  // --- INCOMING: accept / decline --------------------------------------------

  /// Accept the pending [incomingCall] (or an explicit [call]). Writes status
  /// 'answered', promotes it to the active session, and connects media.
  Future<void> acceptIncomingCall([CallSession? call]) async {
    final target = call ?? _incomingCall;
    if (target == null) return;

    _incomingCall = null;
    _stopIncomingWatch();
    _connectFailed = false;
    _errorMessage = null;
    _session = target.copyWith(status: CallStatus.answered);
    _isMuted = false;
    _isVideoOff = false;
    _isSpeakerOn = target.type.isVideo;
    _elapsedSeconds = 0;
    _cancelRingTimeout();

    _setPhase(CallPhase.connecting);
    try {
      await _data.answerCall(target.id);
    } catch (_) {
      // Even if the update fails we still try to connect media; the caller's
      // realtime/poll will reconcile.
    }
    await _connectMedia();
    _startStatusPolling();
  }

  /// Decline the pending [incomingCall] (or an explicit [call]). Writes status
  /// 'rejected' and clears the incoming state.
  Future<void> declineIncomingCall([CallSession? call]) async {
    final target = call ?? _incomingCall;
    if (target == null) return;
    _incomingCall = null;
    _stopIncomingWatch();
    _safeNotify();
    try {
      await _data.rejectCall(target.id);
    } catch (_) {}
  }

  // --- In-call controls ------------------------------------------------------

  Future<void> toggleMute() async {
    _isMuted = !_isMuted;
    _safeNotify();
    await _media.setMuted(_isMuted);
  }

  Future<void> toggleVideo() async {
    if (!isVideoCall) return;
    _isVideoOff = !_isVideoOff;
    _safeNotify();
    await _media.setVideoEnabled(!_isVideoOff);
  }

  Future<void> toggleSpeaker() async {
    _isSpeakerOn = !_isSpeakerOn;
    _safeNotify();
    await _media.setSpeakerOn(_isSpeakerOn);
  }

  Future<void> flipCamera() async {
    if (!isVideoCall) return;
    await _media.flipCamera();
  }

  /// End the active call (local hang-up). Records elapsed duration when the
  /// call was connected, otherwise marks it missed (dialing) — matching the
  /// web behaviour where an unanswered outgoing call becomes a missed log.
  Future<void> hangUp() async {
    final current = _session;
    if (current == null) {
      _setPhase(CallPhase.idle);
      return;
    }

    final wasConnected = _phase == CallPhase.connected;
    final wasDialing = _phase == CallPhase.dialing;
    _stopDurationTimer();
    _cancelRingTimeout();
    _stopStatusPolling();
    _connectFailed = false;

    // Reflect the terminal status on the local session so the ended screen can
    // label it (an unanswered dial reads "No answer"; anything else "ended").
    _session = current.copyWith(
      status: wasDialing ? CallStatus.missed : CallStatus.ended,
      durationSeconds: wasConnected ? _elapsedSeconds : 0,
    );
    _setPhase(CallPhase.ended);
    await _media.disconnect();

    try {
      if (wasDialing) {
        // Unanswered outgoing call -> missed.
        await _data.markMissed(current.id);
      } else {
        await _data.endCall(
          current.id,
          durationSeconds: wasConnected ? _elapsedSeconds : 0,
        );
      }
    } catch (_) {}
  }

  /// Clear a finished call and return to idle (e.g. after the "call ended"
  /// screen is dismissed). Keeps the incoming listener running.
  void reset() {
    _stopDurationTimer();
    _cancelRingTimeout();
    _stopStatusPolling();
    _stopIncomingWatch();
    _session = null;
    _elapsedSeconds = 0;
    _errorMessage = null;
    _connectFailed = false;
    _setPhase(CallPhase.idle);
  }

  // --- Realtime + polling reconciliation -------------------------------------

  Future<void> _onRealtimeEvent(CallRealtimeEvent event) async {
    switch (event.kind) {
      case CallRealtimeEventKind.incoming:
        await _handleIncoming(event);
        break;
      case CallRealtimeEventKind.statusChanged:
        _handleStatusChange(event.callId, event.status);
        break;
    }
  }

  Future<void> _handleIncoming(CallRealtimeEvent event) async {
    // Ignore if it's not actually pending or we already surfaced this call.
    if (event.status != CallStatus.pending) return;
    if (_incomingCall?.id == event.callId) return;

    // Busy: a call is already active or another one is ringing. Auto-decline
    // the newcomer so the caller stops ringing instead of timing out.
    if (hasActiveCall || _incomingCall != null) {
      try {
        await _data.rejectCall(event.callId);
      } catch (_) {}
      return;
    }

    final callerId = event.callerId;
    if (callerId == null) return;
    final peer = await _data.fetchParticipant(callerId) ??
        CallParticipant(userId: callerId, displayName: 'feedIn user');

    // Guard against a race where a call started while we were resolving the
    // caller profile.
    if (hasActiveCall || _incomingCall != null) return;

    _incomingCall = CallSession(
      id: event.callId,
      callerId: callerId,
      receiverId: event.receiverId ?? '',
      type: event.type,
      status: CallStatus.pending,
      direction: CallDirection.incoming,
      peer: peer,
    );
    _afterIncomingSet();
  }

  void _handleStatusChange(String callId, CallStatus status) {
    // Incoming ringing call was cancelled/answered elsewhere -> dismiss banner.
    if (_incomingCall?.id == callId && status != CallStatus.pending) {
      _incomingCall = null;
      _stopIncomingWatch();
      _safeNotify();
    }

    final current = _session;
    if (current == null || current.id != callId) return;

    switch (status) {
      case CallStatus.answered:
        // Callee accepted our outgoing call -> connect media.
        if (_phase == CallPhase.dialing) {
          _cancelRingTimeout();
          _session = current.copyWith(status: CallStatus.answered);
          _setPhase(CallPhase.connecting);
          unawaited(_connectMedia());
        }
        break;
      case CallStatus.rejected:
      case CallStatus.ended:
      case CallStatus.missed:
        // The other party ended/declined -> tear down locally.
        _remoteEnded(status);
        break;
      case CallStatus.pending:
        break;
    }
  }

  void _remoteEnded(CallStatus status) {
    if (_phase == CallPhase.ended || _phase == CallPhase.idle) return;
    _stopDurationTimer();
    _cancelRingTimeout();
    _stopStatusPolling();
    _connectFailed = false;
    _session = _session?.copyWith(status: status);
    _setPhase(CallPhase.ended);
    unawaited(_media.disconnect());
  }

  // Poll fallback (matches the web listener's belt-and-braces polling) so the
  // caller/callee still reconcile if a realtime event is dropped.
  void _startStatusPolling() {
    _stopStatusPolling();
    _statusPollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      final current = _session;
      if (current == null) return;
      final status = await _data.fetchCallStatus(current.id);
      if (status != null && status != current.status) {
        _handleStatusChange(current.id, status);
      }
    });
  }

  void _stopStatusPolling() {
    _statusPollTimer?.cancel();
    _statusPollTimer = null;
  }

  Future<void> _pollForPendingIncoming() async {
    if (hasActiveCall || _incomingCall != null) return;
    final pending = await _data.fetchPendingIncomingCall();
    if (pending == null || hasActiveCall || _incomingCall != null) return;
    _incomingCall = pending;
    _afterIncomingSet();
  }

  /// Start the belt-and-braces watch for a freshly surfaced incoming call: a
  /// 3s status poll (in case the realtime cancel/answer event is dropped, as
  /// the web `IncomingCallListener` does) plus a safety timeout that dismisses
  /// a never-answered banner so it can never hang forever.
  void _afterIncomingSet() {
    _startIncomingWatch();
    _safeNotify();
  }

  void _startIncomingWatch() {
    _stopIncomingWatch();
    _incomingPollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      final ringing = _incomingCall;
      if (ringing == null) {
        _stopIncomingWatch();
        return;
      }
      final status = await _data.fetchCallStatus(ringing.id);
      // The caller cancelled / it was answered elsewhere -> drop the banner.
      if (status != null && status != CallStatus.pending) {
        if (_incomingCall?.id == ringing.id) {
          _incomingCall = null;
          _stopIncomingWatch();
          _safeNotify();
        }
      }
    });
    _incomingTimeoutTimer = Timer(_ringTimeout, () {
      // Auto-dismiss an unanswered incoming banner and record the miss.
      final ringing = _incomingCall;
      if (ringing == null) return;
      _incomingCall = null;
      _stopIncomingWatch();
      _safeNotify();
      unawaited(_data.markMissed(ringing.id));
    });
  }

  void _stopIncomingWatch() {
    _incomingPollTimer?.cancel();
    _incomingPollTimer = null;
    _incomingTimeoutTimer?.cancel();
    _incomingTimeoutTimer = null;
  }

  // --- Media orchestration ---------------------------------------------------

  Future<void> _connectMedia() async {
    final current = _session;
    if (current == null) return;
    await _media.connect(current, videoEnabled: isVideoCall && !_isVideoOff);
    // Apply current local flags to the fresh session.
    await _media.setMuted(_isMuted);
    await _media.setSpeakerOn(_isSpeakerOn);
  }

  void _onMediaState(CallMediaConnectionState state) {
    switch (state) {
      case CallMediaConnectionState.connected:
        _connectFailed = false;
        _errorMessage = null;
        if (_phase != CallPhase.connected) {
          _setPhase(CallPhase.connected);
        }
        // Resume/begin counting once media is live (the timer keeps its elapsed
        // value across a reconnect so a blip doesn't reset the call clock).
        if (_durationTimer == null) _startDurationTimer();
        _safeNotify();
        break;
      case CallMediaConnectionState.failed:
        // Keep the call alive and offer a retry (mirrors the web
        // ConnectionStatus "Retry Connection"); the user can still hang up.
        _connectFailed = true;
        _errorMessage = 'Connection failed';
        _stopDurationTimer();
        _safeNotify();
        break;
      case CallMediaConnectionState.idle:
      case CallMediaConnectionState.connecting:
      case CallMediaConnectionState.reconnecting:
      case CallMediaConnectionState.disconnected:
        _safeNotify();
        break;
    }
  }

  /// Re-attempt the media connection after a [connectionFailed] state, without
  /// tearing down the signalling call. No-op when there is no active session.
  Future<void> retryConnection() async {
    final current = _session;
    if (current == null || _phase == CallPhase.ended) return;
    _connectFailed = false;
    _errorMessage = null;
    if (_phase != CallPhase.connected) {
      _setPhase(CallPhase.connecting);
    } else {
      _safeNotify();
    }
    await _connectMedia();
  }

  // --- Timers ----------------------------------------------------------------

  void _startDurationTimer() {
    _durationTimer?.cancel();
    // Elapsed is zeroed when a fresh call begins (startCall / acceptIncomingCall
    // / reset); it is intentionally preserved here so a mid-call reconnect
    // resumes the clock rather than restarting it.
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _elapsedSeconds += 1;
      _safeNotify();
    });
  }

  void _stopDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = null;
  }

  /// If nobody answers within the timeout, mark the outgoing call missed.
  void _startRingTimeout() {
    _cancelRingTimeout();
    _ringTimeoutTimer = Timer(_ringTimeout, () {
      if (_phase == CallPhase.dialing) {
        unawaited(hangUp());
      }
    });
  }

  void _cancelRingTimeout() {
    _ringTimeoutTimer?.cancel();
    _ringTimeoutTimer = null;
  }

  // --- Helpers ---------------------------------------------------------------

  void _setPhase(CallPhase next) {
    if (_phase == next) {
      _safeNotify();
      return;
    }
    _phase = next;
    _safeNotify();
  }

  void _safeNotify() {
    if (_disposed) return;
    notifyListeners();
  }

  /// Formats [elapsedSeconds] as mm:ss (web `formatDuration`), promoting to
  /// h:mm:ss for calls that run an hour or longer.
  String get formattedDuration => formatCallDuration(_elapsedSeconds);

  @override
  void dispose() {
    _disposed = true;
    _stopDurationTimer();
    _cancelRingTimeout();
    _stopStatusPolling();
    _stopIncomingWatch();
    _realtimeSub?.cancel();
    _mediaStateSub?.cancel();
    _renderSub?.cancel();
    unawaited(_realtime.dispose());
    unawaited(_media.dispose());
    super.dispose();
  }
}
