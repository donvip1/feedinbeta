import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import '../../core/sync/upload_queue_service.dart';
import '../../data/local/post_draft_repository.dart';
import '../../data/local/upload_queue_repository.dart';
import 'parity/create_tokens.dart';
import 'parity/create_view_models.dart';
import 'parity/widgets/post_composer_panel.dart';
import 'parity/widgets/upload_queue_panel.dart';
import 'post_draft.dart';

/// Native Create surface, wired to the parity composer widgets.
///
/// The public constructor is unchanged (see `feed_shell.dart`); only the body
/// was rebuilt to drive [PostComposerPanel] (caption, multi-media, hashtags,
/// privacy), an in-screen capture-method flow, and the [UploadQueuePanel]
/// (drafts + visible upload state).
///
/// This screen owns all I/O: `image_picker`, the draft repository, the upload
/// queue repository, and the upload queue service. The parity widgets stay
/// presentational — they render the immutable views this screen rebuilds and
/// emit intent through callbacks.
class CreatePostScreen extends StatefulWidget {
  const CreatePostScreen({
    super.key,
    required this.draftRepository,
    required this.uploadQueueRepository,
    required this.uploadQueueService,
    required this.onPostUploaded,
  });

  final PostDraftRepository draftRepository;
  final UploadQueueRepository uploadQueueRepository;
  final UploadQueueService uploadQueueService;
  final VoidCallback onPostUploaded;

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

/// Create mode toggle. Live is intentionally excluded from this native version
/// (see the build checklist); story drafts are stored separately and uploaded
/// through the `stories` backend contract.
enum _CreateMode { post, story }

class _CreatePostScreenState extends State<CreatePostScreen> {
  static const _uuid = Uuid();
  final _picker = ImagePicker();

  _CreateMode _mode = _CreateMode.post;

  // Composer state (the screen is the single source of truth; the panel renders
  // an immutable [PostComposerView] rebuilt from these fields).
  String _caption = '';
  String _hashtagsRaw = '';
  List<String> _hashtags = const <String>[];
  PostPrivacy _privacy = PostPrivacy.everyone;
  List<ComposerMediaItem> _media = const <ComposerMediaItem>[];
  int _previewIndex = 0;
  bool _isSubmitting = false;

  // Drafts / queue state.
  List<UploadQueueItemView> _queueRows = const <UploadQueueItemView>[];
  QueueSummaryView? _summary;
  bool _loadingDrafts = true;

  static const int _maxMedia = 10;
  static const int _maxHashtags = 5;

  @override
  void initState() {
    super.initState();
    _refreshDrafts();
  }

  // -------------------------------------------------------------------------
  // Composer view + callbacks
  // -------------------------------------------------------------------------

  PostComposerView get _composerView => PostComposerView(
    caption: _caption,
    hashtagsRaw: _hashtagsRaw,
    hashtags: _hashtags,
    privacy: _privacy,
    media: _media,
    currentPreviewIndex: _previewIndex,
    isSubmitting: _isSubmitting,
    uploadStage: _isSubmitting ? UploadStage.uploading : UploadStage.idle,
    maxHashtags: _maxHashtags,
    maxMedia: _maxMedia,
    requiresMedia: _mode == _CreateMode.story,
  );

  PostComposerCallbacks get _composerCallbacks => PostComposerCallbacks(
    onCaptionChanged: (value) => setState(() => _caption = value),
    onHashtagsChanged: (raw) => setState(() {
      _hashtagsRaw = raw;
      _hashtags = parseHashtags(raw, max: _maxHashtags);
    }),
    onRemoveHashtag: (tag) => setState(() {
      _hashtags = _hashtags.where((t) => t != tag).toList(growable: false);
      _hashtagsRaw = _hashtags.map((t) => '#$t').join(' ');
    }),
    onPrivacyChanged: (value) => setState(() => _privacy = value),
    onAddMedia: _openCaptureSheet,
    onRemoveMedia: _removeMedia,
    onPreviewIndexChanged: (index) => setState(() => _previewIndex = index),
    onReorderMedia: _reorderMedia,
    onSubmit: _submit,
    onSaveDraft: () => _saveDraft(queueForUpload: false),
  );

