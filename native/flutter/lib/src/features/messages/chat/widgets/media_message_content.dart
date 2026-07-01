import 'dart:io';

import 'package:flutter/material.dart';

import '../audio_message_support.dart';
import '../chat_theme.dart';
import '../chat_view_models.dart';

/// Inline media body for a chat bubble. Designed to be handed to
/// `ChatMessageBubble.mediaSlot` so it inherits the bubble's chrome (padding,
/// background, rounded corners) rather than painting its own bubble.
///
/// It reads [ChatMessageView.media] and dispatches on [ChatMessageView.mediaKind]:
///
///  * IMAGE -> a rounded (`ChatRadii.md`) thumbnail (max ~260x340) drawn from the
///    local file (preferred) or the remote URL, with a bottom dark gradient
///    overlay carrying a size chip on the left and a maximize button on the
///    right. Tapping anywhere -> [onOpenViewer].
///  * VIDEO -> the same framed thumbnail using `media.thumbnailUrl` as a poster,
///    plus a centered circular play overlay. This widget NEVER initialises a
///    `VideoPlayerController`; the full-screen viewer owns playback. Tap ->
///    [onOpenViewer].
///  * FILE -> a horizontal card: a rounded icon tile, a name + size column, and
///    a trailing download/open button -> [onDownload].
///  * AUDIO -> a minimal generic audio chip (a play affordance + label). The
///    dedicated `VoiceNoteBubble` owns the rich voice UI; this is the fallback
///    for a plain audio attachment.
///
/// For non-own media that is not yet ready, a download state machine is drawn:
/// `idle` -> a "Tap to download" placeholder (-> [onDownload]); `downloading` ->
/// a circular progress ring with a percentage; `error` -> a "Tap to retry" tile
/// (-> [onRetryDownload]); once `downloaded` (or for own media, always) the real
/// media is revealed.
///
/// Purely presentational: no network/file IO, no `VideoPlayerController`, no
/// Supabase/repository access. The parent supplies download state + callbacks.
class MediaMessageContent extends StatelessWidget {
  const MediaMessageContent({
    super.key,
    required this.message,
    this.onOpenViewer,
    this.onDownload,
    this.onRetryDownload,
  });

  /// The message whose [ChatMessageView.media] payload is rendered.
  final ChatMessageView message;

  /// Open the full-screen viewer (image/video). The viewer owns playback.
  final VoidCallback? onOpenViewer;

  /// Begin (or, for files, open) a download. Used by file rows and by the
  /// `idle` placeholder tile.
  final VoidCallback? onDownload;

  /// Retry a previously failed download (the `error` tile).
  final VoidCallback? onRetryDownload;

  // Web parity: thumbnails clamp to 260x340 (image) / 260x360 (video). We use a
  // single max box and let BoxFit.cover crop.
  static const double _thumbMaxWidth = 260;
  static const double _thumbMaxHeight = 340;
  static const double _placeholderMinWidth = 180;
  static const double _placeholderMinHeight = 78;

  MessageMedia? get _media => message.media;

  /// Own media is always treated as ready; everything else follows the media's
  /// own [MessageMedia.isReady] flag (localPath present or state==downloaded).
  bool get _isReady => message.isMine || (_media?.isReady ?? false);

