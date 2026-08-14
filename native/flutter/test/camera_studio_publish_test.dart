import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce/hive.dart';

import 'package:feedin/src/core/sync/upload_queue_service.dart';
import 'package:feedin/src/data/local/post_draft_repository.dart';
import 'package:feedin/src/data/local/upload_queue_repository.dart';
import 'package:feedin/src/features/create/camera_studio/studio_post_submission.dart';

void main() {
  late Directory directory;
  late PostDraftRepository drafts;
  late UploadQueueRepository queue;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('studio-publish-test-');
    Hive.init(directory.path);
    drafts = PostDraftRepository(box: await Hive.openBox<Map>('studio-drafts'));
    queue = UploadQueueRepository(box: await Hive.openBox<Map>('studio-queue'));
  });

  tearDown(() async {
    await Hive.close();
    await directory.delete(recursive: true);
  });

  test(
    'retry replaces the failed draft and returns the exact new post',
    () async {
      final service = _SequencedUploadQueueService(
        drafts: drafts,
        queue: queue,
        summaries: const [
          UploadQueueSummary(
            attempted: true,
            uploaded: 1,
            failed: 1,
            message: 'Upload failed.',
            publishedPostIds: ['older-post'],
          ),
          UploadQueueSummary(
            attempted: true,
            uploaded: 2,
            failed: 0,
            message: 'Posts published.',
            publishedPostIds: ['older-post', 'new-post'],
          ),
        ],
      );
      final submission = StudioPostSubmission(
        draftRepository: drafts,
        uploadQueueRepository: queue,
        uploadQueueService: service,
      );

      final failed = await submission.submit(
        const StudioPostSubmissionInput(
          caption: 'Keep this caption',
          mediaPath: '/tmp/photo.jpg',
          isVideo: false,
          privacy: 'everyone',
          filterId: 'vintage',
        ),
      );

      expect(failed.publishedPostId, isNull);
      expect(await queue.count(), 1);
      expect(await drafts.loadDrafts(), hasLength(1));

      final published = await submission.submit(
        const StudioPostSubmissionInput(
          caption: 'Updated caption',
          mediaPath: '/tmp/photo.jpg',
          isVideo: false,
          privacy: 'friends',
          filterId: 'warm',
        ),
      );

      expect(published.publishedPostId, 'new-post');
      expect(await queue.count(), 1);
      final remainingDrafts = await drafts.loadDrafts();
      expect(remainingDrafts, hasLength(1));
      expect(remainingDrafts.single.content, 'Updated caption');
      expect(remainingDrafts.single.mediaFilterId, 'warm');
    },
  );
}

class _SequencedUploadQueueService extends UploadQueueService {
  _SequencedUploadQueueService({
    required PostDraftRepository drafts,
    required UploadQueueRepository queue,
    required List<UploadQueueSummary> summaries,
  }) : _summaries = List.of(summaries),
       super(
         isConfigured: false,
         draftRepository: drafts,
         uploadQueueRepository: queue,
       );

  final List<UploadQueueSummary> _summaries;

  @override
  Future<UploadQueueSummary> processQueue() async => _summaries.removeAt(0);
}
