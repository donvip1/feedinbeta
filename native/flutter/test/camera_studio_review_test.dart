import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';

import 'package:feedin/src/features/create/camera_studio/camera_studio_review.dart';
import 'package:feedin/src/features/create/camera_studio/studio_filters.dart';

void main() {
  testWidgets('video review shows an explicit full-screen preview state', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: CameraStudioReview(
          file: XFile('/missing/video.mp4'),
          isVideo: true,
          initialFilter: kStudioFilters.first,
          onRetake: () {},
          onNext: (_) {},
        ),
      ),
    );

    expect(
      find.byKey(const Key('studio-review-video-loading')),
      findsOneWidget,
    );
  });
}