  @override
  Widget build(BuildContext context) {
    final media = _media;
    if (media == null || media.kind == ChatMediaKind.none) {
      return const SizedBox.shrink();
    }

    // Files always render as a card row (they carry their own download/open
    // affordance inline and don't need the placeholder state machine).
    if (media.kind == ChatMediaKind.file) {
      return _FileCard(media: media, isMine: message.isMine, onTap: onDownload);
    }

    // Audio falls back to a compact chip; the rich voice UI lives elsewhere
    // (VoiceNoteBubble, injected by the screen for audio notes).
    if (media.kind == ChatMediaKind.audio) {
      return _AudioChip(media: media, isMine: message.isMine);
    }

    // Music files fall back to a compact music chip; the rich track UI lives in
    // MusicMessageBubble, injected by the screen. This keeps a music attachment
    // from ever being mis-rendered as an image when no dedicated slot is wired.
    if (media.kind == ChatMediaKind.music) {
      return _MusicChip(media: media, isMine: message.isMine);
    }

    // Image / video: gated behind the download state machine for non-own media.
    if (!_isReady) {
      return _DownloadGate(
        media: media,
        isMine: message.isMine,
        onDownload: onDownload,
        onRetryDownload: onRetryDownload,
      );
    }

    if (media.kind == ChatMediaKind.video) {
      return _VideoThumbnail(media: media, onTap: onOpenViewer);
    }
    return _ImageThumbnail(media: media, onTap: onOpenViewer);
  }
}

// ---------------------------------------------------------------------------
// Image thumbnail
// ---------------------------------------------------------------------------

class _ImageThumbnail extends StatelessWidget {
  const _ImageThumbnail({required this.media, this.onTap});

