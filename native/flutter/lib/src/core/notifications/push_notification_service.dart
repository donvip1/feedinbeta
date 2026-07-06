import 'dart:async';
import 'dart:ui';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/local/notification_repository_contract.dart';
import 'callkit_service.dart';
import 'local_notifications_service.dart';

/// Top-level FCM background handler, invoked in a dedicated isolate while the app
/// is backgrounded or terminated. It has no widget tree, no Hive, and no
/// Supabase session — so it works purely from the message's `data` payload.
///
/// It handles the two Module 2 push types by their `type` field:
///
///   * `type: call`    → present the native full-screen incoming-call UI
///                        (CallKit) so a call rings even from a killed app.
///   * `type: message` → post a rich, grouped message notification with an
///                        inline reply action.
///
/// ### Data-payload contract (backend must send data-only messages)
///
/// Incoming call (`type: call`):
/// ```json
/// { "type": "call", "call_id": "<uuid>", "caller_name": "Ada",
///   "caller_avatar": "https://…", "call_type": "video" }
/// ```
/// (`call_type` is `voice` or `video`; `caller_avatar` optional.)
///
/// Message (`type: message`):
/// ```json
/// { "type": "message", "conversation_id": "<uuid>", "sender_name": "Ada",
///   "body": "hey!", "message_id": "<uuid>" }
/// ```
/// (`message_id` optional but recommended so re-delivery replaces the entry.)
///
/// Notification-type payloads (with a `notification` block) are still rendered
/// by the OS automatically, so they need nothing here.
@pragma('vm:entry-point')
Future<void> feedinFirebaseBackgroundHandler(RemoteMessage message) async {
  // The background isolate needs its plugin registrations bootstrapped before
  // any platform channel (CallKit / local notifications) is usable.
  DartPluginRegistrant.ensureInitialized();
  final data = message.data;
  switch (data['type']?.toString()) {
    case 'call':
      final callId = data['call_id']?.toString();
      if (callId == null || callId.isEmpty) return;
      await CallKitService.showIncomingCall(
        callId: callId,
        callerName: data['caller_name']?.toString() ?? 'feedIn user',
        isVideo: data['call_type']?.toString() == 'video',
        avatarUrl: data['caller_avatar']?.toString(),
      );
      break;
    case 'message':
      final conversationId = data['conversation_id']?.toString();
      final body = data['body']?.toString();
      if (conversationId == null || conversationId.isEmpty || body == null) {
        return;
      }
      final local = LocalNotificationsService(isConfigured: true);
      await local.initialize();
      await local.showMessageNotification(
        conversationId: conversationId,
        senderName: data['sender_name']?.toString() ?? 'feedIn',
        body: body,
        messageId: data['message_id']?.toString(),
      );
      break;
    default:
      // Unknown / notification-only payload: the OS handles display.
      break;
  }
}

/// Wires Firebase Cloud Messaging into the app:
/// - requests the notification permission,
/// - registers this device's FCM token for the signed-in user via the
///   `register_push_subscription` RPC (and re-registers on token refresh),
/// - surfaces foreground messages into the in-app notification inbox,
/// - exposes notification-tap routes so the host shell can deep-link.
///
/// Degrades gracefully: when [isConfigured] is false (no Supabase config / test
/// builds) or Firebase was never initialised, every method is a safe no-op so
/// push setup can never crash or block the app.
class PushNotificationService {
  PushNotificationService({
    required this.isConfigured,
    this.notificationRepository,
  });

  final bool isConfigured;
  final NotificationRepositoryContract? notificationRepository;

  final StreamController<String> _taps = StreamController<String>.broadcast();

  /// Routes emitted when the user taps a notification (e.g. `conversation:<id>`).
  /// The host shell listens and navigates.
  Stream<String> get notificationTaps => _taps.stream;

  bool _initialized = false;
  bool _tokenListenerAttached = false;

  FirebaseMessaging? get _messaging {
    if (!isConfigured) return null;
    try {
      return FirebaseMessaging.instance;
    } catch (_) {
      // Firebase not initialised (e.g. widget tests) — treat as unavailable.
      return null;
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

  /// Request permission and attach foreground/tap listeners. Idempotent.
  Future<void> initialize() async {
    final messaging = _messaging;
    if (messaging == null || _initialized) return;
    _initialized = true;
    try {
      await messaging.requestPermission();
      FirebaseMessaging.onMessage.listen(_handleForeground);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleOpened);
    } catch (_) {
      // Never let push setup crash the app.
    }
  }

  /// Register the current device token for the signed-in user. Requires an
  /// authenticated Supabase session (the RPC raises otherwise), so call this
  /// once the user is logged in.
  Future<void> registerForUser({String? appVersion}) async {
    final messaging = _messaging;
    final client = _client;
    if (messaging == null || client == null) return;
    if (client.auth.currentUser == null) return;
    try {
      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await _register(client, token, appVersion);
      }
      if (!_tokenListenerAttached) {
        _tokenListenerAttached = true;
        messaging.onTokenRefresh.listen((refreshed) {
          final current = _client;
          if (current != null && current.auth.currentUser != null) {
            unawaited(_register(current, refreshed, appVersion));
          }
        });
      }
    } catch (_) {
      // Token retrieval / registration is non-critical; ignore failures.
    }
  }

  Future<void> _register(
    SupabaseClient client,
    String token,
    String? appVersion,
  ) async {
    try {
      await client.rpc<void>(
        'register_push_subscription',
        params: {
          'p_platform': 'android',
          'p_device_token': token,
          'p_app_version': appVersion,
        },
      );
    } catch (_) {
      // ignore — best effort
    }
  }

  /// Route from a notification that cold-started the app (terminated → tap).
  Future<String?> initialRoute() async {
    final messaging = _messaging;
    if (messaging == null) return null;
    try {
      return _routeFrom(await messaging.getInitialMessage());
    } catch (_) {
      return null;
    }
  }

  void _handleForeground(RemoteMessage message) {
    final repo = notificationRepository;
    final notification = message.notification;
    if (repo == null) return;
    if (notification?.title == null && notification?.body == null) return;
    unawaited(
      repo.addNotification(
        title: notification?.title ?? 'feedIn',
        body: notification?.body ?? '',
        route: _stringData(message, 'route'),
        rawType: _stringData(message, 'type'),
      ),
    );
  }

  void _handleOpened(RemoteMessage message) {
    final route = _routeFrom(message);
    if (route != null) _taps.add(route);
  }

  String? _routeFrom(RemoteMessage? message) {
    if (message == null) return null;
    final route = _stringData(message, 'route');
    if (route != null && route.isNotEmpty) return route;
    final conversationId = _stringData(message, 'conversation_id');
    if (conversationId != null && conversationId.isNotEmpty) {
      return 'conversation:$conversationId';
    }
    return null;
  }

  static String? _stringData(RemoteMessage message, String key) {
    return message.data[key]?.toString();
  }

  void dispose() {
    _taps.close();
  }
}