  void _removeMedia(String id) {
    setState(() {
      _media = _media.where((m) => m.id != id).toList(growable: false);
      if (_previewIndex >= _media.length) {
        _previewIndex = _media.isEmpty ? 0 : _media.length - 1;
      }
    });
  }

  void _reorderMedia(int oldIndex, int newIndex) {
    if (oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= _media.length ||
        newIndex >= _media.length) {
      return;
    }
    final next = List<ComposerMediaItem>.from(_media);
    final item = next.removeAt(oldIndex);
    next.insert(newIndex, item);
    setState(() => _media = next);
  }

  // -------------------------------------------------------------------------
  // Media capture / picking
  // -------------------------------------------------------------------------

  /// Opens the capture-method chooser (photo-plus flow: take photo, record
  /// video, photo library, video library). Stories prefer a single item.
  void _openCaptureSheet() {
    if (_isAtMediaLimit) {
      _showSnack('You can add up to $_maxMedia items.');
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: CreateColors.barrier,
      isScrollControlled: true,
      builder: (sheetContext) => _CaptureMethodSheet(
        onMethod: (method) {
          Navigator.of(sheetContext).pop();
          _handleCaptureMethod(method);
        },
      ),
    );
  }

  bool get _isAtMediaLimit => _media.length >= _maxMedia;

  Future<void> _handleCaptureMethod(CaptureMethod method) async {
    switch (method) {
      case CaptureMethod.takePhoto:
        await _pickSingle(
          source: ImageSource.camera,
          kind: CreateMediaKind.image,
        );
        break;
      case CaptureMethod.photoLibrary:
        await _pickMediaLibrary();
        break;
      case CaptureMethod.recordVideo:
        await _pickSingle(
          source: ImageSource.camera,
          kind: CreateMediaKind.video,
        );
        break;
      case CaptureMethod.videoLibrary:
        await _pickSingle(
          source: ImageSource.gallery,
          kind: CreateMediaKind.video,
        );
        break;
    }
  }

  /// Mixed photo/video picker. Honors the remaining capacity.
  Future<void> _pickMediaLibrary() async {
    final remaining = _maxMedia - _media.length;
    if (remaining <= 0) {
      _showSnack('You can add up to $_maxMedia items.');
      return;
    }

    if (remaining == 1) {
      final picked = await _picker.pickMedia();
      if (picked == null) return;
      setState(() {
        _media = [
          ..._media,
          ComposerMediaItem(
            id: _uuid.v4(),
            path: picked.path,
            kind: _kindFor(picked),
          ),
        ];
      });
      return;
    }

    final picked = await _picker.pickMultipleMedia(limit: remaining);
    if (picked.isEmpty) return;
    final accepted = picked.take(remaining).toList();
    final overflow = picked.length - accepted.length;
    setState(() {
      _media = [
        ..._media,
        for (final file in accepted)
          ComposerMediaItem(
            id: _uuid.v4(),
            path: file.path,
            kind: _kindFor(file),
          ),
      ];
    });
    if (overflow > 0) {
      _showSnack('Added $remaining; media limit is $_maxMedia.');
    }
  }

  CreateMediaKind _kindFor(XFile file) {
    final mime = file.mimeType?.toLowerCase();
    if (mime != null) {
      if (mime.startsWith('video/')) return CreateMediaKind.video;
      if (mime.startsWith('image/')) return CreateMediaKind.image;
    }

    final path = file.path.toLowerCase();
    final videoExtensions = <String>{
      '3gp',
      'avi',
      'm4v',
      'mkv',
      'mov',
      'mp4',
      'mpeg',
      'mpg',
      'webm',
      'wmv',
    };
    final extension = path.contains('.') ? path.split('.').last : '';
    return videoExtensions.contains(extension)
        ? CreateMediaKind.video
        : CreateMediaKind.image;
  }

