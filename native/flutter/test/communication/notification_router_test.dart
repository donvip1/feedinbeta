import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/domain/notification_payload.dart';
import 'package:feedin/src/features/communication/services/notification_preference_store.dart';
import 'package:feedin/src/features/communication/services/notification_router.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  late CommunicationDatabase db;
  late NotificationPreferenceStore prefs;
  late NotificationRouter router;
  final callsPresented = <NotificationPayload>[];
  final shown = <NotificationPayload>[];
  final silent = <NotificationPayload>[];
  String? foregroundConversation;
  var now = 1000;

  setUp(() async {
    now = 1000;
    foregroundConversation = null;
    callsPresented.clear();
    shown.clear();
    silent.clear();
    db = await CommunicationDatabase.open(
      databaseFactoryFfi,
      inMemoryDatabasePath,
    );
    prefs = NotificationPreferenceStore(db);
    router = NotificationRouter(
      preferences: prefs,
      onIncomingCall: (p) async => callsPresented.add(p),
      onShowNotification: (p) async => shown.add(p),
      onSilentSignal: (p) async => silent.add(p),
      foregroundConversationId: () => foregroundConversation,
      nowMillis: () => now,
    );
  });

  tearDown(() async {
    await router.dispose();
    await db.close();
  });

  NotificationPayload message({String conversationId = 'c1'}) =>
      NotificationPayload(
        category: NotificationCategory.message,
        title: 'Ada',
        body: 'hello',
        conversationId: conversationId,
        route: 'conversation:$conversationId',
      );

  group('payload contract', () {
    test('maps every supported push type to its destination route', () {
      expect(
        notificationRouteFromData({'type': 'gift', 'post_id': 'p1'}),
        'post:p1',
      );
      expect(
        notificationRouteFromData({'type': 'comment', 'post_id': 'p2'}),
        'post:p2',
      );
      expect(
        notificationRouteFromData({'type': 'mention', 'related_id': 'p3'}),
        'post:p3',
      );
      expect(
        notificationRouteFromData({'type': 'tag', 'post_id': 'p4'}),
        'post:p4',
      );
      expect(
        notificationRouteFromData({'type': 'follow', 'profile_id': 'u1'}),
        'profile:u1',
      );
      expect(
        notificationRouteFromData({
          'type': 'message',
          'conversation_id': 'c1',
        }),
        'conversation:c1',
      );
      expect(
        notificationRouteFromData({'type': 'call', 'call_id': 'k1'}),
        'call:k1',
      );
    });

    test('toData/fromData round-trips the v1 shape', () {
      const payload = NotificationPayload(
        category: NotificationCategory.mention,
        title: 'Ada',
        body: 'mentioned you',
        conversationId: 'c9',
        messageId: 'm3',
        senderId: 'u2',
        senderName: 'Ada',
        route: 'conversation:c9',
        extra: {'thread': 't1'},
      );
      final round = NotificationPayload.fromData(payload.toData());
      expect(round.category, NotificationCategory.mention);
      expect(round.conversationId, 'c9');
      expect(round.messageId, 'm3');
      expect(round.route, 'conversation:c9');
      expect(round.extra['thread'], 't1');
    });

    test('LEGACY call payload (type: call) is translated — old pushes keep ringing', () {
      final payload = NotificationPayload.fromData({
        'type': 'call',
        'call_id': 'call-1',
        'caller_name': 'Ada',
        'call_type': 'video',
        'caller_avatar': 'https://a/x.png',
      });
      expect(payload.category, NotificationCategory.call);
      expect(payload.callId, 'call-1');
      expect(payload.body, contains('video'));
      expect(payload.avatarUrl, 'https://a/x.png');
    });

    test('LEGACY message payload (type: message) is translated', () {
      final payload = NotificationPayload.fromData({
        'type': 'message',
        'conversation_id': 'c1',
        'sender_name': 'Ada',
        'body': 'yo',
      });
      expect(payload.category, NotificationCategory.message);
      expect(payload.route, 'conversation:c1');
    });

    test('unknown category degrades to message (never dropped/crashed)', () {
      final payload = NotificationPayload.fromData({
        'category': 'hologram_ping',
        'title': 't',
        'body': 'b',
      });
      expect(payload.category, NotificationCategory.message);
    });
  });

  group('routing rules', () {
    test('calls always present the incoming-call UI — even when muted', () async {
      await prefs.mute('c1');
      await prefs.setEnabled(NotificationCategory.call, false); // even off
      final decision = await router.route(
        const NotificationPayload(
          category: NotificationCategory.call,
          title: 'Ada',
          body: 'Incoming voice call',
          callId: 'call-1',
          conversationId: 'c1',
        ),
      );
      expect(decision.action, NotificationAction.presentIncomingCall);
      expect(callsPresented.single.callId, 'call-1');
    });

    test('silent payloads process silently, no UI', () async {
      final decision = await router.route(
        const NotificationPayload(
          category: NotificationCategory.silent,
          title: '',
          body: '',
        ),
      );
      expect(decision.action, NotificationAction.processSilently);
      expect(silent.length, 1);
      expect(shown, isEmpty);
    });

    test('category preference off suppresses', () async {
      await prefs.setEnabled(NotificationCategory.reaction, false);
      final decision = await router.route(
        const NotificationPayload(
          category: NotificationCategory.reaction,
          title: 'Ada',
          body: 'reacted',
          conversationId: 'c1',
        ),
      );
      expect(decision.action, NotificationAction.suppress);
      expect(shown, isEmpty);
    });

    test('muted conversation suppresses messages; timed mute expires', () async {
      await prefs.mute('c1', until: DateTime.fromMillisecondsSinceEpoch(5000));
      expect(
        (await router.route(message())).action,
        NotificationAction.suppress,
      );
      now = 6000; // past the mute
      expect(
        (await router.route(message())).action,
        NotificationAction.showNotification,
      );
      expect(shown.length, 1);
    });

    test('forever-mute stays muted', () async {
      await prefs.mute('c1'); // no until = forever
      now = 999999999;
      expect(
        (await router.route(message())).action,
        NotificationAction.suppress,
      );
    });

    test('viewer already reading the conversation → suppress', () async {
      foregroundConversation = 'c1';
      expect(
        (await router.route(message())).action,
        NotificationAction.suppress,
      );
      // A different conversation still shows.
      expect(
        (await router.route(message(conversationId: 'c2'))).action,
        NotificationAction.showNotification,
      );
    });

    test('priority bypasses category opt-out', () async {
      await prefs.setEnabled(NotificationCategory.priority, false);
      final decision = await router.route(
        const NotificationPayload(
          category: NotificationCategory.priority,
          title: 'Security',
          body: 'New login',
        ),
      );
      expect(decision.action, NotificationAction.showNotification);
    });

    test('routeData handles a raw legacy FCM map end-to-end', () async {
      final decision = await router.routeData({
        'type': 'call',
        'call_id': 'call-9',
        'caller_name': 'Ada',
        'call_type': 'voice',
      });
      expect(decision.action, NotificationAction.presentIncomingCall);
      expect(callsPresented.single.callId, 'call-9');
    });

    test('decisions stream reports action + reason for diagnostics', () async {
      final decisions = <NotificationDecision>[];
      final sub = router.decisions.listen(decisions.add);
      await prefs.mute('c1');
      await router.route(message());
      await router.route(message(conversationId: 'c2'));
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();

      expect(decisions[0].action, NotificationAction.suppress);
      expect(decisions[0].reason, contains('muted'));
      expect(decisions[1].action, NotificationAction.showNotification);
    });
  });
}
