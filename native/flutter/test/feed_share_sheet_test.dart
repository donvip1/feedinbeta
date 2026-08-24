import 'package:feedin/src/features/feed/share/feed_share_actions.dart';
import 'package:feedin/src/features/feed/share/feed_share_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// In-memory [FeedShareActions] so the drawer can be exercised without
/// Supabase, the gallery, or the OS share sheet.
class _FakeShareActions implements FeedShareActions {
  _FakeShareActions({this.hasMedia = true});

  @override
  final bool hasMedia;
  bool saved = false;

  final List<String> calls = <String>[];

  @override
  bool get isSaved => saved;

  @override
  Future<void> shareToStory() async => calls.add('story');

  @override
  Future<List<ShareTarget>> searchFriends(String query) async {
    calls.add('searchFriends:$query');
    return const [
      ShareTarget(id: 'u1', title: 'Ada', subtitle: '@ada'),
    ];
  }

  @override
  Future<void> sendToFriend(ShareTarget friend) async =>
      calls.add('sendToFriend:${friend.id}');

  @override
  Future<List<ShareTarget>> loadGroups() async {
    calls.add('loadGroups');
    return const [
      ShareTarget(id: 'g1', title: 'Flutter Devs', subtitle: '3 members'),
    ];
  }

  @override
  Future<void> sendToGroup(ShareTarget group) async =>
      calls.add('sendToGroup:${group.id}');

  @override
  Future<void> copyLink() async => calls.add('copyLink');

  @override
  Future<bool> toggleSave() async {
    calls.add('toggleSave');
    saved = !saved;
    return saved;
  }

  @override
  Future<void> download() async => calls.add('download');

  @override
  Future<void> shareExternal() async => calls.add('shareExternal');
}

void main() {
  Future<_FakeShareActions> open(
    WidgetTester tester, {
    bool hasMedia = true,
  }) async {
    final actions = _FakeShareActions(hasMedia: hasMedia);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: ElevatedButton(
                onPressed: () => showFeedShareDrawer(context, actions: actions),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    return actions;
  }

  testWidgets('main view mirrors the web drawer rows', (tester) async {
    await open(tester);

    expect(find.byKey(const Key('share-quick-story')), findsOneWidget);
    expect(find.byKey(const Key('share-quick-friends')), findsOneWidget);
    expect(find.byKey(const Key('share-quick-groups')), findsOneWidget);
    expect(find.byKey(const Key('share-quick-more')), findsOneWidget);
    expect(find.byKey(const Key('share-row-copy')), findsOneWidget);
    expect(find.byKey(const Key('share-row-save')), findsOneWidget);
    expect(find.byKey(const Key('share-row-download')), findsOneWidget);
  });

  testWidgets('Story and Download hidden when the post has no media', (
    tester,
  ) async {
    await open(tester, hasMedia: false);

    expect(find.byKey(const Key('share-quick-story')), findsNothing);
    expect(find.byKey(const Key('share-row-download')), findsNothing);
    // Text-only posts can still be copied and saved.
    expect(find.byKey(const Key('share-row-copy')), findsOneWidget);
    expect(find.byKey(const Key('share-row-save')), findsOneWidget);
  });

  testWidgets('Copy Link runs the action and closes with a message', (
    tester,
  ) async {
    final actions = await open(tester);

    await tester.tap(find.byKey(const Key('share-row-copy')));
    await tester.pumpAndSettle();

    expect(actions.calls, contains('copyLink'));
    expect(find.byKey(const Key('share-row-copy')), findsNothing); // sheet closed
  });

  testWidgets('Friends sub-view searches and sends', (tester) async {
    final actions = await open(tester);

    await tester.tap(find.byKey(const Key('share-quick-friends')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'ad');
    await tester.pumpAndSettle();
    expect(actions.calls, contains('searchFriends:ad'));

    await tester.tap(find.text('Ada'));
    await tester.pumpAndSettle();
    expect(actions.calls, contains('sendToFriend:u1'));
  });

  testWidgets('Groups sub-view loads and sends', (tester) async {
    final actions = await open(tester);

    await tester.tap(find.byKey(const Key('share-quick-groups')));
    await tester.pumpAndSettle();
    expect(actions.calls, contains('loadGroups'));

    await tester.tap(find.text('Flutter Devs'));
    await tester.pumpAndSettle();
    expect(actions.calls, contains('sendToGroup:g1'));
  });
}
