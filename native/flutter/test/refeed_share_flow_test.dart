import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/feed_share_service.dart';
import 'package:feedin/src/features/feed/immersive/caption_layer.dart';
import 'package:feedin/src/features/feed/immersive/caption_text.dart';
import 'package:feedin/src/features/feed/immersive/refeed_sheet.dart';

void main() {
  const post = FeedPost(
    id: 'wrapper-1',
    userId: 'refeeder',
    authorName: 'Refeeder',
    body: '',
    meta: '@refeeder',
    createdAtMillis: 2,
    postType: 'refeed',
    originalPostId: 'original-42',
    originalPost: FeedPost(
      id: 'original-42',
      userId: 'author-1',
      authorName: 'Ada Lovelace',
      body: 'A thoughtful post.',
      meta: '@ada',
      createdAtMillis: 1,
      authorHandle: '@ada',
    ),
  );

  test('share payload uses the canonical displayed post link', () {
    const service = FeedShareService();

    expect(service.postUrl(post), 'https://feedinn.com/feed/post/original-42');
    expect(service.shareText(post), contains('Ada Lovelace on feedIn'));
    expect(service.shareText(post), contains('A thoughtful post.'));
    expect(
      service.shareText(post),
      contains('https://feedinn.com/feed/post/original-42'),
    );
  });

  testWidgets('Quote Refeed renders wrapper quote and embedded original', (
    tester,
  ) async {
    const quote = FeedPost(
      id: 'quote-1',
      userId: 'quoter',
      authorName: 'Grace Hopper',
      body: 'This context matters.',
      meta: '@grace',
      createdAtMillis: 3,
      postType: 'refeed',
      originalPostId: 'original-42',
      originalPost: FeedPost(
        id: 'original-42',
        userId: 'author-1',
        authorName: 'Ada Lovelace',
        body: 'A thoughtful post.',
        meta: '@ada',
        createdAtMillis: 1,
      ),
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomLeft,
            child: CaptionLayer(post: quote),
          ),
        ),
      ),
    );

    final quoteCaption = tester.widget<ExpandableCaption>(
      find.byKey(const Key('post-caption-quote-1')),
    );
    expect(quoteCaption.text, 'This context matters.');
    expect(find.byKey(const Key('quote-refeed-original')), findsOneWidget);
    expect(find.text('A thoughtful post.'), findsOneWidget);
  });

  testWidgets('Refeed opens choices without immediately mutating', (
    tester,
  ) async {
    RefeedAction? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () async {
                selected = await showRefeedActionSheet(
                  context,
                  isRefeeded: false,
                );
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(selected, isNull);
    expect(find.text('Refeed'), findsOneWidget);
    expect(find.text('Quote Refeed'), findsOneWidget);

    await tester.tap(find.text('Refeed'));
    await tester.pumpAndSettle();
    expect(selected, RefeedAction.refeed);
  });

  testWidgets('Quote Refeed requires text before posting', (tester) async {
    String? quote;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () async {
                quote = await showQuoteRefeedComposer(context, post: post);
              },
              child: const Text('Quote'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Quote'));
    await tester.pumpAndSettle();

    final postButton = tester.widget<TextButton>(
      find.widgetWithText(TextButton, 'Post'),
    );
    expect(postButton.onPressed, isNull);

    await tester.enterText(
      find.byKey(const Key('quote-refeed-field')),
      'This adds useful context.',
    );
    await tester.pump();
    final enabledPostButton = tester.widget<TextButton>(
      find.widgetWithText(TextButton, 'Post'),
    );
    expect(enabledPostButton.onPressed, isNotNull);

    await tester.tap(find.widgetWithText(TextButton, 'Post'));
    await tester.pumpAndSettle();
    expect(quote, 'This adds useful context.');
  });

  testWidgets('Share actions expose native share and Copy Link', (
    tester,
  ) async {
    FeedShareAction? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () async {
                selected = await showFeedShareSheet(context, post: post);
              },
              child: const Text('Share'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Share'));
    await tester.pumpAndSettle();

    expect(find.text('Share to...'), findsOneWidget);
    expect(find.text('Copy Link'), findsOneWidget);
    await tester.tap(find.text('Copy Link'));
    await tester.pumpAndSettle();
    expect(selected, FeedShareAction.copyLink);
  });
}