  final MessageMedia media;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _FramedThumbnail(
      onTap: onTap,
      image: _MediaImage(media: media, preferLocal: true),
      overlay: _BottomChromeOverlay(
        icon: Icons.image_outlined,
        sizeBytes: media.fileSizeBytes,
        onMaximize: onTap,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Video thumbnail (poster + play overlay; no inline playback)
// ---------------------------------------------------------------------------

class _VideoThumbnail extends StatelessWidget {
  const _VideoThumbnail({required this.media, this.onTap});

  final MessageMedia media;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    // Poster: prefer an explicit thumbnail; fall back to the (possibly local)
    // media frame so we still show *something*. No VideoPlayer is created here.
    final Widget poster = media.thumbnailUrl != null
        ? Image.network(
            media.thumbnailUrl!,
            fit: BoxFit.cover,
            width: double.infinity,
            errorBuilder: (_, __, ___) =>
                const _ThumbFallback(icon: Icons.movie_outlined),
          )
        : _MediaImage(
            media: media,
            preferLocal: true,
            fallbackIcon: Icons.movie_outlined,
          );

    return _FramedThumbnail(
      onTap: onTap,
      image: poster,
      foreground: const Center(child: _PlayBadge()),
      // Web uses a flat black/25 scrim behind the play badge for videos.
      scrim: const DecoratedBox(
        decoration: BoxDecoration(color: Color(0x40000000)),
      ),
      overlay: _BottomChromeOverlay(
        icon: Icons.movie_outlined,
        sizeBytes: media.fileSizeBytes,
        onMaximize: onTap,
      ),
    );
  }
}

/// Centered circular play button shown over a video poster.
class _PlayBadge extends StatelessWidget {
  const _PlayBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        color: Color(0x40FFFFFF),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: const Padding(
        padding: EdgeInsets.only(left: 2),
        child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: 24),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared framed thumbnail shell (used by image + video)
// ---------------------------------------------------------------------------

class _FramedThumbnail extends StatelessWidget {
  const _FramedThumbnail({
    required this.image,
    this.overlay,
    this.foreground,
    this.scrim,
    this.onTap,
  });

  final Widget image;

  /// Bottom chrome (size chip + maximize), pinned to the lower edge.
  final Widget? overlay;

  /// Centered foreground (e.g. the video play badge).
  final Widget? foreground;

  /// Optional full-bleed scrim painted above the image but below [foreground].
  final Widget? scrim;

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: ClipRRect(
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            maxWidth: MediaMessageContent._thumbMaxWidth,
            maxHeight: MediaMessageContent._thumbMaxHeight,
            minWidth: 120,
            minHeight: 90,
          ),
          child: Material(
            color: ChatColors.muted,
            child: InkWell(
              onTap: onTap,
              child: Stack(
                fit: StackFit.passthrough,
                children: [
                  Positioned.fill(
                    child: FittedBox(
                      fit: BoxFit.cover,
                      clipBehavior: Clip.hardEdge,
                      child: image,
                    ),
                  ),
                  if (scrim != null) Positioned.fill(child: scrim!),
                  // Top-to-bottom dark gradient so the chip/buttons stay legible.
                  const Positioned.fill(
                    child: IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [Color(0x4D000000), Color(0x00000000)],
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (foreground != null) Positioned.fill(child: foreground!),
                  if (overlay != null)
                    Positioned(left: 0, right: 0, bottom: 0, child: overlay!),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Resolves the best available [ImageProvider] for a media payload and renders
/// it; falls back to a neutral icon tile when nothing loads.
class _MediaImage extends StatelessWidget {
  const _MediaImage({
    required this.media,
    this.preferLocal = true,
    this.fallbackIcon = Icons.image_outlined,
  });

  final MessageMedia media;
  final bool preferLocal;
  final IconData fallbackIcon;

  @override
  Widget build(BuildContext context) {
    final localPath = media.localPath;
    final remoteUrl = media.remoteUrl;

    if (preferLocal && localPath != null && localPath.isNotEmpty) {
      return Image.file(
        File(localPath),
        fit: BoxFit.cover,
        width: double.infinity,
        errorBuilder: (_, __, ___) => _remoteOrFallback(remoteUrl),
      );
    }
    return _remoteOrFallback(remoteUrl);
  }

  Widget _remoteOrFallback(String? remoteUrl) {
    if (remoteUrl != null && remoteUrl.isNotEmpty) {
      return Image.network(
        remoteUrl,
        fit: BoxFit.cover,
        width: double.infinity,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return const _ThumbFallback(loading: true);
        },
        errorBuilder: (_, __, ___) => _ThumbFallback(icon: fallbackIcon),
      );
    }
    return _ThumbFallback(icon: fallbackIcon);
  }
}

/// Neutral placeholder painted when an image fails / is mid-load. Sized to fill
/// the framed thumbnail box.
class _ThumbFallback extends StatelessWidget {
  const _ThumbFallback({
    this.icon = Icons.image_outlined,
    this.loading = false,
  });

  final IconData icon;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: MediaMessageContent._thumbMaxWidth,
      height: 160,
      color: ChatColors.muted,
      alignment: Alignment.center,
      child: loading
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(
                  ChatColors.mutedForeground,
                ),
              ),
            )
          : Icon(icon, color: ChatColors.mutedForeground, size: 28),
    );
  }
}

/// Bottom-edge chrome: a translucent size chip on the left, a maximize button
/// on the right.
class _BottomChromeOverlay extends StatelessWidget {
  const _BottomChromeOverlay({
    required this.icon,
    required this.sizeBytes,
    this.onMaximize,
  });

  final IconData icon;
  final int? sizeBytes;
  final VoidCallback? onMaximize;

  @override
  Widget build(BuildContext context) {
    final sizeText = formatFileSize(sizeBytes);
    return Padding(
      padding: const EdgeInsets.all(6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: const BoxDecoration(
              color: Color(0x66000000),
              borderRadius: ChatRadii.chip,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 10, color: const Color(0xE6FFFFFF)),
                if (sizeText.isNotEmpty) ...[
                  const SizedBox(width: 3),
                  Text(
                    sizeText,
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w500,
                      color: Color(0xE6FFFFFF),
                    ),
                  ),
                ],
              ],
            ),
          ),
          _RoundIconButton(onTap: onMaximize),
        ],
      ),
    );
  }
}

