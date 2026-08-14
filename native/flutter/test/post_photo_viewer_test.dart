import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/feed/immersive/photo_carousel.dart';
import 'package:feedin/src/features/feed/immersive/post_photo_viewer.dart';

void main() {
  testWidgets('opens tapped photo, pages, zooms, and closes', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PhotoCarousel(
            urls: const ['one.jpg', 'two.jpg'],
            localPaths: const [null, null],
            onPhotoTap: (index) {
              Navigator.of(tester.element(find.byType(PhotoCarousel))).push(
                PostPhotoViewer.route(
                  urls: const ['one.jpg', 'two.jpg'],
                  localPaths: const [null, null],
                  initialIndex: index,
                ),
              );
            },
          ),
        ),
      ),
    );

    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('photo-carousel-page-1')));
    await tester.pumpAndSettle();

    expect(find.byType(PostPhotoViewer), findsOneWidget);
    expect(find.byType(InteractiveViewer), findsOneWidget);
    expect(find.text('2 / 2'), findsOneWidget);

    await tester.drag(find.byType(PageView), const Offset(500, 0));
    await tester.pumpAndSettle();
    expect(find.text('1 / 2'), findsOneWidget);

    await tester.tap(find.byKey(const Key('post-photo-viewer-close')));
    await tester.pumpAndSettle();
    expect(find.byType(PostPhotoViewer), findsNothing);
  });
}
