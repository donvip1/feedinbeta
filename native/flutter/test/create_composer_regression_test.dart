import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/create/parity/create_view_models.dart';
import 'package:feedin/src/features/create/parity/widgets/composer_media_carousel.dart';
import 'package:feedin/src/features/create/parity/widgets/post_composer_panel.dart';

void main() {
  testWidgets('uninitialized video shows an explicit loading surface', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ComposerMediaCarousel(
            items: [
              ComposerMediaItem(
                id: 'video-1',
                path: '/missing/preview.mp4',
                kind: CreateMediaKind.video,
              ),
            ],
            currentIndex: 0,
            onIndexChanged: (_) {},
            onRemove: (_) {},
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('composer-video-loading')), findsOneWidget);
    expect(find.text('Preparing video preview…'), findsOneWidget);
  });

  testWidgets('filter remains available for the active second image', (
    tester,
  ) async {
    String? targetedMediaId;
    String? selectedFilterId;
    final media = [
      const ComposerMediaItem(
        id: 'image-1',
        path: '/missing/one.jpg',
        kind: CreateMediaKind.image,
      ),
      const ComposerMediaItem(
        id: 'image-2',
        path: '/missing/two.jpg',
        kind: CreateMediaKind.image,
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PostComposerPanel(
            showHeader: false,
            view: PostComposerView(media: media, currentPreviewIndex: 1),
            callbacks: PostComposerCallbacks(
              onCaptionChanged: (_) {},
              onHashtagsChanged: (_) {},
              onRemoveHashtag: (_) {},
              onPrivacyChanged: (_) {},
              onAddMedia: () {},
              onRemoveMedia: (_) {},
              onPreviewIndexChanged: (_) {},
              onFilterChanged: (mediaId, filterId) {
                targetedMediaId = mediaId;
                selectedFilterId = filterId;
              },
              onSubmit: () {},
            ),
          ),
        ),
      ),
    );

    final filterLabel = find.text('Filter');
    expect(filterLabel, findsOneWidget);
    await tester.ensureVisible(filterLabel);
    await tester.tap(filterLabel);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cool'));

    expect(targetedMediaId, 'image-2');
    expect(selectedFilterId, 'cool');
  });

  test('filter update follows media ID after reordering', () {
    const first = ComposerMediaItem(
      id: 'image-1',
      path: '/tmp/one.jpg',
      kind: CreateMediaKind.image,
    );
    const second = ComposerMediaItem(
      id: 'image-2',
      path: '/tmp/two.jpg',
      kind: CreateMediaKind.image,
    );

    final updated = updateComposerMediaFilter(
      const [second, first],
      mediaId: 'image-1',
      filterId: 'vintage',
    );

    expect(updated[0].filterId, 'original');
    expect(updated[1].filterId, 'vintage');
  });
}
