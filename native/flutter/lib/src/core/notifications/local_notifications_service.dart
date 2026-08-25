import 'dart:async';
import 'dart:ui';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'pending_reply_store.dart';

/// Top-level background handler for a notification action/tap that arrives while
/// the app is terminated or backgrounded (runs in its own isolate — no widget
/// tree, no Hive, no Supabase session).
///
/// Its only job is the WhatsApp-style inline reply: persist the typed text into
/// [PendingReplyStore] so the UI isolate can flush it through the normal
/// send path on next resume. Everything else (opening a conversation) is handled
/// by the OS launching the app + [LocalNotificationsService.notificationTaps].
@pragma('vm:entry-point')
void feedinNotificationBackgroundResponse(NotificationResponse response) {
  // Rehydrate plugin registrations for this background isolate so the
  // shared_preferences platform channel is available.
  DartPluginRegistrant.ensureInitialized();
  if (response.actionId != LocalNotificationsService.replyActionId) return;
  final text = response.input?.trim() ?? '';
  final conversationId =
      LocalNotificationsService.conversationIdFromPayload(response.payload);
  if (text.isEmpty || conversationId == null) return;
  // ignore: unawaited_futures — headless isolate; fire-and-forget persistence.
  const PendingReplyStore()
      .append(PendingReply(conversationId: conversationId, body: text));
}

/// Rich, WhatsApp-style local message notifications built on
/// `flutter_local_notifications`:
///   * grouped per conversation (a summary + one line per message),
///   * an inline **Reply** action whose text is queued for the normal send path,
///   * taps that deep-link into the conversation via [notificationTaps].
///
/// Degrades gracefully: when [isConfigured] is false (tests / unconfigured
/// builds) every method is a safe no-op so notification setup never crashes.
class LocalNotificationsService {
  LocalNotificationsService({required this.isConfigured});

  final bool isConfigured;

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  final StreamController<String> _taps = StreamController<String>.broadcast();
  final StreamController<PendingReply> _replies =
      StreamController<PendingReply>.broadcast();

  bool _initialized = false;

  /// Android channel for message notifications.
  static const String messagesChannelId = 'messages';
  static const String messagesChannelName = 'Messages';
  static const String messagesChannelDescription =
      'New direct messages and replies';
  static const String socialChannelId = 'social_updates';
  static const String socialChannelName = 'Social updates';
  static const String socialChannelDescription =
      'Gifts, comments, mentions, tags and follows';

  /// Prefix for the per-conversation Android group key.
  static const String _groupKeyPrefix = 'feedin.conversation.';

  /// Action + input identifiers for the inline reply.
  static const String replyActionId = 'feedin.reply';

  /// Route prefix reused across the app for conversation deep-links.
  static const String _routePrefix = 'conversation:';

  /// Routes emitted when the user taps a message notification (not the reply
  /// action). The host shell listens and navigates.
  Stream<String> get notificationTaps => _taps.stream;

  /// Replies captured while the app is alive (foreground/background-but-running)
  /// so the shell can flush them immediately instead of waiting for a resume.
  Stream<PendingReply> get replies => _replies.stream;

  /// Initialise the plugin and create the Android message channel. Idempotent.
  Future<void> initialize() async {
    if (!isConfigured || _initialized) return;
    _initialized = true;
    try {
      const androidInit =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const settings = InitializationSettings(android: androidInit);
      await _plugin.initialize(
        settings,
        onDidReceiveNotificationResponse: _onForegroundResponse,
        onDidReceiveBackgroundNotificationResponse:
            feedinNotificationBackgroundResponse,
      );
      await _plugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(
            const AndroidNotificationChannel(
              messagesChannelId,
              messagesChannelName,
              description: messagesChannelDescription,
              importance: Importance.high,
            ),
          );
      await _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(
            const AndroidNotificationChannel(
              socialChannelId,
              socialChannelName,
              description: socialChannelDescription,
              importance: Importance.high,
            ),
          );
    } catch (_) {
      // Never let notification setup crash the app.
    }
  }

  /// A route the app was cold-started with by tapping a message notification
  /// (terminated → tap), or null.
  Future<String?> initialRoute() async {
    if (!isConfigured) return null;
    try {
      final details = await _plugin.getNotificationAppLaunchDetails();
      if (details?.didNotificationLaunchApp != true) return null;
      final payload = details?.notificationResponse?.payload?.trim();
      return payload == null || payload.isEmpty ? null : payload;
    } catch (_) {
      return null;
    }
  }

