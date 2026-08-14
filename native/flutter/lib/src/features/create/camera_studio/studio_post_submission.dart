import '../../../core/sync/upload_queue_service.dart';
import '../../../data/local/post_draft_repository.dart';
import '../../../data/local/upload_queue_repository.dart';
import '../post_draft.dart';

class StudioPostSubmissionInput {
  const StudioPostSubmissionInput({
    required this.caption,
    required this.mediaPath,
    required this.isVideo,
    required this.privacy,
    required this.filterId,
  });

  final String caption;
  final String mediaPath;
  final bool isVideo;
  final String privacy;
  final String filterId;
}

class StudioPostSubmissionResult {
  const StudioPostSubmissionResult({
    required this.summary,
    required this.publishedPostId,
  });

  final UploadQueueSummary summary;
  final String? publishedPostId;
}

/// Owns one Camera Studio submission across retries.
///
/// A failed attempt remains queued for recovery. If the user retries from the
/// same full-screen composer, that stale attempt is replaced with the latest
/// caption, privacy, and filter instead of creating duplicate drafts.
class StudioPostSubmission {
  StudioPostSubmission({
    required PostDraftRepository draftRepository,
    required UploadQueueRepository uploadQueueRepository,
    required UploadQueueService uploadQueueService,
  }) : _draftRepository = draftRepository,
       _uploadQueueRepository = uploadQueueRepository,
       _uploadQueueService = uploadQueueService;

  final PostDraftRepository _draftRepository;
  final UploadQueueRepository _uploadQueueRepository;
  final UploadQueueService _uploadQueueService;

  String? _pendingDraftId;

  Future<StudioPostSubmissionResult> submit(
    StudioPostSubmissionInput input,
  ) async {
    final previousDraftId = _pendingDraftId;
    if (previousDraftId != null) {
      await _uploadQueueRepository.remove(previousDraftId);
      await _draftRepository.deleteDraft(previousDraftId);
      _pendingDraftId = null;
    }

    final mediaType = input.isVideo ? 'video' : 'image';
    final filterId = input.isVideo ? 'original' : input.filterId;
    final draft = await _draftRepository.saveDraft(
      content: input.caption,
      mediaPath: input.mediaPath,
      mediaType: mediaType,
      mediaPaths: [input.mediaPath],
      mediaTypes: [mediaType],
      privacy: input.privacy,
      mediaFilterId: input.isVideo ? null : filterId,
      mediaFilterIds: [filterId],
    );
    _pendingDraftId = draft.id;
    await _uploadQueueRepository.enqueueDraft(draft.id);
    await _draftRepository.markState(
      draftId: draft.id,
      uploadState: DraftUploadState.queued,
    );

    final summary = await _uploadQueueService.processQueue();
    final publishedPostId = summary.failed == 0
        ? summary.publishedPostIds.lastOrNull
        : null;
    if (publishedPostId != null) _pendingDraftId = null;
    return StudioPostSubmissionResult(
      summary: summary,
      publishedPostId: publishedPostId,
    );
  }
}