  Future<void> _pickSingle({
    required ImageSource source,
    required CreateMediaKind kind,
  }) async {
    final XFile? picked = kind == CreateMediaKind.video
        ? await _picker.pickVideo(source: source)
        : await _picker.pickImage(source: source);
    if (picked == null) return;
    if (_isAtMediaLimit) {
      _showSnack('You can add up to $_maxMedia items.');
      return;
    }
    setState(() {
      _media = [
        ..._media,
        ComposerMediaItem(id: _uuid.v4(), path: picked.path, kind: kind),
      ];
    });
  }

  // -------------------------------------------------------------------------
  // Submit / save draft
  // -------------------------------------------------------------------------

  /// Build the persisted content body: caption and '#'-joined hashtags.
  String _composeContent() => buildFullContent(_caption, _hashtags);

  bool get _hasContent => _mode == _CreateMode.story
      ? _media.isNotEmpty
      : _caption.trim().isNotEmpty || _media.isNotEmpty;

  Future<void> _submit() => _saveDraft(queueForUpload: true);

  Future<void> _saveDraft({required bool queueForUpload}) async {
    if (!_hasContent || _isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _summary = null;
    });

    final mediaPaths = _media.map((m) => m.path).toList(growable: false);
    final mediaTypes = _media
        .map((m) => m.kind == CreateMediaKind.video ? 'video' : 'image')
        .toList(growable: false);

    final draft = await widget.draftRepository.saveDraft(
      content: _composeContent(),
      mediaPath: mediaPaths.isEmpty ? null : mediaPaths.first,
      mediaType: mediaTypes.isEmpty ? null : mediaTypes.first,
      mediaPaths: mediaPaths,
      mediaTypes: mediaTypes,
      privacy: _privacy.wireValue,
      draftKind: _mode == _CreateMode.story ? 'story' : 'post',
    );

    UploadQueueSummary? summary;
    if (queueForUpload) {
      await widget.uploadQueueRepository.enqueueDraft(draft.id);
      await widget.draftRepository.markState(
        draftId: draft.id,
        uploadState: DraftUploadState.queued,
      );
      summary = await widget.uploadQueueService.processQueue();
      if (summary.uploaded > 0) {
        widget.onPostUploaded();
      }
    }

    if (!mounted) return;
    setState(() {
      _caption = '';
      _hashtagsRaw = '';
      _hashtags = const <String>[];
      _media = const <ComposerMediaItem>[];
      _previewIndex = 0;
      _mode = _CreateMode.post;
      _isSubmitting = false;
      _summary = queueForUpload
          ? _summaryView(summary)
          : const QueueSummaryView(message: 'Draft saved locally.');
    });
    await _refreshDrafts();
  }

  QueueSummaryView _summaryView(UploadQueueSummary? summary) {
    if (summary == null) {
      return const QueueSummaryView(message: 'Post queued.');
    }
    if (!summary.attempted) {
      return QueueSummaryView(message: summary.message);
    }
    if (summary.uploaded > 0 && summary.failed == 0) {
      return QueueSummaryView(message: summary.message);
    }
    if (summary.uploaded > 0) {
      return QueueSummaryView(
        message: 'Posted ${summary.uploaded}; ${summary.failed} upload failed.',
        isError: true,
      );
    }
    return QueueSummaryView(
      message: 'Post is still queued. ${summary.message}',
      isError: summary.failed > 0,
    );
  }

  // -------------------------------------------------------------------------
  // Drafts / queue
  // -------------------------------------------------------------------------

  Future<void> _refreshDrafts() async {
    final drafts = await widget.draftRepository.loadDrafts();
    final queue = await widget.uploadQueueRepository.loadQueuedItems();
    final queuedIds = {for (final item in queue) item.draftId};
    final retryCounts = {
      for (final item in queue) item.draftId: item.retryCount,
    };

    final rows = drafts
        .map(
          (draft) => UploadQueueItemView(
            draftId: draft.id,
            title: draft.content.isEmpty ? 'Media draft' : draft.content,
            status: _statusFor(draft, queuedIds.contains(draft.id)),
            createdAtMillis: draft.createdAtMillis,
            mediaType: draft.mediaType,
            retryCount: retryCounts[draft.id] ?? 0,
          ),
        )
        .toList(growable: false);

    if (!mounted) return;
    setState(() {
      _queueRows = rows;
      _loadingDrafts = false;
    });
  }

