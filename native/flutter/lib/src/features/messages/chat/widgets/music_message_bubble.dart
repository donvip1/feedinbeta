// Music / audio-FILE chat bubble.
//
// This is the "music-specific chat bubble" from the plan: a track-style card
// with an artwork glyph, a track TITLE, a play/pause control, a draggable
// SCRUBBER, and an elapsed/duration label. It is deliberately distinct from the
// generic file card (see `MediaMessageContent._FileCard`) and from the recorded
// audio-note waveform (`VoiceNoteBubble`).
//
// Web parity: mirrors the audio branch of the messaging media bubbles
// (src/components/messages/MediaMessageBubble.tsx / WaveformPlayer.tsx) — a
// play/pause button, a progress track, and a time label — adapted to a
// track-title-forward layout for a shared music file.
//
// Fully CONTROLLED: the parent passes [isPlaying]/[positionMs] and handles
// [onTogglePlay]/[onSeek]. This widget performs NO audio decode or playback; a
// real player is wired through the AudioPlaybackController seam
// (chat/audio_message_support.dart). Designed to be passed as
// `ChatMessageBubble.mediaSlot` for `ChatMediaKind.music` messages.

import 'package:flutter/material.dart';

import '../audio_message_support.dart';
import '../chat_theme.dart';
import '../chat_view_models.dart';

class MusicMessageBubble extends StatelessWidget {
  const MusicMessageBubble({
    super.key,
    required this.message,
    this.isPlaying = false,
    this.positionMs = 0,
    this.onTogglePlay,
    this.onSeek,
  });

  /// The music message to render. Expected [ChatMessageView.mediaKind] is
  /// [ChatMediaKind.music]; the widget reads its [MessageMedia].
  final ChatMessageView message;

  /// Whether the parent considers this track currently playing (drives icon).
  final bool isPlaying;

  /// Current playback position in milliseconds, supplied by the parent.
  final int positionMs;

  /// Toggle play/pause (or trigger a download of a not-yet-local incoming file).
  final VoidCallback? onTogglePlay;

  /// Seek to a position in ms while dragging the scrubber (parent-owned).
  final ValueChanged<int>? onSeek;

  MessageMedia? get _media => message.media;

  bool get _isMine => message.isMine;

  int get _durationMs => _media?.audioDurationMs ?? 0;

  String get _title {
    final media = _media;
    final title = media?.musicTitle?.trim();
    if (title != null && title.isNotEmpty) return title;
    final name = media?.fileName?.trim();
    if (name != null && name.isNotEmpty) return name;
    return 'Audio track';
  }

  /// Whether an incoming file still needs downloading before it can play.
  bool get _needsDownload {
    final media = _media;
    if (media == null || _isMine) return false;
    return media.downloadState != MediaDownloadState.downloaded &&
        media.localPath == null;
  }

  Color get _fg => _isMine ? ChatColors.primaryForeground : ChatColors.foreground;

  Color get _accent => _isMine ? ChatColors.primaryForeground : ChatColors.primary;

  Color get _sub => _isMine
      ? ChatColors.primaryForeground.withValues(alpha: 0.85)
      : ChatColors.mutedForeground;

  double get _progress {
    if (_durationMs <= 0) return 0;
    return (positionMs / _durationMs).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final durationText = formatMediaDuration(_durationMs);
    final elapsedText = formatMediaDuration(positionMs);

    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 220, maxWidth: 280),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: _isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint,
          borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.md)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                _PlayButton(
                  isPlaying: isPlaying,
                  isDownloading:
                      _media?.downloadState == MediaDownloadState.downloading,
                  needsDownload: _needsDownload,
                  tint: _accent,
                  onPressed: onTogglePlay,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.music_note_rounded,
                            size: 14,
                            color: _sub,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              _title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: _fg,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (formatFileSize(_media?.fileSizeBytes).isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          formatFileSize(_media?.fileSizeBytes),
                          style: TextStyle(fontSize: 11, color: _sub),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _Scrubber(
              progress: _progress,
              activeColor: _accent,
              inactiveColor: _isMine
                  ? ChatColors.primaryForeground.withValues(alpha: 0.30)
                  : ChatColors.primarySoft,
              enabled: onSeek != null && _durationMs > 0,
              onSeekFraction: (fraction) {
                if (_durationMs > 0) {
                  onSeek?.call((fraction * _durationMs).round());
                }
              },
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  elapsedText.isEmpty ? '0:00' : elapsedText,
                  style: ChatTextStyles.timestamp.copyWith(color: _sub),
                ),
                Text(
                  durationText.isEmpty ? '--:--' : durationText,
                  style: ChatTextStyles.timestamp.copyWith(color: _sub),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Circular play / pause control (also surfaces download state for incoming
/// files not yet fetched).
class _PlayButton extends StatelessWidget {
  const _PlayButton({
    required this.isPlaying,
    required this.isDownloading,
    required this.needsDownload,
    required this.tint,
    required this.onPressed,
  });

  final bool isPlaying;
  final bool isDownloading;
  final bool needsDownload;
  final Color tint;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    const double size = 40;

    Widget glyph;
    if (isDownloading) {
      glyph = SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(tint),
        ),
      );
    } else if (needsDownload) {
      glyph = Icon(Icons.download_rounded, size: 22, color: tint);
    } else {
      glyph = Icon(
        isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
        size: 24,
        color: tint,
      );
    }

    return Semantics(
      button: true,
      label: needsDownload
          ? 'Download track'
          : (isPlaying ? 'Pause track' : 'Play track'),
      child: Material(
        color: tint.withValues(alpha: 0.16),
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: isDownloading ? null : onPressed,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: size,
            height: size,
            child: Center(child: glyph),
          ),
        ),
      ),
    );
  }
}

/// A slim draggable progress track. When [enabled] the whole strip is a
/// [GestureDetector] that maps horizontal position to a 0..1 fraction; when
/// disabled (no duration / no seek handler) it is a static progress bar.
class _Scrubber extends StatelessWidget {
  const _Scrubber({
    required this.progress,
    required this.activeColor,
    required this.inactiveColor,
    required this.enabled,
    required this.onSeekFraction,
  });

  final double progress;
  final Color activeColor;
  final Color inactiveColor;
  final bool enabled;
  final ValueChanged<double> onSeekFraction;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;

        void handle(double dx) {
          if (width <= 0) return;
          onSeekFraction((dx / width).clamp(0.0, 1.0));
        }

        final bar = SizedBox(
          height: 18,
          width: double.infinity,
          child: Stack(
            alignment: Alignment.centerLeft,
            children: [
              // Track.
              Container(
                height: 4,
                decoration: BoxDecoration(
                  color: inactiveColor,
                  borderRadius: const BorderRadius.all(Radius.circular(2)),
                ),
              ),
              // Filled portion.
              FractionallySizedBox(
                widthFactor: progress.clamp(0.0, 1.0),
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: activeColor,
                    borderRadius: const BorderRadius.all(Radius.circular(2)),
                  ),
                ),
              ),
              // Thumb.
              Align(
                alignment: Alignment(
                  (progress.clamp(0.0, 1.0) * 2) - 1,
                  0,
                ),
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: activeColor,
                    shape: BoxShape.circle,
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x33000000),
                        blurRadius: 2,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );

        if (!enabled) return bar;

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (d) => handle(d.localPosition.dx),
          onHorizontalDragStart: (d) => handle(d.localPosition.dx),
          onHorizontalDragUpdate: (d) => handle(d.localPosition.dx),
          child: bar,
        );
      },
    );
  }
}
