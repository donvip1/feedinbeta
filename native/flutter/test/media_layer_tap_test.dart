import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/immersive/media_layer.dart';
import 'package:feedin/src/features/feed/state/feed_chrome_state_machine.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const photoPost = FeedPost(
    id: 'p1',
    userId: 'u1',
    authorName: 'Pat',
    body: 'a photo',
    meta: '@pat',
    createdAtMillis: 1,
    mediaUrls: ['https://example.com/a.jpg'],
    mediaTypes: ['image'],
  );

  testWidgets('photo tap forwards a chrome toggle intent (wiring guard)', (
    tester,
  ) async {
    FeedSurfaceTapIntent? got;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MediaLayer(
            post: photoPost,
            isActive: true,
            onDoubleTapLike: () {},
            chromeState: FeedChromeVisibility.full,
            onSurfaceTap: (intent) => got = intent,
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey('photo-carousel-page-0')));
    // Let the double-tap-like recognizer time out so the single tap resolves.
    await tester.pump(const Duration(milliseconds: 400));
    // Chrome is full → a photo tap requests hide (full-screen).
    expect(got, FeedSurfaceTapIntent.hide);
  });

  testWidgets('photo tap from hidden chrome requests reveal', (tester) async {
    FeedSurfaceTapIntent? got;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MediaLayer(
            post: photoPost,
            isActive: true,
            onDoubleTapLike: () {},
            chromeState: FeedChromeVisibility.hidden,
            onSurfaceTap: (intent) => got = intent,
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey('photo-carousel-page-0')));
    await tester.pump(const Duration(milliseconds: 400));
    expect(got, FeedSurfaceTapIntent.reveal);
  });
}
