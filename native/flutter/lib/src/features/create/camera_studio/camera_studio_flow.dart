enum StudioFlowStage { capture, review, details }

class StudioFlowState {
  const StudioFlowState.capture()
    : stage = StudioFlowStage.capture,
      mediaPath = null,
      isVideo = false,
      filterId = 'original';

  const StudioFlowState.review({
    required String this.mediaPath,
    required this.isVideo,
    this.filterId = 'original',
  }) : stage = StudioFlowStage.review;

  const StudioFlowState._({
    required this.stage,
    required this.mediaPath,
    required this.isVideo,
    required this.filterId,
  });

  final StudioFlowStage stage;
  final String? mediaPath;
  final bool isVideo;
  final String filterId;

  StudioFlowState showDetails() => StudioFlowState._(
    stage: StudioFlowStage.details,
    mediaPath: mediaPath,
    isVideo: isVideo,
    filterId: filterId,
  );

  StudioFlowState showReview() => StudioFlowState._(
    stage: StudioFlowStage.review,
    mediaPath: mediaPath,
    isVideo: isVideo,
    filterId: filterId,
  );

  StudioFlowState withFilter(String filterId) => StudioFlowState._(
    stage: stage,
    mediaPath: mediaPath,
    isVideo: isVideo,
    filterId: filterId,
  );
}
