import 'dart:async';

import 'package:flutter_callkit_incoming/entities/entities.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';

/// What the user (or the system) did with a native incoming-call screen.
enum CallKitActionKind { accept, decline, timeout, ended }

/// A decoded CallKit action carrying the originating call id + our extra data.
class CallKitAction {
  const CallKitAction({
    required this.kind,
    required this.callId,
    this.isVideo = false,
  });

  final CallKitActionKind kind;
  final String callId;
  final bool isVideo;
}

/// Wraps `flutter_callkit_incoming` to present the full-screen native incoming
/// call UI when a call push arrives while the app is backgrounded or killed —
/// the piece the Supabase-realtime path can't cover because it needs a live
/// websocket.
///
/// The backend sends a data-only FCM message (`type: call`); the background
/// handler calls [showIncomingCall]. Accept/decline the user makes on the native
/// screen surface through [actions]; the app shell reconciles them with the
/// existing [CallController] (fetch the call, then accept/reject).
///
/// Degrades gracefully: when [isConfigured] is false every method is a safe
/// no-op.
class CallKitService {
  CallKitService({required this.isConfigured});

  final bool isConfigured;

  final StreamController<CallKitAction> _actions =
      StreamController<CallKitAction>.broadcast();
  StreamSubscription<CallEvent?>? _eventSub;
  bool _initialized = false;

  /// Native-UI actions (accept / decline / timeout / ended). The shell listens
  /// and drives [CallController].
  Stream<CallKitAction> get actions => _actions.stream;

  /// Attach the CallKit event listener. Idempotent. Call once the app is alive
  /// (the background isolate presents calls without this; this stream is how the
  /// *foreground* app learns what the user did on the native screen).
  void initialize() {
    if (!isConfigured || _initialized) return;
    _initialized = true;
    try {
      _eventSub = FlutterCallkitIncoming.onEvent.listen(_onEvent);
    } catch (_) {
      // Never let call setup crash the app.
    }
  }

  /// Show the native full-screen incoming-call screen for [callId].
  ///
  /// Static so the headless FCM background isolate can call it directly without
  /// constructing the service.
  static Future<void> showIncomingCall({
    required String callId,
    required String callerName,
    bool isVideo = false,
    String? avatarUrl,
  }) async {
    try {
      final params = CallKitParams(
        id: callId,
        nameCaller: callerName,
        appName: 'feedIn',
        avatar: avatarUrl,
        handle: callerName,
        type: isVideo ? 1 : 0,
        textAccept: 'Accept',
        textDecline: 'Decline',
        extra: <String, dynamic>{'callId': callId, 'isVideo': isVideo},
        android: const AndroidParams(
          isCustomNotification: true,
          isShowLogo: false,
          ringtonePath: 'system_ringtone_default',
          backgroundColor: '#0B1120',
          actionColor: '#22C55E',
          textColor: '#FFFFFF',
          incomingCallNotificationChannelName: 'Incoming calls',
          isShowFullLockedScreen: true,
        ),
      );
      await FlutterCallkitIncoming.showCallkitIncoming(params);
    } catch (_) {
      // Best effort — a missed native ring still lands via realtime if alive.
    }
  }

  /// Dismiss the native screen for a specific call (e.g. we answered/ended it
  /// in-app, or the caller cancelled).
  Future<void> endCall(String callId) async {
    if (!isConfigured) return;
    try {
      await FlutterCallkitIncoming.endCall(callId);
    } catch (_) {}
  }

  /// Dismiss every native call screen.
  Future<void> endAllCalls() async {
    if (!isConfigured) return;
    try {
      await FlutterCallkitIncoming.endAllCalls();
    } catch (_) {}
  }

  void _onEvent(CallEvent? event) {
    if (event == null) return;
    final kind = _kindFor(event.event);
    if (kind == null) return;
    final body = event.body;
    final data = body is Map ? body : const <dynamic, dynamic>{};
    final extra = data['extra'];
    final extraMap = extra is Map ? extra : const <dynamic, dynamic>{};
    final callId =
        (extraMap['callId'] ?? data['id'])?.toString() ?? '';
    if (callId.isEmpty) return;
    final isVideo = extraMap['isVideo'] == true || data['type'] == 1;
    _actions.add(
      CallKitAction(kind: kind, callId: callId, isVideo: isVideo),
    );
  }

  CallKitActionKind? _kindFor(Event event) {
    switch (event) {
      case Event.actionCallAccept:
        return CallKitActionKind.accept;
      case Event.actionCallDecline:
        return CallKitActionKind.decline;
      case Event.actionCallTimeout:
        return CallKitActionKind.timeout;
      case Event.actionCallEnded:
        return CallKitActionKind.ended;
      case Event.actionDidUpdateDevicePushTokenVoip:
      case Event.actionCallIncoming:
      case Event.actionCallStart:
      case Event.actionCallConnected:
      case Event.actionCallCallback:
      case Event.actionCallToggleHold:
      case Event.actionCallToggleMute:
      case Event.actionCallToggleDmtf:
      case Event.actionCallToggleGroup:
      case Event.actionCallToggleAudioSession:
      case Event.actionCallCustom:
        return null;
    }
  }

  void dispose() {
    _eventSub?.cancel();
    _actions.close();
  }
}
