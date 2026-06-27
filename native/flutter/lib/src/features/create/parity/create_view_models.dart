import 'package:flutter/widgets.dart';

/// UI-facing, immutable view-models consumed by the Create widgets under
/// `create/parity/widgets/`. These cover four sub-surfaces:
///   1. the post composer (caption, hashtags, privacy, multi-media),
///   2. the media gallery picker & camera scaffold,
///   3. stories (bar, create panel, full-screen viewer),
///   4. the upload-progress / queue UI.
///
/// They are deliberately decoupled from persistence (`post_draft.dart`,
/// `UploadQueueItem`, the `stories` table) and depend only on the Flutter
/// foundation library so they analyze cleanly on their own.
///
/// The screen/repo layer maps the local/remote models into these views and
/// passes them to the presentational widgets. Widgets NEVER read Supabase or a
/// repo directly — they take a view + callbacks.

// ===========================================================================
// Enums
// ===========================================================================

/// Per-item media kind shared across all Create areas (composer, picker, story).
enum CreateMediaKind { image, video }

/// 4-way post privacy (web parity: everyone | friends | followers | only_me).
/// Replaces the legacy 3-state Public/Followers/Private cycle.
enum PostPrivacy { everyone, friends, followers, onlyMe }

/// Bottom-sheet capture routing options (maps to image_picker sources).
enum CaptureMethod { takePhoto, recordVideo, photoLibrary, videoLibrary }

/// What media types the picker accepts (also drives the picker title).
enum MediaAcceptType { image, video, all }

/// Picker/camera mode — only changes labels & limits (live excluded globally).
enum CaptureMode { post, story }

/// Story ring style for the unviewed gradient ring.
enum StoryRingStyle { classic, tiktok }

/// Staged submit feedback handed off to the upload-progress UI.
enum UploadStage { idle, uploading, creating, done }

/// Per-draft upload lifecycle. Mirrors `DraftUploadState` in post_draft.dart,
/// kept independent so this file has no cross-layer import. Map at the screen
/// boundary.
enum DraftStatus { local, queued, uploading, uploaded, failed }

// ===========================================================================
// Shared media value object
// ===========================================================================

/// One picked/selected media item. Reused by the composer carousel, the gallery
/// tray, the media-edit tray and the story preview so selection state flows
/// between steps without duplicate models. Pure data, no I/O.
@immutable
class ComposerMediaItem {
  const ComposerMediaItem({
    required this.id,
    required this.path,
    required this.kind,
    this.durationSeconds,
    this.thumbnailPath,
    this.width,
    this.height,
  });

  /// Stable key for tray/reorder/remove (e.g. a uuid). NOT the file path.
  final String id;

  /// Local file path from XFile.path — used for Image.file / video controller.
  final String path;
  final CreateMediaKind kind;

  /// Video only; null for images. Drives the m:ss chip and the story <=120s rule.
  final int? durationSeconds;

  /// Optional generated poster frame for videos; images use [path] directly.
  final String? thumbnailPath;
  final int? width;
  final int? height;

  bool get isVideo => kind == CreateMediaKind.video;

  /// Best preview source: explicit thumbnail if present, else the file path
  /// (images render directly; videos fall back to a play-glyph placeholder when
  /// no thumbnail exists — see the tile widget).
  String get previewPath => thumbnailPath ?? path;

  /// "m:ss" formatter for the duration chip (returns null for images / unknown).
  String? get durationLabel {
    final secs = durationSeconds;
    if (secs == null || secs <= 0) return null;
    final m = secs ~/ 60;
    final s = secs % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  ComposerMediaItem copyWith({
    String? path,
    CreateMediaKind? kind,
    int? durationSeconds,
    String? thumbnailPath,
    int? width,
    int? height,
  }) {
    return ComposerMediaItem(
      id: id,
      path: path ?? this.path,
      kind: kind ?? this.kind,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      thumbnailPath: thumbnailPath ?? this.thumbnailPath,
      width: width ?? this.width,
      height: height ?? this.height,
    );
  }
}

// ===========================================================================
// Post composer
// ===========================================================================

/// Immutable snapshot the [PostComposerPanel] renders. The screen rebuilds this
/// on every state change; widgets emit intent via callbacks (passed separately).
@immutable
class PostComposerView {
  const PostComposerView({
    this.caption = '',
    this.hashtagsRaw = '',
    this.hashtags = const <String>[],
    this.privacy = PostPrivacy.everyone,
    this.media = const <ComposerMediaItem>[],
    this.currentPreviewIndex = 0,
    this.isSubmitting = false,
    this.uploadStage = UploadStage.idle,
    this.maxHashtags = 5,
    this.maxMedia = 10,
    this.requiresMedia = false,
  });

