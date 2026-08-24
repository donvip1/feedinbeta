import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/immersive/caption_layer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const original = FeedPost(
    id: 'orig',
    userId: 'original-author',
    authorName: 'Original Author',
    body: 'the original caption',
    meta: '@original',
    authorHandle: '@original',
    createdAtMillis: 1,
  );

  const quoteRefeed = FeedPost(
    id: 'wrap',
    userId: 'reposter',
    authorName: 'Reposter',
    body: 'my added thoughts',
    meta: '@reposter',
    authorHandle: '@reposter',
    createdAtMillis: 2,
    originalPost: original,
  );

  Widget host(FeedPost post, {VoidCallback? onOpen}) => MaterialApp(
    home: Scaffold(
      backgroundColor: Colors.black,
      body: CaptionLayer(post: post, onOpenOriginalPost: onOpen),
    ),
  );

  testWidgets('tapping the quote card opens the original POST (not a profile)', (
    tester,
  ) async {
    var opens = 0;
    await tester.pumpWidget(host(quoteRefeed, onOpen: () => opens++));

    final quoted = find.byKey(const Key('quote-refeed-original'));
    expect(quoted, findsOneWidget);

    await tester.tap(quoted);
    expect(opens, 1);
  });

  testWidgets('quoted author identity renders once, on one line', (
    tester,
  ) async {
    await tester.pumpWidget(host(quoteRefeed, onOpen: () {}));

    // Name appears once; handle appears once (no stacked/duplicate block).
    expect(find.text('Original Author'), findsOneWidget);
    expect(
      find.textContaining('@original'),
      findsOneWidget,
    );
  });

  testWidgets('quote of a quote renders flat — no nested quote card', (
    tester,
  ) async {
    const innerQuote = FeedPost(
      id: 'inner',
      userId: 'a',
      authorName: 'Inner',
      body: 'inner text',
      meta: '@inner',
      authorHandle: '@inner',
      createdAtMillis: 1,
      originalPost: original, // inner is itself a quote
    );
    const outer = FeedPost(
      id: 'outer',
      userId: 'b',
      authorName: 'Outer',
      body: 'outer thoughts',
      meta: '@outer',
      authorHandle: '@outer',
      createdAtMillis: 2,
      originalPost: innerQuote,
    );

    await tester.pumpWidget(host(outer, onOpen: () {}));

    // Exactly one embedded quote card (the innermost content is flattened in).
    expect(find.byKey(const Key('quote-refeed-original')), findsOneWidget);
  });

  testWidgets('deleted/unavailable original shows a non-tappable placeholder', (
    tester,
  ) async {
    const deleted = FeedPost(
      id: 'x',
      userId: 'a',
      authorName: '',
      body: '', // no text
      meta: '',
      createdAtMillis: 1,
      // no media
    );
    const wrapper = FeedPost(
      id: 'w',
      userId: 'b',
      authorName: 'Quoter',
      body: 'look at this',
      meta: '@quoter',
      authorHandle: '@quoter',
      createdAtMillis: 2,
      originalPost: deleted,
    );

    var opens = 0;
    await tester.pumpWidget(host(wrapper, onOpen: () => opens++));

    expect(find.text('This post is unavailable'), findsOneWidget);
    await tester.tap(find.byKey(const Key('quote-refeed-original')));
    expect(opens, 0); // non-tappable
  });
}
