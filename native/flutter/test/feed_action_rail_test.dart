import 'package:feedin/src/features/feed/immersive/feed_action_rail.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget host({required bool expanded, VoidCallback? onMore}) {
    return MaterialApp(
      home: Scaffold(
        backgroundColor: Colors.black,
        body: Align(
          alignment: Alignment.centerRight,
          child: FeedActionRail(
            likesCount: 10,
            commentsCount: 4,
            refeedsCount: 2,
            viewsCount: 99,
            isLiked: false,
            isRefeeded: false,
            isSaved: true,
            isMoreExpanded: expanded,
            avatarText: 'Ada',
            onLike: () {},
            onComment: () {},
            onRefeed: () {},
            onMore: onMore ?? () {},
            onSave: () {},
            onGift: () {},
            onShare: () {},
          ),
        ),
      ),
    );
  }

  testWidgets('Gift shows by default, Views hidden until More', (tester) async {
    await tester.pumpWidget(host(expanded: false));

    expect(find.byKey(const Key('feed-action-like')), findsOneWidget);
    expect(find.byKey(const Key('feed-action-comment')), findsOneWidget);
    expect(find.byKey(const Key('feed-action-refeed')), findsOneWidget);
    // Gift is now a default action; Views is no longer shown by default.
    expect(find.byKey(const Key('feed-action-gift')), findsOneWidget);
    expect(find.byIcon(Icons.visibility_outlined), findsNothing);
    expect(find.byKey(const Key('feed-action-more')), findsOneWidget);
    expect(find.byKey(const Key('feed-action-share')), findsNothing);
    expect(find.byKey(const Key('feed-action-share')), findsNothing);
    expect(find.byType(Dialog), findsNothing);
    expect(find.byType(BottomSheet), findsNothing);
  });

  testWidgets('Expanded More reveals the combined save/share action', (
    tester,
  ) async {
    await tester.pumpWidget(host(expanded: true));
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.byKey(const Key('feed-action-share')), findsOneWidget);
    // Gift stays visible and save/share are opened together in one action.
    expect(find.byKey(const Key('feed-action-gift')), findsOneWidget);
    expect(find.byIcon(Icons.bookmark_added_rounded), findsOneWidget);
    expect(find.byType(Dialog), findsNothing);
    expect(find.byType(BottomSheet), findsNothing);
  });

  testWidgets('Visible controls retain accessible tap targets', (tester) async {
    await tester.pumpWidget(host(expanded: true));
    await tester.pump(const Duration(milliseconds: 350));

    for (final key in const [
      Key('feed-action-like'),
      Key('feed-action-comment'),
      Key('feed-action-refeed'),
      Key('feed-action-more'),
      Key('feed-action-gift'),
      Key('feed-action-share'),
    ]) {
      final size = tester.getSize(find.byKey(key));
      expect(size.width, greaterThanOrEqualTo(44));
      expect(size.height, greaterThanOrEqualTo(44));
    }
  });
}
