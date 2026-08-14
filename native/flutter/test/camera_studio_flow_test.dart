import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/create/camera_studio/camera_studio_flow.dart';

void main() {
  test('Camera Studio moves review to details without adding a route', () {
    const review = StudioFlowState.review(
      mediaPath: '/tmp/photo.jpg',
      isVideo: false,
      filterId: 'vintage',
    );

    final details = review.showDetails();
    final backToReview = details.showReview();

    expect(details.stage, StudioFlowStage.details);
    expect(details.mediaPath, review.mediaPath);
    expect(details.filterId, 'vintage');
    expect(backToReview.stage, StudioFlowStage.review);
    expect(backToReview.filterId, 'vintage');
  });
}
