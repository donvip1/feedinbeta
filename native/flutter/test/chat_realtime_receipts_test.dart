import 'package:feedin/src/data/remote/messages_remote_data_source.dart';
import 'package:feedin/src/features/messages/chat/chat_mappers.dart';
import 'package:feedin/src/features/messages/chat/chat_realtime_data_source.dart';
import 'package:feedin/src/features/messages/chat/chat_theme.dart';
import 'package:feedin/src/features/messages/chat/chat_view_models.dart';
import 'package:feedin/src/features/messages/chat/widgets/chat_composer.dart';
import 'package:feedin/src/features/messages/chat/widgets/chat_message_bubble.dart';
import 'package:feedin/src/features/messages/message_models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('chat realtime events', () {
    test('parses typing, presence, and read receipt rows', () {
      final typing = ChatRealtimeEvent.fromTypingRow({
        'user_id': 'other-user',
        'activity': 'typing',
        'updated_at': '2026-07-14T10:00:00Z',
      }, currentUserId: 'current-user');
      final presence = ChatRealtimeEvent.fromPresenceRow({
        'user_id': 'other-user',
        'status': 'online',
        'last_seen_at': '2026-07-14T10:01:00Z',
        'updated_at': '2026-07-14T10:02:00Z',
      }, currentUserId: 'current-user');
      final receipt = ChatRealtimeEvent.fromReadReceiptRow({
        'user_id': 'other-user',
        'message_id': 'message-1',
        'read_at': '2026-07-14T10:03:00Z',
      }, currentUserId: 'current-user');

      expect(typing?.type, ChatRealtimeEventType.typing);
      expect(typing?.activity, 'typing');
      expect(
        typing?.occurredAtMillis,
        DateTime.parse('2026-07-14T10:00:00Z').millisecondsSinceEpoch,
      );
      expect(presence?.type, ChatRealtimeEventType.presence);
      expect(presence?.presence, 'online');
      expect(
        presence?.occurredAtMillis,
        DateTime.parse('2026-07-14T10:01:00Z').millisecondsSinceEpoch,
      );
      expect(receipt?.type, ChatRealtimeEventType.readReceipt);
      expect(receipt?.messageId, 'message-1');
    });

    test('drops rows emitted by the current user', () {
      expect(
        ChatRealtimeEvent.fromTypingRow({
          'user_id': 'current-user',
          'activity': 'typing',
        }, currentUserId: 'current-user'),
        isNull,
      );
      expect(
        ChatRealtimeEvent.fromPresenceRow({
          'user_id': 'current-user',
          'status': 'online',
        }, currentUserId: 'current-user'),
        isNull,
      );
      expect(
        ChatRealtimeEvent.fromReadReceiptRow({
          'user_id': 'current-user',
          'message_id': 'message-1',
        }, currentUserId: 'current-user'),
        isNull,
      );
    });
  });

  group('chat activity and presence mapping', () {
    test('expires stale live and away presence rows', () {
      expect(
        presenceStateFromWire('online', lastSeenMillis: 1000, nowMillis: 91000),
        PresenceState.online,
      );
      expect(
        presenceStateFromWire('online', lastSeenMillis: 1000, nowMillis: 91001),
        PresenceState.offline,
      );
      expect(
        presenceStateFromWire('away', lastSeenMillis: 1000, nowMillis: 301001),
        PresenceState.offline,
      );
    });

    test('expires stale typing rows and maps idle to none', () {
      expect(
        chatActivityFromWire('typing', updatedAtMillis: 1000, nowMillis: 7000),
        ChatActivity.typing,
      );
      expect(
        chatActivityFromWire('typing', updatedAtMillis: 1000, nowMillis: 7001),
        ChatActivity.none,
      );
      expect(chatActivityFromWire('idle'), ChatActivity.none);
    });
  });

  group('read receipt mapping', () {
    test('marks only outgoing messages read by the other participant', () {
      final outgoing = RemoteMessage.fromJson(
        {
          'id': 'outgoing',
          'conversation_id': 'conversation-1',
          'sender_id': 'current-user',
          'content': 'Hello',
          'status': 'delivered',
          'reply_to_id': 'parent-message',
          'created_at': '2026-07-14T10:00:00Z',
        },
        viewerId: 'current-user',
        otherLastReadAtMillis: DateTime.parse(
          '2026-07-14T10:01:00Z',
        ).millisecondsSinceEpoch,
        otherReaderUserId: 'other-user',
      );
      final incoming = RemoteMessage.fromJson(
        {
          'id': 'incoming',
          'conversation_id': 'conversation-1',
          'sender_id': 'other-user',
          'content': 'Hi',
          'status': 'delivered',
          'created_at': '2026-07-14T10:00:00Z',
        },
        viewerId: 'current-user',
        otherLastReadAtMillis: DateTime.parse(
          '2026-07-14T10:01:00Z',
        ).millisecondsSinceEpoch,
        otherReaderUserId: 'other-user',
      );

      expect(outgoing.deliveryStateName, 'read');
      expect(outgoing.readByUserId, 'other-user');
      expect(outgoing.readAtMillis, isNotNull);
      expect(outgoing.replyToId, 'parent-message');
      expect(incoming.deliveryStateName, 'delivered');
      expect(incoming.readByUserId, isNull);
      expect(incoming.readAtMillis, isNull);
    });

    test('creates receipt views only for the current user messages', () {
      const readAt = 123456;
      final views = localMessagesToViews(const [
        LocalMessage(
          id: 'outgoing',
          conversationId: 'conversation-1',
          senderName: 'Me',
          senderId: 'current-user',
          body: 'Hello',
          createdAtMillis: 1,
          deliveryState: MessageDeliveryState.read,
          readAtMillis: readAt,
          readByUserId: 'other-user',
        ),
        LocalMessage(
          id: 'incoming',
          conversationId: 'conversation-1',
          senderName: 'Other',
          senderId: 'other-user',
          body: 'Hi',
          createdAtMillis: 2,
          deliveryState: MessageDeliveryState.read,
          readAtMillis: readAt,
          readByUserId: 'current-user',
        ),
      ], currentUserKey: 'current-user');

      expect(views.first.readReceipts.single.userId, 'other-user');
      expect(views.first.readReceipts.single.readAtMillis, readAt);
      expect(views.last.readReceipts, isEmpty);
    });

    test(
      'keeps local sender content on the right using profile name fallback',
      () {
        final views = localMessagesToViews(
          const [
            LocalMessage(
              id: 'local-photo',
              conversationId: 'conversation-1',
              senderName: 'Alex Morgan',
              body: 'Photo',
              messageType: 'image',
              localMediaPath: '/tmp/photo.jpg',
              createdAtMillis: 1,
              deliveryState: MessageDeliveryState.pending,
            ),
          ],
          currentUserKey: 'current-user-id',
          currentUserName: 'Alex Morgan',
        );

        expect(views.single.isMine, isTrue);
        expect(views.single.mediaKind, ChatMediaKind.image);
      },
    );

    test('projects reply metadata into the quoted bubble preview', () {
      final views = localMessagesToViews(
        const [
          LocalMessage(
            id: 'parent',
            conversationId: 'conversation-1',
            senderName: 'Sarah',
            senderId: 'other-user',
            body: 'Original message',
            createdAtMillis: 1,
            deliveryState: MessageDeliveryState.delivered,
          ),
          LocalMessage(
            id: 'reply',
            conversationId: 'conversation-1',
            senderName: 'Alex',
            senderId: 'current-user',
            replyToId: 'parent',
            body: 'My reply',
            createdAtMillis: 2,
            deliveryState: MessageDeliveryState.sent,
          ),
        ],
        currentUserKey: 'current-user',
        currentUserName: 'Alex',
      );

      expect(views.last.replyPreview?.messageId, 'parent');
      expect(views.last.replyPreview?.senderName, 'Sarah');
      expect(views.last.replyPreview?.content, 'Original message');
    });

    testWidgets('renders double-blue status and read footer', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ChatMessageBubble(
              message: ChatMessageView(
                id: 'message-1',
                conversationId: 'conversation-1',
                senderId: 'current-user',
                senderName: 'Me',
                createdAtMillis: 1,
                isMine: true,
                deliveryState: DeliveryState.read,
                body: 'Read message',
                readReceipts: [
                  ReadReceiptView(userId: 'other-user', readAtMillis: 1),
                ],
              ),
            ),
          ),
        ),
      );

      final blueDoubleChecks = tester
          .widgetList<Icon>(find.byIcon(Icons.done_all))
          .where((icon) => icon.color == ChatColors.readTick);
      expect(blueDoubleChecks, hasLength(2));
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Text &&
              RegExp(r'^Read \d{2}:\d{2}$').hasMatch(widget.data ?? ''),
        ),
        findsOneWidget,
      );
    });
  });

  testWidgets('composer emits typing once and idle after debounce', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    final events = <bool>[];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ChatComposer(
            controller: controller,
            onSend: () {},
            onAttach: () {},
            onVoice: () {},
            onTypingChanged: events.add,
          ),
        ),
      ),
    );

    controller.text = 'h';
    await tester.pump();
    controller.text = 'hello';
    await tester.pump();
    expect(events, [true]);

    await tester.pump(const Duration(milliseconds: 2999));
    expect(events, [true]);
    await tester.pump(const Duration(milliseconds: 1));
    expect(events, [true, false]);
  });

  testWidgets('composer suggests and inserts a participant mention', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ChatComposer(
            controller: controller,
            mentionSuggestions: const [
              ComposerMention(displayName: 'Sarah Connor', handle: 'sarah'),
            ],
            onSend: () {},
            onAttach: () {},
            onVoice: () {},
          ),
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'Hello @sa');
    await tester.pump();

    expect(find.text('@sarah'), findsOneWidget);
    expect(find.text('Sarah Connor'), findsOneWidget);

    await tester.tap(find.text('@sarah'));
    await tester.pump();
    expect(controller.text, 'Hello @sarah ');
  });
}