/// Small translucent circular maximize button used in the bottom chrome.
class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0x66000000),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: const SizedBox(
          width: 24,
          height: 24,
          child: Icon(Icons.fullscreen_rounded, size: 14, color: Colors.white),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// File card
// ---------------------------------------------------------------------------

class _FileCard extends StatelessWidget {
  const _FileCard({required this.media, required this.isMine, this.onTap});

  final MessageMedia media;
  final bool isMine;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final name = media.fileName ?? 'File';
    final sizeText = formatFileSize(media.fileSizeBytes);
    // On an outgoing (own) bubble the surface is the pink gradient, so tint the
    // inline card with translucent white; otherwise use the faint-primary wash.
    final tileColor = isMine
        ? const Color(0x33FFFFFF)
        : ChatColors.primaryFaint;
    final iconColor = isMine ? Colors.white : ChatColors.primary;
    final nameColor = isMine ? Colors.white : ChatColors.foreground;
    final subColor = isMine
        ? const Color(0xCCFFFFFF)
        : ChatColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 200, maxWidth: 280),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: tileColor,
                      borderRadius: const BorderRadius.all(
                        Radius.circular(ChatRadii.sm),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      Icons.insert_drive_file_outlined,
                      size: 18,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: nameColor,
                          ),
                        ),
                        if (sizeText.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            sizeText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 11, color: subColor),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(Icons.download_rounded, size: 18, color: subColor),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Audio chip (minimal fallback; rich voice UI lives in VoiceNoteBubble)
// ---------------------------------------------------------------------------

class _AudioChip extends StatelessWidget {
  const _AudioChip({required this.media, required this.isMine});

  final MessageMedia media;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final durationText = formatMediaDuration(media.audioDurationMs);
    final tint = isMine ? Colors.white : ChatColors.primary;
    final sub = isMine ? const Color(0xCCFFFFFF) : ChatColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Container(
        constraints: const BoxConstraints(minWidth: 160),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint,
          borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: isMine
                    ? const Color(0x33FFFFFF)
                    : ChatColors.primaryFaint,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(Icons.play_arrow_rounded, size: 18, color: tint),
            ),
            const SizedBox(width: 8),
            Icon(Icons.graphic_eq_rounded, size: 16, color: sub),
            const SizedBox(width: 6),
            Text(
              durationText.isNotEmpty ? durationText : 'Audio',
              style: TextStyle(fontSize: 12, color: sub),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Music chip (minimal fallback; rich track UI lives in MusicMessageBubble)
// ---------------------------------------------------------------------------

class _MusicChip extends StatelessWidget {
  const _MusicChip({required this.media, required this.isMine});

  final MessageMedia media;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final title = (media.musicTitle?.trim().isNotEmpty ?? false)
        ? media.musicTitle!.trim()
        : (media.fileName ?? 'Audio track');
    final durationText = formatMediaDuration(media.audioDurationMs);
    final tint = isMine ? Colors.white : ChatColors.primary;
    final sub = isMine ? const Color(0xCCFFFFFF) : ChatColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Container(
        constraints: const BoxConstraints(minWidth: 180, maxWidth: 260),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint,
          borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: isMine
                    ? const Color(0x33FFFFFF)
                    : ChatColors.primaryFaint,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(Icons.music_note_rounded, size: 18, color: tint),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isMine ? Colors.white : ChatColors.foreground,
                    ),
                  ),
                  if (durationText.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      durationText,
                      style: TextStyle(fontSize: 11, color: sub),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Download state machine (image / video, non-own, not yet ready)
// ---------------------------------------------------------------------------

class _DownloadGate extends StatelessWidget {
  const _DownloadGate({
    required this.media,
    required this.isMine,
    this.onDownload,
    this.onRetryDownload,
  });

  final MessageMedia media;
  final bool isMine;
  final VoidCallback? onDownload;
  final VoidCallback? onRetryDownload;

  @override
  Widget build(BuildContext context) {
    switch (media.downloadState) {
      case MediaDownloadState.downloading:
        return _GateShell(
          child: _DownloadingTile(progress: media.downloadProgress),
        );
      case MediaDownloadState.error:
        return _GateShell(onTap: onRetryDownload, child: const _ErrorTile());
      case MediaDownloadState.idle:
      case MediaDownloadState.downloaded:
        // `downloaded` should have been intercepted by the ready path; treat any
        // residual case here as an idle placeholder so we never dead-end.
        return _GateShell(
          onTap: onDownload,
          child: _IdleTile(media: media),
        );
    }
  }
}

/// Common bordered tile shell that hosts a download-state body.
class _GateShell extends StatelessWidget {
  const _GateShell({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: ChatColors.muted,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minWidth: MediaMessageContent._placeholderMinWidth,
              minHeight: MediaMessageContent._placeholderMinHeight,
              maxWidth: MediaMessageContent._thumbMaxWidth,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
              child: Center(child: child),
            ),
          ),
        ),
      ),
    );
  }
}