  /// Free-form post body (the caption TextField value).
  final String caption;

  /// Raw hashtag-field text (source of truth for the tag field), e.g. '#one #two'.
  final String hashtagsRaw;

  /// Parsed/normalized lowercase tags (derived from [hashtagsRaw], capped at
  /// [maxHashtags]). Without the leading '#'.
  final List<String> hashtags;

  final PostPrivacy privacy;

  /// Ordered selected media (was a single XFile). Drives carousel + submit.
  final List<ComposerMediaItem> media;

  /// Active carousel index for the counter / dots / arrows.
  final int currentPreviewIndex;

  /// Gates the Post button + shows the spinner / 'Posting...'.
  final bool isSubmitting;

  /// Staged submit feedback handed to the upload-progress UI.
  final UploadStage uploadStage;

  final int maxHashtags;
  final int maxMedia;
  final bool requiresMedia;

  bool get hasMedia => media.isNotEmpty;
  bool get isMultiMedia => media.length > 1;
  bool get isAtHashtagLimit => hashtags.length >= maxHashtags;
  bool get isAtMediaLimit => media.length >= maxMedia;

  /// A post can publish with caption text, selected media, or both. Story mode
  /// sets [requiresMedia] because the `stories` row needs a media URL.
  bool get canSubmit =>
      !isSubmitting && (hasMedia || (!requiresMedia && caption.trim().isNotEmpty));

  PostComposerView copyWith({
    String? caption,
    String? hashtagsRaw,
    List<String>? hashtags,
    PostPrivacy? privacy,
    List<ComposerMediaItem>? media,
    int? currentPreviewIndex,
    bool? isSubmitting,
    UploadStage? uploadStage,
    int? maxHashtags,
    int? maxMedia,
    bool? requiresMedia,
  }) {
    return PostComposerView(
      caption: caption ?? this.caption,
      hashtagsRaw: hashtagsRaw ?? this.hashtagsRaw,
      hashtags: hashtags ?? this.hashtags,
      privacy: privacy ?? this.privacy,
      media: media ?? this.media,
      currentPreviewIndex: currentPreviewIndex ?? this.currentPreviewIndex,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      uploadStage: uploadStage ?? this.uploadStage,
      maxHashtags: maxHashtags ?? this.maxHashtags,
      maxMedia: maxMedia ?? this.maxMedia,
      requiresMedia: requiresMedia ?? this.requiresMedia,
    );
  }
}

/// Bundle of composer callbacks, passed once to [PostComposerPanel] so the
/// widget tree stays prop-light. All optional-but-typically-wired by the screen.
@immutable
class PostComposerCallbacks {
  const PostComposerCallbacks({
    required this.onCaptionChanged,
    required this.onHashtagsChanged,
    required this.onRemoveHashtag,
    required this.onPrivacyChanged,
    required this.onAddMedia,
    required this.onRemoveMedia,
    required this.onPreviewIndexChanged,
    required this.onSubmit,
    this.onReorderMedia,
    this.onSaveDraft,
    this.onClose,
  });

  final ValueChanged<String> onCaptionChanged;

  /// Emits the RAW hashtag-field string after edits; the screen re-parses it.
  final ValueChanged<String> onHashtagsChanged;

  /// Removes a single parsed tag (no leading '#'); the screen rebuilds the raw
  /// string from the remaining tags.
  final ValueChanged<String> onRemoveHashtag;

