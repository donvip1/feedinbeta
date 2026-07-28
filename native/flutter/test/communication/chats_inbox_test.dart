import 'package:feedin/src/data/remote/messages_remote_data_source.dart';
import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/data/conversation_store.dart';
import 'package:feedin/src/features/communication/domain/conversation.dart';
import 'package:feedin/src/features/communication/transport/conversations_backfill.dart';
import 'package:feedin/src/features/communication/ui/chats_inbox_screen.dart';
import 'package:feedin/src/features/communication/ui/conversation_list_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  group('ConversationsBackfill mapping', () {
    test('server DM row -> unified Conversation with inbox state', () {
      const remote = RemoteConversation(
        serverConversationId: 'c-1',
        title: 'Ada',
        lastMessagePreview: 'see you soon',
        updatedAtMillis: 5000,
        unreadCount: 3,
        otherUserId: 'ada-id',
        otherUserAvatarUrl: 'https://a/x.png',
      );
      final conversation = ConversationsBackfill.conversationFromRemote(
        remote,
        selfUserId: 'me',
      );
      expect(conversation.id, 'c-1');
      expect(conversation.type, ConversationType.dm);
      expect(conversation.memberIds, ['me', 'ada-id']);
      expect(conversation.title, 'Ada');
      expect(conversation.lastMessagePreview, 'see you soon');
      expect(conversation.unreadCount, 3);
      expect(conversation.lastMessageAt, 5000);
      expect(conversation.avatarUrl, 'https://a/x.png');
      // The unified policy applies: both DM members can post + call.
      expect(conversation.canPost('me'), isTrue);
      expect(conversation.canStartCall('me'), isTrue);
    });

    test('presentation fields round-trip through the store json', () async {
      final db = await CommunicationDatabase.open(
        databaseFactoryFfi,
        inMemoryDatabasePath,
      );
      final store = ConversationStore(db);
      const remote = RemoteConversation(
        serverConversationId: 'c-2',
        title: 'Bo',
        lastMessagePreview: 'photo',
        updatedAtMillis: 9000,
        unreadCount: 1,
        otherUserId: 'bo-id',
      );
      await store.upsert(
        ConversationsBackfill.conversationFromRemote(remote, selfUserId: 'me'),
      );
      final loaded = (await store.getById('c-2'))!;
      expect(loaded.unreadCount, 1);
      expect(loaded.lastMessagePreview, 'photo');
      expect(loaded.title, 'Bo');
      await db.close();
    });
  });

  group('ConversationListController', () {
    late CommunicationDatabase db;
    late ConversationStore store;

    setUp(() async {
      db = await CommunicationDatabase.open(
        databaseFactoryFfi,
        inMemoryDatabasePath,
      );
      store = ConversationStore(db);
    });

    tearDown(() => db.close());

    Conversation dm(String id, {int at = 0, int unread = 0}) => Conversation(
      id: id,
      type: ConversationType.dm,
      memberIds: const ['me', 'peer'],
      title: id,
      lastMessageAt: at,
      unreadCount: unread,
    );

    test('loads the inbox newest-first and runs the backfill first', () async {
      var backfilled = 0;
      final controller = ConversationListController(
        store: store,
        backfill: () async {
          backfilled += 1;
          await store.upsert(dm('old', at: 100));
          await store.upsert(dm('new', at: 200));
          return 2;
        },
      );
      await controller.init();
      expect(backfilled, 1);
      expect(controller.loading, isFalse);
      expect(controller.conversations.map((c) => c.id).toList(), [
        'new',
        'old',
      ]);
      controller.dispose();
    });

    test(
      'backfill failure still surfaces the local inbox (stale > empty)',
      () async {
        await store.upsert(dm('kept', at: 100));
        final controller = ConversationListController(
          store: store,
          backfill: () async => throw Exception('offline'),
        );
        await controller.init();
        expect(controller.conversations.single.id, 'kept');
        controller.dispose();
      },
    );
  });

  group('ChatsInboxScreen widget', () {
    testWidgets('renders banner, tiles, unread badge; taps dispatch', (
      tester,
    ) async {
      late CommunicationDatabase db;
      late ConversationListController controller;
      await tester.runAsync(() async {
        db = await CommunicationDatabase.open(
          databaseFactoryFfi,
          inMemoryDatabasePath,
        );
        final store = ConversationStore(db);
        await store.upsert(
          const Conversation(
            id: 'c-1',
            type: ConversationType.dm,
            memberIds: ['me', 'ada'],
            title: 'Ada',
            lastMessagePreview: 'see you soon',
            lastMessageAt: 100,
            unreadCount: 2,
          ),
        );
        controller = ConversationListController(store: store);
        await controller.init();
      });

      String? opened;
      String? voice;
      String? video;
      await tester.pumpWidget(
        MaterialApp(
          home: ChatsInboxScreen(
            controller: controller,
            online: true,
            onOpenConversation: (c) => opened = c.id,
            onVoiceCall: (c) => voice = c.id,
            onVideoCall: (c) => video = c.id,
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Messages & Calls'), findsOneWidget);
      expect(find.text('LiveKit SFU Secure Plane'), findsOneWidget);
      expect(find.text('Ada'), findsOneWidget);
      expect(find.text('see you soon'), findsOneWidget);
      expect(find.text('2'), findsOneWidget); // unread badge

      await tester.tap(find.bySemanticsLabel('Voice call'));
      expect(voice, 'c-1');
      await tester.tap(find.bySemanticsLabel('Video call'));
      expect(video, 'c-1');
      await tester.tap(find.text('Ada'));
      expect(opened, 'c-1');

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      controller.dispose();
      await tester.runAsync(db.close);
    });

    testWidgets('shows truthful offline status and caps large unread badges', (
      tester,
    ) async {
      late CommunicationDatabase db;
      late ConversationListController controller;
      await tester.runAsync(() async {
        db = await CommunicationDatabase.open(
          databaseFactoryFfi,
          inMemoryDatabasePath,
        );
        final store = ConversationStore(db);
        await store.upsert(
          const Conversation(
            id: 'c-large',
            type: ConversationType.dm,
            memberIds: ['me', 'ada'],
            title: 'A very long conversation title that must not overflow',
            lastMessagePreview: 'cached while offline',
            lastMessageAt: 100,
            unreadCount: 120,
          ),
        );
        controller = ConversationListController(store: store);
        await controller.init();
      });

      await tester.pumpWidget(
        MaterialApp(
          home: ChatsInboxScreen(
            controller: controller,
            online: false,
            onOpenConversation: (_) {},
            onVoiceCall: (_) {},
            onVideoCall: (_) {},
          ),
        ),
      );
      await tester.pump();

      expect(find.text('OFFLINE'), findsOneWidget);
      expect(
        find.text('Encrypted media • Waiting for connection'),
        findsOneWidget,
      );
      expect(find.text('99+'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      controller.dispose();
      await tester.runAsync(db.close);
    });
  });
}
