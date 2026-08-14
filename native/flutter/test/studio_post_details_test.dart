import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';

import 'package:feedin/src/features/create/camera_studio/studio_filters.dart';
import 'package:feedin/src/features/create/camera_studio/studio_post_details.dart';
import 'package:feedin/src/features/create/parity/create_view_models.dart';

void main() {
  testWidgets('details keeps media full-screen with publishing controls', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: StudioPostDetails(
          file: XFile('/missing/photo.jpg'),
          isVideo: false,
          filter: kStudioFilters.first,
          caption: '',
          privacy: PostPrivacy.everyone,
          isSubmitting: false,
          onBack: () {},
          onCaptionChanged: (_) {},
          onPrivacyChanged: (_) {},
          onFilterChanged: (_) {},
          onSubmit: () {},
        ),
      ),
    );

    expect(find.byKey(const Key('studio-post-details')), findsOneWidget);
    expect(find.byKey(const Key('studio-post-media-preview')), findsOneWidget);
    expect(find.byKey(const Key('studio-post-caption')), findsOneWidget);
    expect(find.byKey(const Key('studio-post-filter')), findsOneWidget);
    expect(find.byKey(const Key('studio-post-privacy')), findsOneWidget);
    expect(find.byKey(const Key('studio-post-submit')), findsOneWidget);
  });

  testWidgets('video details shows a full-screen initializing preview', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: StudioPostDetails(
          file: XFile('/missing/video.mp4'),
          isVideo: true,
          filter: kStudioFilters.first,
          caption: '',
          privacy: PostPrivacy.everyone,
          isSubmitting: false,
          onBack: () {},
          onCaptionChanged: (_) {},
          onPrivacyChanged: (_) {},
          onFilterChanged: (_) {},
          onSubmit: () {},
        ),
      ),
    );

    expect(find.byKey(const Key('studio-post-video-loading')), findsOneWidget);
    expect(find.byKey(const Key('studio-post-filter')), findsNothing);
  });
}