  final ValueChanged<PostPrivacy> onPrivacyChanged;

  /// Opens the capture-method sheet / gallery picker (screen owns image_picker).
  final VoidCallback onAddMedia;

  /// Remove by stable [ComposerMediaItem.id].
  final ValueChanged<String> onRemoveMedia;
  final ValueChanged<int> onPreviewIndexChanged;
  final VoidCallback onSubmit;
  final void Function(int oldIndex, int newIndex)? onReorderMedia;
  final VoidCallback? onSaveDraft;
  final VoidCallback? onClose;
}

/// Parses a raw hashtag string into normalized, de-duplicated, lowercase tags
/// (no '#'), capped at [max]. Ports HashtagInput.tsx parseHashtags + the limit.
List<String> parseHashtags(String raw, {int max = 5}) {
  final seen = <String>{};
  final result = <String>[];
  for (final part in raw.split(RegExp(r'[\s,]+'))) {
    final tag = part.replaceAll(RegExp(r'^#+'), '').trim().toLowerCase();
    if (tag.isEmpty || seen.contains(tag)) continue;
    seen.add(tag);
    result.add(tag);
    if (result.length >= max) break;
  }
  return result;
}

/// Builds the final post body on submit: caption, a blank line, then the
/// '#'-joined hashtags when present (web parity for `fullContent`). This is a
/// pure helper the repo/service layer can call — widgets only expose the parts.
String buildFullContent(String caption, List<String> hashtags) {
  final base = caption.trim();
  if (hashtags.isEmpty) return base;
  final tags = hashtags.map((t) => '#$t').join(' ');
  return base.isEmpty ? tags : '$base\n\n$tags';
}

/// Display label + the wire string the post row stores for each privacy value.
extension PostPrivacyX on PostPrivacy {
  String get label {
    switch (this) {
      case PostPrivacy.everyone:
        return 'Everyone';
      case PostPrivacy.friends:
        return 'Friends';
      case PostPrivacy.followers:
        return 'Followers';
      case PostPrivacy.onlyMe:
        return 'Only Me';
    }
  }

  /// Backend wire value (matches the web app's posts.privacy strings).
  String get wireValue {
    switch (this) {
      case PostPrivacy.everyone:
        return 'everyone';
      case PostPrivacy.friends:
        return 'friends';
      case PostPrivacy.followers:
        return 'followers';
      case PostPrivacy.onlyMe:
        return 'only_me';
    }
  }

  static PostPrivacy fromWire(String? value) {
    switch (value) {
      case 'friends':
        return PostPrivacy.friends;
      case 'followers':
        return PostPrivacy.followers;
      case 'only_me':
        return PostPrivacy.onlyMe;
      case 'everyone':
      default:
        return PostPrivacy.everyone;
    }
  }
}

// ===========================================================================
// Media gallery picker
// ===========================================================================

/// Value object bundling the picker limits/behaviour. Passed into the picker
/// widgets; the screen-side controller owns the actual image_picker calls.
@immutable
class MediaPickerConfig {
  const MediaPickerConfig({
    this.maxSelection = 10,
    this.allowMultiple = true,
    this.acceptType = MediaAcceptType.all,
    this.maxVideoDurationSeconds = 60,
    this.mode = CaptureMode.post,
  });

  final int maxSelection;
  final bool allowMultiple;
  final MediaAcceptType acceptType;
  final int maxVideoDurationSeconds;
  final CaptureMode mode;

  /// Centered title parity with the web picker.
  String get title {
    switch (acceptType) {
      case MediaAcceptType.image:
        return 'Choose Photo';
      case MediaAcceptType.video:
        return 'Choose Video';
      case MediaAcceptType.all:
        return 'Select Media';
    }
  }
}

/// State for the gallery-picker tray (selected items + resolution flags).
@immutable
class MediaTrayView {
  const MediaTrayView({
    this.items = const <ComposerMediaItem>[],
    this.isLoading = false,
    this.errorMessage,
    this.config = const MediaPickerConfig(),
  });