class _IdleTile extends StatelessWidget {
  const _IdleTile({required this.media});

  final MessageMedia media;

  @override
  Widget build(BuildContext context) {
    final sizeText = formatFileSize(media.fileSizeBytes);
    final label = _kindLabel(media.kind);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            color: ChatColors.primaryFaint,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Icon(
            _kindIcon(media.kind),
            size: 22,
            color: ChatColors.primary,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          sizeText.isNotEmpty ? '$label • $sizeText' : label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: ChatColors.foreground,
          ),
        ),
        const SizedBox(height: 3),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(
              Icons.download_rounded,
              size: 11,
              color: ChatColors.mutedForeground,
            ),
            SizedBox(width: 4),
            Text('Tap to download', style: ChatTextStyles.timestamp),
          ],
        ),
      ],
    );
  }
}

class _DownloadingTile extends StatelessWidget {
  const _DownloadingTile({required this.progress});

  /// 0..1 download progress.
  final double progress;

  @override
  Widget build(BuildContext context) {
    final clamped = progress.clamp(0.0, 1.0);
    final percent = (clamped * 100).round();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 48,
          height: 48,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: CircularProgressIndicator(
                  value: clamped == 0 ? null : clamped,
                  strokeWidth: 2.5,
                  backgroundColor: ChatColors.primaryFaint,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    ChatColors.primary,
                  ),
                ),
              ),
              Text(
                '$percent%',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: ChatColors.primary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        const Text('Downloading…', style: ChatTextStyles.timestamp),
      ],
    );
  }
}

class _ErrorTile extends StatelessWidget {
  const _ErrorTile();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: const [
        DecoratedBox(
          decoration: BoxDecoration(
            color: Color(0x1AEF4343),
            shape: BoxShape.circle,
          ),
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(
              Icons.refresh_rounded,
              size: 22,
              color: ChatColors.destructive,
            ),
          ),
        ),
        SizedBox(height: 10),
        Text(
          'Download failed',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: ChatColors.destructive,
          ),
        ),
        SizedBox(height: 3),
        Text('Tap to retry', style: ChatTextStyles.timestamp),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Kind helpers
// ---------------------------------------------------------------------------

IconData _kindIcon(ChatMediaKind kind) {
  switch (kind) {
    case ChatMediaKind.image:
      return Icons.image_outlined;
    case ChatMediaKind.video:
      return Icons.movie_outlined;
    case ChatMediaKind.audio:
      return Icons.mic_none_rounded;
    case ChatMediaKind.music:
      return Icons.music_note_rounded;
    case ChatMediaKind.file:
      return Icons.insert_drive_file_outlined;
    case ChatMediaKind.callLog:
      return Icons.call_outlined;
    case ChatMediaKind.none:
      return Icons.attachment_rounded;
  }
}

String _kindLabel(ChatMediaKind kind) {
  switch (kind) {
    case ChatMediaKind.image:
      return 'Photo';
    case ChatMediaKind.video:
      return 'Video';
    case ChatMediaKind.audio:
      return 'Voice message';
    case ChatMediaKind.music:
      return 'Music';
    case ChatMediaKind.file:
      return 'File';
    case ChatMediaKind.callLog:
      return 'Call';
    case ChatMediaKind.none:
      return 'Attachment';
  }
}