  Future<void> showSocialNotification({
    required String title,
    required String body,
    required String route,
    required String eventType,
    String? notificationId,
  }) async {
    if (!isConfigured || !_initialized) return;
    try {
      final details = AndroidNotificationDetails(
        socialChannelId,
        socialChannelName,
        channelDescription: socialChannelDescription,
        importance: Importance.high,
        priority: Priority.high,
        category: AndroidNotificationCategory.social,
        styleInformation: BigTextStyleInformation(body, contentTitle: title),
      );
      final seed = notificationId?.isNotEmpty == true
          ? notificationId!
          : '$eventType:$route:$body';
      await _plugin.show(
        seed.hashCode & 0x7fffffff,
        title,
        body,
        NotificationDetails(android: details),
        payload: route,
      );
    } catch (_) {
      // Best effort.
    }
  }

  /// Post (or add to the group of) a message notification for [conversationId].
  /// Renders [senderName] as the title and [body] as the message, attaches the
  /// inline Reply action, and keeps everything grouped under one conversation
  /// summary so a busy chat collapses instead of spamming the shade.
  Future<void> showMessageNotification({
    required String conversationId,
    required String senderName,
    required String body,
    String? messageId,
  }) async {
    if (!isConfigured || !_initialized) return;
    try {
      final groupKey = '$_groupKeyPrefix$conversationId';
      final payload = '$_routePrefix$conversationId';

      const replyAction = AndroidNotificationAction(
        replyActionId,
        'Reply',
        inputs: <AndroidNotificationActionInput>[
          AndroidNotificationActionInput(label: 'Reply'),
        ],
        // WhatsApp-style: reply is handled in the background without opening the
        // app; the text is queued and flushed on next resume.
        showsUserInterface: false,
        cancelNotification: true,
      );

      final messageDetails = AndroidNotificationDetails(
        messagesChannelId,
        messagesChannelName,
        channelDescription: messagesChannelDescription,
        importance: Importance.high,
        priority: Priority.high,
        category: AndroidNotificationCategory.message,
        groupKey: groupKey,
        actions: const <AndroidNotificationAction>[replyAction],
        styleInformation: BigTextStyleInformation(
          body,
          contentTitle: senderName,
        ),
      );

      await _plugin.show(
        _childId(conversationId, messageId, body),
        senderName,
        body,
        NotificationDetails(android: messageDetails),
        payload: payload,
      );

      // Group summary so multiple messages collapse into one conversation entry.
      final summaryDetails = AndroidNotificationDetails(
        messagesChannelId,
        messagesChannelName,
        channelDescription: messagesChannelDescription,
        importance: Importance.high,
        priority: Priority.high,
        groupKey: groupKey,
        setAsGroupSummary: true,
        styleInformation: InboxStyleInformation(
          const <String>[],
          contentTitle: senderName,
          summaryText: 'New messages',
        ),
      );
      await _plugin.show(
        _summaryId(conversationId),
        senderName,
        'New messages',
        NotificationDetails(android: summaryDetails),
        payload: payload,
      );
    } catch (_) {
      // Best effort.
    }
  }

  /// Clear the notifications for a conversation (e.g. once it's opened/read).
  Future<void> clearConversation(String conversationId) async {
    if (!isConfigured || !_initialized) return;
    try {
      await _plugin.cancel(_summaryId(conversationId));
    } catch (_) {}
  }

  void _onForegroundResponse(NotificationResponse response) {
    if (response.actionId == replyActionId) {
      final text = response.input?.trim() ?? '';
      final conversationId = conversationIdFromPayload(response.payload);
      if (text.isEmpty || conversationId == null) return;
      final reply = PendingReply(conversationId: conversationId, body: text);
      // Persist too, so a resume-driven drain also catches it if the stream
      // listener isn't attached yet.
      unawaited(const PendingReplyStore().append(reply));
      _replies.add(reply);
      return;
    }
    final payload = response.payload;
    if (payload != null && payload.isNotEmpty) _taps.add(payload);
  }

  /// Extract the conversation id from a `conversation:<id>` payload, or null.
  static String? conversationIdFromPayload(String? payload) {
    if (payload == null) return null;
    final value = payload.trim();
    if (!value.startsWith(_routePrefix)) return null;
    final id = value.substring(_routePrefix.length).trim();
    return id.isEmpty ? null : id;
  }

  // A stable, positive notification id per message so re-delivery replaces
  // rather than stacks; falls back to the body when there's no message id.
  int _childId(String conversationId, String? messageId, String body) {
    final seed = messageId?.isNotEmpty == true
        ? messageId!
        : '$conversationId:$body';
    return seed.hashCode & 0x7fffffff;
  }

  // Group summary id: stable per conversation, kept distinct from child ids by
  // salting the conversation id.
  int _summaryId(String conversationId) =>
      'summary:$conversationId'.hashCode & 0x7fffffff;

  void dispose() {
    _taps.close();
    _replies.close();
  }
}