  final List<ComposerMediaItem> items;

  /// True while picked files are being resolved into previews/durations.
  final bool isLoading;

  /// e.g. 'You can only select up to 10 files' or a permission-denied note.
  final String? errorMessage;
  final MediaPickerConfig config;

  bool get isEmpty => items.isEmpty;
  bool get canConfirm => items.isNotEmpty;
  bool get isAtLimit => items.length >= config.maxSelection;
  int get remaining => (config.maxSelection - items.length).clamp(0, 1 << 30);

  MediaTrayView copyWith({
    List<ComposerMediaItem>? items,
    bool? isLoading,
    String? errorMessage,
    MediaPickerConfig? config,
  }) {
    return MediaTrayView(
      items: items ?? this.items,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      config: config ?? this.config,
    );
  }
}

// ===========================================================================
// Stories
// ===========================================================================

/// A user reference for story circles, viewer header, and avatar fallbacks.
@immutable
class StoryAuthorRef {
  const StoryAuthorRef({
    required this.id,
    required this.displayName,
    this.username,
    this.avatarUrl,
  });

  final String id;
  final String displayName;
  final String? username;
  final String? avatarUrl;

  /// First grapheme of the display name (or '?'), upper-cased, for the fallback.
  String get initial {
    final trimmed = displayName.trim();
    if (trimmed.isEmpty) return '?';
    return trimmed.characters.first.toUpperCase();
  }
}

/// One story within a user's set.
@immutable
class StoryItemView {
  const StoryItemView({
    required this.id,
    required this.kind,
    required this.createdAtMillis,
    this.mediaUrl,
    this.localPath,
    this.isOwn = false,
    this.viewsCount = 0,
  });

  final String id;
  final CreateMediaKind kind;
  final int createdAtMillis;

  /// Remote media URL (used when [localPath] is absent / missing on disk).
  final String? mediaUrl;
  final String? localPath;

  /// True when the current user owns this story (enables delete + views pill,
  /// hides the reply/reaction bar).
  final bool isOwn;
  final int viewsCount;

  bool get isVideo => kind == CreateMediaKind.video;
}

/// A user's grouped story set + the viewed flag (drives the ring color).
@immutable
class UserStoriesView {
  const UserStoriesView({
    required this.author,
    required this.stories,
    this.hasViewed = false,
    this.unreadCount = 0,
  });

  final StoryAuthorRef author;
  final List<StoryItemView> stories;
  final bool hasViewed;

  /// Optional badge count on the circle.
  final int unreadCount;

  bool get isOwn => stories.isNotEmpty && stories.first.isOwn;
}

/// The 8 default story reaction emojis (parity with web DEFAULT_EMOJIS). Copied
/// locally per the no-cross-feature-import rule.
class StoryReactionCatalog {
  const StoryReactionCatalog._();

  static const List<String> defaults = [
    '❤️',
    '🔥',
    '😂',
    '👍',
    '🎉',
    '🏆',
    '😍',
    '👏',
  ];
}

// ===========================================================================
// Upload progress & queue
// ===========================================================================

/// Single-upload progress state ported from web `useUploadProgress`. Drives both
/// the floating toast and the blocking overlay. Pure data — no widgets.
@immutable
class UploadProgressView {
  const UploadProgressView({
    this.progress = 0,
    this.isUploading = false,
    this.error,
    this.fileName,
  });

  /// 0..100 (clamp at construction via [UploadProgressView.clamped]).
  final int progress;
  final bool isUploading;

  /// Human-readable failure message (cleaned of Postgrest/Storage prefixes by
  /// the service layer before reaching here).
  final String? error;

  /// Optional truncated label under the bar.
  final String? fileName;

  bool get hasError => error != null;
  bool get isComplete => progress >= 100 && !isUploading && error == null;

  /// True when the toast/overlay should be on screen at all.
  bool get isVisible => isUploading || hasError || isComplete;

