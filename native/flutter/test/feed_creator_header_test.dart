import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/immersive/creator_header.dart';
import 'package:feedin/src/features/feed/immersive/immersive_post_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders avatar identity badges and post context', (
    tester,
  ) async {
    var profileTaps = 0;
    var followTaps = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          backgroundColor: Colors.black,
          body: CreatorHeader(
            authorName: 'Ada Lovelace',
            handle: '@ada',
            avatarUrl: null,
            isVerified: true,
            badgeTier: FeedAuthorBadgeTier.premium,
            metadata: '2h · Lagos',
            onProfileTap: () => profileTaps++,
            onFollow: () => followTaps++,
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('feed-author-avatar')), findsOneWidget);
    expect(find.text('Ada Lovelace'), findsOneWidget);
    expect(find.text('Premium'), findsOneWidget);
    // Username, timestamp, and location render together on one line.
    expect(find.text('@ada · 2h · Lagos'), findsOneWidget);
    expect(
      find.byKey(const Key('feed-author-secondary-line')),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.verified_rounded), findsOneWidget);

    await tester.tap(find.byKey(const Key('feed-author-profile')));
    await tester.tap(find.byKey(const Key('feed-author-follow')));
    expect(profileTaps, 1);
    expect(followTaps, 1);
  });

  testWidgets('omits badge follow and metadata when unavailable', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          backgroundColor: Colors.black,
          body: CreatorHeader(
            authorName: 'User',
            handle: '@user',
            avatarUrl: null,
            isVerified: false,
            badgeTier: FeedAuthorBadgeTier.none,
            metadata: '',
            onProfileTap: () {},
          ),
        ),
      ),
    );

    expect(find.text('Premium'), findsNothing);
    expect(find.text('Pro'), findsNothing);
    expect(find.byIcon(Icons.verified_rounded), findsNothing);
    expect(find.byKey(const Key('feed-author-follow')), findsNothing);
  });

  testWidgets('keeps follow on the identity line after the Pro badge', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 240));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          backgroundColor: Colors.black,
          body: CreatorHeader(
            authorName: 'A very long creator name',
            handle: '@creator',
            avatarUrl: null,
            isVerified: true,
            badgeTier: FeedAuthorBadgeTier.pro,
            metadata: 'Now · Public',
            onProfileTap: () {},
            onFollow: () {},
          ),
        ),
      ),
    );

    final name = tester.getCenter(find.text('A very long creator name'));
    final badge = tester.getTopLeft(find.text('Pro'));
    final follow = tester.getCenter(
      find.byKey(const Key('feed-author-follow')),
    );
    expect(follow.dy, closeTo(name.dy, 2));
    expect(badge.dx, lessThan(follow.dx));
    expect(tester.takeException(), isNull);
  });

  testWidgets('immersive post places one author header in the top half', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const post = FeedPost(
      id: 'post-top-header',
      userId: 'creator-1',
      authorName: 'Top Creator',
      body: 'Caption remains at the bottom.',
      meta: '@top_creator',
      authorHandle: '@top_creator',
      createdAtMillis: 1,
      isAuthorVerified: true,
      authorBadgeTier: FeedAuthorBadgeTier.pro,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ImmersivePostCard(
            post: post,
            isActive: true,
            isLiked: false,
            isRefeeded: false,
            onLike: () {},
            onComment: () {},
            onRefeed: () {},
            onShare: () {},
            onMore: () {},
            onGift: () {},
            onFollow: () {},
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    final header = find.byKey(const Key('feed-author-top-header'));
    expect(header, findsOneWidget);
    expect(tester.getTopLeft(header).dy, lessThan(400));
    expect(find.byType(CreatorHeader), findsOneWidget);
  });
}