  /// Maps the persisted [DraftUploadState] (plus live queue membership) into the
  /// view-model [DraftStatus]. The upload service exposes no streaming progress,
  /// so per-row state comes entirely from the draft's upload-state enum.
  DraftStatus _statusFor(PostDraft draft, bool isQueued) {
    switch (draft.uploadState) {
      case DraftUploadState.uploading:
        return DraftStatus.uploading;
      case DraftUploadState.uploaded:
        return DraftStatus.uploaded;
      case DraftUploadState.failed:
        return DraftStatus.failed;
      case DraftUploadState.queued:
        return DraftStatus.queued;
      case DraftUploadState.local:
        return isQueued ? DraftStatus.queued : DraftStatus.local;
    }
  }

  UploadQueueCallbacks get _queueCallbacks => UploadQueueCallbacks(
    onRetry: _queueForUpload,
    onQueue: _queueForUpload,
    onCancel: _cancelQueued,
    onDelete: _deleteDraft,
    onRefresh: _refreshDrafts,
  );

  Future<void> _queueForUpload(String draftId) async {
    await widget.uploadQueueRepository.enqueueDraft(draftId);
    await widget.draftRepository.markState(
      draftId: draftId,
      uploadState: DraftUploadState.queued,
    );
    final summary = await widget.uploadQueueService.processQueue();
    if (summary.uploaded > 0) {
      widget.onPostUploaded();
    }
    if (!mounted) return;
    setState(() => _summary = _summaryView(summary));
    await _refreshDrafts();
  }

  Future<void> _cancelQueued(String draftId) async {
    await widget.uploadQueueRepository.remove(draftId);
    await widget.draftRepository.markState(
      draftId: draftId,
      uploadState: DraftUploadState.local,
    );
    await _refreshDrafts();
  }

  Future<void> _deleteDraft(String draftId) async {
    await widget.uploadQueueRepository.remove(draftId);
    await widget.draftRepository.deleteDraft(draftId);
    await _refreshDrafts();
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------

  void _showSnack(String message) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: CreateColors.background,
      child: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            CreateSpacing.lg,
            CreateSpacing.md,
            CreateSpacing.lg,
            CreateSpacing.xl,
          ),
          children: [
            const Text('Create', style: CreateTextStyles.headline),
            const SizedBox(height: CreateSpacing.md),
            _ModeToggle(
              mode: _mode,
              onChanged: (mode) => setState(() => _mode = mode),
            ),
            const SizedBox(height: CreateSpacing.md),
            if (_mode == _CreateMode.story) ...[
              const _StoryModeNotice(),
              const SizedBox(height: CreateSpacing.md),
            ],
            PostComposerPanel(
              view: _composerView,
              callbacks: _composerCallbacks,
              showHeader: false,
            ),
            const SizedBox(height: CreateSpacing.lg),
            const Divider(height: 1, color: CreateColors.border),
            const SizedBox(height: CreateSpacing.lg),
            if (_loadingDrafts)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(CreateSpacing.lg),
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(
                      CreateColors.primary,
                    ),
                  ),
                ),
              )
            else
              UploadQueuePanel(
                items: _queueRows,
                callbacks: _queueCallbacks,
                summary: _summary,
              ),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Mode toggle (Post / Story)
// ===========================================================================

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({required this.mode, required this.onChanged});

  final _CreateMode mode;
  final ValueChanged<_CreateMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CreateSpacing.xs),
      decoration: BoxDecoration(
        color: CreateColors.muted,
        borderRadius: CreateRadii.chip,
      ),
      child: Row(
        children: [
          _ModeSegment(
            label: 'Post',
            icon: Icons.play_arrow_rounded,
            isSelected: mode == _CreateMode.post,
            onTap: () => onChanged(_CreateMode.post),
          ),
          _ModeSegment(
            label: 'Story',
            icon: Icons.auto_stories_outlined,
            isSelected: mode == _CreateMode.story,
            onTap: () => onChanged(_CreateMode.story),
          ),
        ],
      ),
    );
  }
}

