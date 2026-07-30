import 'package:flutter/material.dart';

import '../../core/sync/upload_queue_service.dart';
import '../../data/local/post_draft_repository.dart';
import '../../data/local/upload_queue_repository.dart';
import 'parity/create_tokens.dart';
import 'parity/create_view_models.dart';
import 'parity/widgets/upload_queue_panel.dart';
import 'post_draft.dart';

/// Stable destination for locally saved drafts and queued uploads.
class DraftsUploadsScreen extends StatefulWidget {
  const DraftsUploadsScreen({
    super.key,
    required this.draftRepository,
    required this.uploadQueueRepository,
    required this.uploadQueueService,
    required this.onPostUploaded,
  });

  final PostDraftRepository draftRepository;
  final UploadQueueRepository uploadQueueRepository;
  final UploadQueueService uploadQueueService;
  final ValueChanged<String?> onPostUploaded;

  @override
  State<DraftsUploadsScreen> createState() => _DraftsUploadsScreenState();
}

class _DraftsUploadsScreenState extends State<DraftsUploadsScreen> {
  List<UploadQueueItemView> _items = const [];
  QueueSummaryView? _summary;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final drafts = await widget.draftRepository.loadDrafts();
    final queue = await widget.uploadQueueRepository.loadQueuedItems();
    final queuedIds = {for (final item in queue) item.draftId};
    final queueByDraft = {for (final item in queue) item.draftId: item};

    final items = drafts
        .map(
          (draft) => UploadQueueItemView(
            draftId: draft.id,
            title: draft.content.isEmpty ? 'Media draft' : draft.content,
            status: _statusFor(draft, queuedIds.contains(draft.id)),
            createdAtMillis: draft.createdAtMillis,
            mediaType: draft.mediaType,
            progress: _progressFor(draft, queueByDraft[draft.id]?.progress),
            retryCount: queueByDraft[draft.id]?.retryCount ?? 0,
          ),
        )
        .toList(growable: false);

    if (!mounted) return;
    setState(() {
      _items = items;
      _loading = false;
    });
  }

  DraftStatus _statusFor(PostDraft draft, bool isQueued) {
    return switch (draft.uploadState) {
      DraftUploadState.uploading => DraftStatus.uploading,
      DraftUploadState.uploaded => DraftStatus.uploaded,
      DraftUploadState.failed => DraftStatus.failed,
      DraftUploadState.queued => DraftStatus.queued,
      DraftUploadState.local =>
        isQueued ? DraftStatus.queued : DraftStatus.local,
    };
  }

  int? _progressFor(PostDraft draft, int? queueProgress) {
    return switch (draft.uploadState) {
      DraftUploadState.uploading => queueProgress?.clamp(1, 99) ?? 10,
      DraftUploadState.uploaded => 100,
      DraftUploadState.queued => queueProgress?.clamp(0, 99) ?? 0,
      DraftUploadState.failed || DraftUploadState.local => null,
    };
  }

  UploadQueueCallbacks get _callbacks => UploadQueueCallbacks(
    onRetry: _queue,
    onCancel: _cancel,
    onQueue: _queue,
    onDelete: _delete,
    onRefresh: _refresh,
  );

  Future<void> _queue(String draftId) async {
    await widget.uploadQueueRepository.enqueueDraft(draftId);
    await widget.draftRepository.markState(
      draftId: draftId,
      uploadState: DraftUploadState.queued,
    );
    final summary = await widget.uploadQueueService.processQueue();
    for (final postId in summary.publishedPostIds) {
      widget.onPostUploaded(postId);
    }
    if (!mounted) return;
    setState(() => _summary = _summaryView(summary));
    await _refresh();
  }

  Future<void> _cancel(String draftId) async {
    await widget.uploadQueueRepository.remove(draftId);
    await widget.draftRepository.markState(
      draftId: draftId,
      uploadState: DraftUploadState.local,
    );
    await _refresh();
  }

  Future<void> _delete(String draftId) async {
    await widget.uploadQueueRepository.remove(draftId);
    await widget.draftRepository.deleteDraft(draftId);
    await _refresh();
  }

  QueueSummaryView _summaryView(UploadQueueSummary summary) {
    return QueueSummaryView(
      message: summary.message,
      isError: summary.failed > 0,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CreateColors.background,
      appBar: AppBar(title: const Text('Drafts and uploads')),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _refresh,
                child: ListView(
                  key: const Key('drafts-uploads-list'),
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(CreateSpacing.lg),
                  children: [
                    UploadQueuePanel(
                      items: _items,
                      callbacks: _callbacks,
                      summary: _summary,
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
