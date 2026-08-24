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
            isMoreExpanded: expanded,
            onLike: () {},
            onComment: () {},
            onRefeed: () {},
            onMore: onMore ?? () {},
            onGift: () {},
            onShare: () {},
          ),
        ),
      ),
    );
  }

  testWidgets('Share is a default action; Save is gone from the rail', (
    tester,
  ) async {
    await tester.pumpWidget(host(expanded: false));

    expect(find.byKey(const Key('feed-action-like')), findsOneWidget);
    expect(find.byKey(const Key('feed-action-comment')), findsOneWidget);
    expect(find.byKey(const Key('feed-action-refeed')), findsOneWidget);
    expect(find.byKey(const Key('feed-action-gift')), findsOneWidget);
    // Share is now a consolidated, default-visible action (opens the drawer).
    expect(find.byKey(const Key('feed-action-share')), findsOneWidget);
    // Save is no longer a rail button — it lives inside the share drawer.
    expect(find.byKey(const Key('feed-action-save')), findsNothing);
    // Views still hides until More.
    expect(find.byIcon(Icons.visibility_outlined), findsNothing);
    expect(find.byKey(const Key('feed-action-more')), findsOneWidget);
  });

  testWidgets('Expanded More reveals only Views inline', (tester) async {
    await tester.pumpWidget(host(expanded: true));
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.byKey(const Key('feed-action-share')), findsOneWidget);
    expect(find.byKey(const Key('feed-action-save')), findsNothing);
    expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
  });

  testWidgets('Action buttons sit on a transparent background (no fill)', (
    tester,
  ) async {
    await tester.pumpWidget(host(expanded: false));

    // The old glass chip drew a filled circular DecoratedBox behind each icon.
    // With the transparent restyle there should be no such shape decoration
    // inside the like action.
    final decorated = find.descendant(
      of: find.byKey(const Key('feed-action-like')),
      matching: find.byType(DecoratedBox),
    );
    expect(decorated, findsNothing);
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