class _ModeSegment extends StatelessWidget {
  const _ModeSegment({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = isSelected
        ? CreateColors.primaryForeground
        : CreateColors.mutedForeground;
    return Expanded(
      child: Material(
        color: Colors.transparent,
        borderRadius: CreateRadii.chip,
        child: InkWell(
          borderRadius: CreateRadii.chip,
          onTap: onTap,
          child: Container(
            height: CreateSpacing.tapTarget - 8,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: isSelected ? CreateGradients.primaryAction : null,
              borderRadius: CreateRadii.chip,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: foreground),
                const SizedBox(width: CreateSpacing.sm),
                Text(
                  label,
                  style: isSelected
                      ? CreateTextStyles.pillLabelSelected
                      : CreateTextStyles.pillLabel,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ===========================================================================
// Story mode notice
// ===========================================================================

class _StoryModeNotice extends StatelessWidget {
  const _StoryModeNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CreateSpacing.md),
      decoration: BoxDecoration(
        color: CreateColors.primaryFaint,
        borderRadius: CreateRadii.card,
        border: Border.all(color: CreateColors.primarySoft),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_stories_outlined, color: CreateColors.primary),
          const SizedBox(width: CreateSpacing.md),
          Expanded(
            child: Text(
              'Story drafts publish to the 24-hour stories surface through '
              'the same offline upload queue.',
              style: CreateTextStyles.helper,
            ),
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// Capture-method chooser (photo-plus flow)
// ===========================================================================

/// Bottom sheet offering the four capture routes (parity with the web
/// photo-plus action). Mirrors the styling of the picker sheet's chooser but is
/// owned here so the screen controls the resulting [CaptureMethod].
class _CaptureMethodSheet extends StatelessWidget {
  const _CaptureMethodSheet({required this.onMethod});

  final ValueChanged<CaptureMethod> onMethod;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        decoration: const BoxDecoration(
          color: CreateColors.card,
          borderRadius: CreateRadii.sheetTop,
          boxShadow: CreateShadows.sheet,
        ),
        padding: const EdgeInsets.only(bottom: CreateSpacing.sm),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: CreateSpacing.md),
                decoration: BoxDecoration(
                  color: CreateColors.whiteSoft,
                  borderRadius: BorderRadius.circular(CreateRadii.pill),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CreateSpacing.lg,
                CreateSpacing.sm,
                CreateSpacing.lg,
                CreateSpacing.sm,
              ),
              child: Text('Add Media', style: CreateTextStyles.sectionLabel),
            ),
            _CaptureRow(
              icon: Icons.photo_camera_outlined,
              label: 'Take Photo',
              onTap: () => onMethod(CaptureMethod.takePhoto),
            ),
            _CaptureRow(
              icon: Icons.videocam_outlined,
              label: 'Record Video',
              onTap: () => onMethod(CaptureMethod.recordVideo),
            ),
            _CaptureRow(
              icon: Icons.photo_library_outlined,
              label: 'Photo Library',
              onTap: () => onMethod(CaptureMethod.photoLibrary),
            ),
            _CaptureRow(
              icon: Icons.video_library_outlined,
              label: 'Choose Video',
              onTap: () => onMethod(CaptureMethod.videoLibrary),
            ),
            const Divider(height: 1, color: CreateColors.border),
            _CaptureRow(
              icon: Icons.close,
              label: 'Cancel',
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ],
        ),
      ),
    );
  }
}

class _CaptureRow extends StatelessWidget {
  const _CaptureRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: CreateSpacing.tapTarget),
          padding: const EdgeInsets.symmetric(
            horizontal: CreateSpacing.lg,
            vertical: CreateSpacing.md,
          ),
          child: Row(
            children: [
              Icon(icon, size: 22, color: CreateColors.foreground),
              const SizedBox(width: CreateSpacing.lg),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: CreateColors.foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
