import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/immersive/immersive_video_player.dart';
import 'package:feedin/src/features/feed/immersive/media_layer.dart';
import 'package:feedin/src/features/feed/immersive/photo_carousel.dart';

void main() {
  testWidgets('mixed media chooses video and never applies an image filter', (
    tester,
  ) async {
    const post = FeedPost(
      id: 'mixed',
      userId: 'u',
      authorName: 'A',
      body: '',
      meta: '',
      createdAtMillis: 1,
      mediaUrls: ['one.jpg', 'clip.mp4'],
      mediaTypes: ['image', 'video'],
      mediaFilterIds: ['cool', 'original'],
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: MediaLayer(post: post, isActive: false, onDoubleTapLike: _noop),
      ),
    );

    expect(find.byType(ImmersiveVideoPlayer), findsOneWidget);
    expect(find.byType(PhotoCarousel), findsNothing);
    expect(find.byType(ColorFiltered), findsNothing);
  });

  testWidgets('photo filters remain paired by image index', (tester) async {
    const post = FeedPost(
      id: 'photos',
      userId: 'u',
      authorName: 'A',
      body: '',
      meta: '',
      createdAtMillis: 1,
      mediaUrls: ['one.jpg', 'two.jpg'],
      mediaTypes: ['image', 'image'],
      mediaFilterIds: ['cool', 'original'],
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: MediaLayer(post: post, isActive: false, onDoubleTapLike: _noop),
      ),
    );

    final carousel = tester.widget<PhotoCarousel>(find.byType(PhotoCarousel));
    expect(carousel.colorFilters.first, isNotNull);
    expect(carousel.colorFilters.last, isNull);
  });
}

void _noop() {}