  factory UploadProgressView.clamped({
    int progress = 0,
    bool isUploading = false,
    String? error,
    String? fileName,
  }) {
    final p = progress < 0 ? 0 : (progress > 100 ? 100 : progress);
    return UploadProgressView(
      progress: p,
      isUploading: isUploading,
      error: error,
      fileName: fileName,
    );
  }

  UploadProgressView startUpload({String? fileName}) =>
      UploadProgressView(progress: 0, isUploading: true, fileName: fileName);

  UploadProgressView updateProgress(int value) => UploadProgressView.clamped(
    progress: value,
    isUploading: true,
    fileName: fileName,
  );

  UploadProgressView completeUpload() =>
      UploadProgressView(progress: 100, isUploading: false, fileName: fileName);

  UploadProgressView failUpload(String message) => UploadProgressView(
    progress: progress,
    isUploading: false,
    error: message,
    fileName: fileName,
  );

  static const UploadProgressView reset = UploadProgressView();
}

/// Blocking overlay descriptor (story upload, etc.).
@immutable
class UploadOverlayView {
  const UploadOverlayView({
    this.isVisible = false,
    this.label = 'Uploading',
    this.progress,
  });

  final bool isVisible;
  final String label;

  /// 0..100 — null renders an indeterminate bar.
  final int? progress;
}

/// One row in the drafts/queue panel.
@immutable
class UploadQueueItemView {
  const UploadQueueItemView({
    required this.draftId,
    required this.title,
    required this.status,
    required this.createdAtMillis,
    this.mediaType,
    this.progress,
    this.errorMessage,
    this.retryCount = 0,
  });

  /// Stable id / list key (from UploadQueueItem / PostDraft.id).
  final String draftId;

  /// Caption, or a 'Media draft' fallback (resolved by the mapper).
  final String title;
  final DraftStatus status;
  final int createdAtMillis;

  /// 'image' | 'video' | null -> leading icon + type chip.
  final String? mediaType;

  /// Per-row percent while [status]==uploading; null => indeterminate.
  final int? progress;
  final String? errorMessage;
  final int retryCount;

  bool get isUploading => status == DraftStatus.uploading;
  bool get isFailed => status == DraftStatus.failed;
  bool get isQueued => status == DraftStatus.queued;
  bool get isLocal => status == DraftStatus.local;
  bool get isUploaded => status == DraftStatus.uploaded;
}

/// Bundle of per-row queue callbacks.
@immutable
class UploadQueueCallbacks {
  const UploadQueueCallbacks({
    required this.onRetry,
    required this.onCancel,
    required this.onQueue,
    required this.onDelete,
    this.onRefresh,
  });

  final ValueChanged<String> onRetry;
  final ValueChanged<String> onCancel;
  final ValueChanged<String> onQueue;
  final ValueChanged<String> onDelete;
  final VoidCallback? onRefresh;
}

/// Aggregate post-process banner model (maps to UploadQueueSummary).
@immutable
class QueueSummaryView {
  const QueueSummaryView({required this.message, this.isError = false});

  final String message;
  final bool isError;
}

// ===========================================================================
// Shared helpers
// ===========================================================================

/// Relative-time formatter ('just now', '2h ago', '3d ago') — a tiny pure-Dart
/// equivalent of date-fns formatDistanceToNow, used by the story viewer header.
String formatRelativeTime(int epochMillis, {int? nowMillis}) {
  final now = nowMillis ?? DateTime.now().millisecondsSinceEpoch;
  final diff = now - epochMillis;
  if (diff < 0) return 'just now';
  final seconds = diff ~/ 1000;
  if (seconds < 60) return 'just now';
  final minutes = seconds ~/ 60;
  if (minutes < 60) return '${minutes}m ago';
  final hours = minutes ~/ 60;
  if (hours < 24) return '${hours}h ago';
  final days = hours ~/ 24;
  if (days < 7) return '${days}d ago';
  final weeks = days ~/ 7;
  if (weeks < 5) return '${weeks}w ago';
  final months = days ~/ 30;
  if (months < 12) return '${months}mo ago';
  return '${days ~/ 365}y ago';
}
