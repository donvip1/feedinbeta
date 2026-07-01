import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../../core/sync/upload_queue_service.dart';
import '../../data/local/post_draft_repository.dart';
import '../../data/local/upload_queue_repository.dart';
import 'parity/create_tokens.dart';
import 'parity/create_view_models.dart';
import 'parity/story_extras_models.dart';
import 'parity/widgets/post_composer_panel.dart';
import 'parity/widgets/story_composer_sheet.dart';
import 'parity/widgets/upload_queue_panel.dart';
import 'post_draft.dart';
import 'story_publisher.dart';

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

  /// Publishes the "extra" story kinds (text / audio note / music) that the
  /// shared draft + upload-queue model can't represent. No [StoryAudioSource]
  /// is injected on this build, so `canUseAudio` is false and the composer
  /// disables the audio/music kinds with a flagged-setup note; text stories
  /// work end-to-end today. Wiring a recorder/file-picker seam here lights the
  /// other two kinds up with no further UI changes.
  final StoryPublisher _storyPublisher = StoryPublisher();

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
      final stored = await _persistPickedMedia(picked);
      setState(() {
        _media = [
          ..._media,
          ComposerMediaItem(
            id: _uuid.v4(),
            path: stored,
            kind: _kindFor(picked),
          ),
        ];
      });
      return;
    }

    final picked = await _picker.pickMultipleMedia(limit: remaining);
    if (picked.isEmpty) return;
    final accepted = picked.take(remaining).toList();
    final persisted = <({XFile file, String path})>[];
    for (final file in accepted) {
      persisted.add((file: file, path: await _persistPickedMedia(file)));
    }
    final overflow = picked.length - accepted.length;
    setState(() {
      _media = [
        ..._media,
        for (final item in persisted)
          ComposerMediaItem(
            id: _uuid.v4(),
            path: item.path,
            kind: _kindFor(item.file),
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
    final stored = await _persistPickedMedia(picked);
    setState(() {
      _media = [
        ..._media,
        ComposerMediaItem(id: _uuid.v4(), path: stored, kind: kind),
      ];
    });
  }

  Future<String> _persistPickedMedia(XFile picked) async {
    final source = File(picked.path);
    if (!source.existsSync()) return picked.path;

    final directory = await getApplicationCacheDirectory();
    final mediaDirectory = Directory('${directory.path}/feedin_create_media');
    if (!mediaDirectory.existsSync()) {
      mediaDirectory.createSync(recursive: true);
    }

    final extension = picked.path.contains('.')
        ? picked.path.split('.').last
        : 'bin';
    final targetPath =
        '${mediaDirectory.path}/${DateTime.now().millisecondsSinceEpoch}_${_uuid.v4()}.$extension';
    return source.copy(targetPath).then((file) => file.path);
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
    final progressByDraft = {
      for (final item in queue) item.draftId: item.progress,
    };

    final rows = drafts
        .map(
          (draft) => UploadQueueItemView(
            draftId: draft.id,
            title: draft.content.isEmpty ? 'Media draft' : draft.content,
            status: _statusFor(draft, queuedIds.contains(draft.id)),
            createdAtMillis: draft.createdAtMillis,
            mediaType: draft.mediaType,
            progress: _progressFor(
              draft,
              queuedIds.contains(draft.id),
              progressByDraft[draft.id],
            ),
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

  int? _progressFor(PostDraft draft, bool isQueued, int? queueProgress) {
    switch (_statusFor(draft, isQueued)) {
      case DraftStatus.uploading:
        return queueProgress?.clamp(1, 99) ?? 10;
      case DraftStatus.uploaded:
        return 100;
      case DraftStatus.queued:
        return queueProgress?.clamp(0, 99) ?? 0;
      case DraftStatus.failed:
      case DraftStatus.local:
        return null;
    }
  }

  /// Maps the persisted [DraftUploadState] (plus live queue membership) into the
  /// view-model [DraftStatus].
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

  // -------------------------------------------------------------------------
  // Story extras (text / audio note / music) — published directly via
  // [StoryPublisher], separate from the media-story upload queue.
  // -------------------------------------------------------------------------

  /// Opens the [StoryComposerSheet] for the text/audio/music story kinds.
  void _openStoryComposer() {
    final audioSource = _storyPublisher.audioSource;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: CreateColors.barrier,
      builder: (sheetContext) => StoryComposerSheet(
        audioAvailable: _storyPublisher.canUseAudio,
        audioUnavailableNote:
            'Audio notes and music files need an audio recorder / file '
            'picker seam wired on this build. Text stories publish now.',
        callbacks: StoryComposerCallbacks(
          onClose: () => Navigator.of(sheetContext).maybePop(),
          onPublishText: (text, background) => _publishStoryExtra(
            sheetContext,
            () => _storyPublisher.publishTextStory(
              text: text,
              background: background,
            ),
          ),
          onPublishAudio: (attachment, background, text) => _publishStoryExtra(
            sheetContext,
            () => _storyPublisher.publishAudioStory(
              attachment: attachment,
              background: background,
              text: text,
            ),
          ),
          onPublishMusic: (attachment, background, text) => _publishStoryExtra(
            sheetContext,
            () => _storyPublisher.publishMusicStory(
              attachment: attachment,
              background: background,
              text: text,
            ),
          ),
          onRecordAudio: () => _resolveAudio(audioSource?.recordAudioNote()),
          onPickMusic: () => _resolveAudio(audioSource?.pickAudioFile()),
        ),
      ),
    );
  }

  /// Runs a recorder/picker seam future and validates the result (mime + 4-min
  /// cap). Returns null when the seam is absent, cancelled, or rejected.
  Future<AudioAttachment?> _resolveAudio(
    Future<AudioAttachment?>? pending,
  ) async {
    if (pending == null) return null;
    final picked = await pending;
    if (picked == null) return null;
    final validation = await _storyPublisher.validateAudio(picked);
    if (!validation.isAccepted) {
      _showSnack(validation.reason ?? 'That audio file cannot be used.');
      return null;
    }
    if (validation.durationUnknown) {
      _showSnack('Duration could not be verified; publishing anyway.');
    }
    return picked.copyWith(durationSeconds: validation.durationSeconds);
  }

  /// Runs a publish action, closes the sheet on success, and surfaces the
  /// result. Refreshes the feed so the new story shows immediately.
  Future<void> _publishStoryExtra(
    BuildContext sheetContext,
    Future<String> Function() action,
  ) async {
    // Capture the sheet's navigator before the async gap so we don't touch a
    // BuildContext after awaiting.
    final sheetNavigator = Navigator.of(sheetContext);
    try {
      final message = await action();
      widget.onPostUploaded();
      if (sheetNavigator.canPop()) {
        sheetNavigator.pop();
      }
      if (!mounted) return;
      setState(() {
        _summary = QueueSummaryView(message: message);
      });
    } on StoryPublishException catch (error) {
      _showSnack(error.message);
    } catch (error) {
      _showSnack('Could not publish story: $error');
    }
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
            const SizedBox(height: CreateSpacing.xs),
            Text(
              _mode == _CreateMode.post
                  ? 'Share a photo, video, or thought.'
                  : 'Share a moment for the next 24 hours.',
              style: CreateTextStyles.helper,
            ),
            const SizedBox(height: CreateSpacing.md),
            _ModeToggle(
              mode: _mode,
              onChanged: (mode) => setState(() => _mode = mode),
            ),
            const SizedBox(height: CreateSpacing.md),
            if (_mode == _CreateMode.story) ...[
              const _StoryModeNotice(),
              const SizedBox(height: CreateSpacing.md),
              _StoryFormatsCard(onOpen: _openStoryComposer),
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
    // A sliding segmented control: a single gradient "thumb" animates between
    // the two halves, mirroring the web composer's tab feel with stronger
    // motion than a hard fill swap.
    return Container(
      padding: const EdgeInsets.all(CreateSpacing.xs),
      decoration: BoxDecoration(
        color: CreateColors.muted,
        borderRadius: CreateRadii.chip,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final segmentWidth = (constraints.maxWidth) / 2;
          final isPost = mode == _CreateMode.post;
          return SizedBox(
            height: CreateSpacing.tapTarget - 8,
            child: Stack(
              children: [
                // The animated gradient thumb behind the active segment.
                AnimatedAlign(
                  duration: CreateMotion.normal,
                  curve: CreateMotion.emphasized,
                  alignment: isPost
                      ? Alignment.centerLeft
                      : Alignment.centerRight,
                  child: Container(
                    width: segmentWidth,
                    height: double.infinity,
                    decoration: const BoxDecoration(
                      gradient: CreateGradients.primaryAction,
                      borderRadius: CreateRadii.chip,
                      boxShadow: CreateShadows.pink,
                    ),
                  ),
                ),
                Row(
                  children: [
                    _ModeSegment(
                      label: 'Post',
                      icon: Icons.add_photo_alternate_outlined,
                      isSelected: isPost,
                      onTap: () => onChanged(_CreateMode.post),
                    ),
                    _ModeSegment(
                      label: 'Story',
                      icon: Icons.amp_stories_outlined,
                      isSelected: !isPost,
                      onTap: () => onChanged(_CreateMode.story),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
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
    return Expanded(
      child: Material(
        color: Colors.transparent,
        borderRadius: CreateRadii.chip,
        child: InkWell(
          borderRadius: CreateRadii.chip,
          onTap: onTap,
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedSwitcher(
                  duration: CreateMotion.fast,
                  child: Icon(
                    icon,
                    key: ValueKey(isSelected),
                    size: 18,
                    color: isSelected
                        ? CreateColors.primaryForeground
                        : CreateColors.mutedForeground,
                  ),
                ),
                const SizedBox(width: CreateSpacing.sm),
                AnimatedDefaultTextStyle(
                  duration: CreateMotion.fast,
                  style: isSelected
                      ? CreateTextStyles.pillLabelSelected
                      : CreateTextStyles.pillLabel,
                  child: Text(label),
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
    return TweenAnimationBuilder<double>(
      duration: CreateMotion.normal,
      curve: CreateMotion.emphasized,
      tween: Tween(begin: 0, end: 1),
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * 8),
          child: child,
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(CreateSpacing.md),
        decoration: BoxDecoration(
          color: CreateColors.primaryFaint,
          borderRadius: CreateRadii.card,
          border: Border.all(color: CreateColors.primarySoft),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Gradient story-ring badge (parity with the web share/story accent).
            Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: CreateGradients.shareAction,
              ),
              child: const Icon(
                Icons.amp_stories_outlined,
                color: CreateColors.onMedia,
                size: 20,
              ),
            ),
            const SizedBox(width: CreateSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Share a 24-hour story',
                    style: CreateTextStyles.storyLabel,
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Videos max 2 minutes • Expires in 24 hours • Publishes '
                    'through the same offline upload queue.',
                    style: CreateTextStyles.helper,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Story formats card (text / audio note / music entry point)
// ===========================================================================

/// Tappable card in Story mode that opens the [StoryComposerSheet] for the
/// non-media story kinds (text on a gradient, an audio note, or an attached
/// music file). The classic photo/video story still uses the composer + queue
/// below; this is the parity counterpart to the web `CreateStoryModal` extras.
class _StoryFormatsCard extends StatelessWidget {
  const _StoryFormatsCard({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: CreateRadii.card,
      child: InkWell(
        onTap: onOpen,
        borderRadius: CreateRadii.card,
        child: Container(
          padding: const EdgeInsets.all(CreateSpacing.md),
          decoration: BoxDecoration(
            color: CreateColors.card,
            borderRadius: CreateRadii.card,
            border: Border.all(color: CreateColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: CreateGradients.primaryAction,
                ),
                child: const Icon(
                  Icons.auto_awesome,
                  color: CreateColors.primaryForeground,
                  size: 22,
                ),
              ),
              const SizedBox(width: CreateSpacing.md),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Text, audio & music stories',
                      style: CreateTextStyles.uploadStatus,
                    ),
                    SizedBox(height: 2),
                    Text(
                      'No photo? Write on a gradient, record a voice note, or '
                      'attach your own track.',
                      style: CreateTextStyles.helper,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: CreateSpacing.sm),
              const Icon(
                Icons.chevron_right,
                size: 20,
                color: CreateColors.mutedForeground,
              ),
            ],
          ),
        ),
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
            const Padding(
              padding: EdgeInsets.fromLTRB(
                CreateSpacing.lg,
                CreateSpacing.xs,
                CreateSpacing.lg,
                CreateSpacing.sm,
              ),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Add media', style: CreateTextStyles.title),
              ),
            ),
            _CaptureRow(
              icon: Icons.photo_camera_outlined,
              label: 'Take Photo',
              description: 'Capture a new photo',
              onTap: () => onMethod(CaptureMethod.takePhoto),
            ),
            _CaptureRow(
              icon: Icons.videocam_outlined,
              label: 'Record Video',
              description: 'Shoot a new clip',
              onTap: () => onMethod(CaptureMethod.recordVideo),
            ),
            _CaptureRow(
              icon: Icons.photo_library_outlined,
              label: 'Photo Library',
              description: 'Pick photos and videos',
              onTap: () => onMethod(CaptureMethod.photoLibrary),
            ),
            _CaptureRow(
              icon: Icons.video_library_outlined,
              label: 'Choose Video',
              description: 'Pick a clip from your library',
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

/// A single capture-method row. When a [description] is supplied it renders the
/// premium web `NativeCreationSheet` treatment: a primary-tinted icon tile, a
/// label + helper line, and a trailing chevron. The plain Cancel row passes no
/// description and renders as a centered, muted action.
class _CaptureRow extends StatelessWidget {
  const _CaptureRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.description,
  });

  final IconData icon;
  final String label;
  final String? description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasDescription = description != null;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: CreateSpacing.tapTarget),
          padding: EdgeInsets.symmetric(
            horizontal: CreateSpacing.lg,
            vertical: hasDescription ? CreateSpacing.sm + 2 : CreateSpacing.md,
          ),
          child: hasDescription
              ? Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: CreateColors.primaryFaint,
                      ),
                      child: Icon(icon, size: 22, color: CreateColors.primary),
                    ),
                    const SizedBox(width: CreateSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: CreateColors.foreground,
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(description!, style: CreateTextStyles.helper),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right,
                      size: 20,
                      color: CreateColors.mutedForeground,
                    ),
                  ],
                )
              : Center(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: CreateColors.mutedForeground,
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}
