// Voice/audio message bubble — PRESENTATION-ONLY SCAFFOLD.
//
// This widget renders the in-bubble voice player UI (play/pause button, a
// synthetic waveform, and an elapsed/duration label) to reach visual parity
// with the web `WaveformPlayer` (src/components/messages/WaveformPlayer.tsx).
// It performs NO audio decode, capture, or playback: it is driven entirely by
// the [isPlaying] and [positionMs] props so the parent screen can animate it.
//
// Real voice notes need a capture/playback package that is NOT in the allowed
// pubspec set:
//   - recording (mic capture):   `record`
//   - decode + playback + seek:  `just_audio`
// The web app uses `wavesurfer.js` for the real waveform; on Flutter the parent
// can wire playback through `video_player` for audio-only sources as a stopgap,
// but seek-accurate waveform progress is best served by `just_audio`. Those are
// reported back via depsNeeded — this file intentionally scaffolds around them
// so the build never breaks.
//
// Designed to be passed as `ChatMessageBubble.mediaSlot` for audio messages.

import 'package:flutter/material.dart';

import '../chat_theme.dart';
import '../chat_view_models.dart';

/// Number of synthetic waveform bars rendered across the player.
const int _kBarCount = 28;

/// In-bubble voice/audio player UI scaffold.
///
/// Fully controlled: pass [isPlaying]/[positionMs] from the parent and call
/// back through [onTogglePlay]. There are no internal timers or controllers.
class VoiceNoteBubble extends StatelessWidget {
  const VoiceNoteBubble({
    super.key,
    required this.message,
    this.isPlaying = false,
    this.positionMs = 0,
    this.onTogglePlay,
  });

  /// The audio message to render. Expected [ChatMessageView.mediaKind] is
  /// [ChatMediaKind.audio]; the widget reads its [MessageMedia].
  final ChatMessageView message;

  /// Whether the parent considers this note currently playing (drives icon).
  final bool isPlaying;

  /// Current playback position in milliseconds, supplied by the parent.
  final int positionMs;

  /// Invoked when the user taps the play/pause control (or the download
  /// affordance for a not-yet-downloaded incoming note).
  final VoidCallback? onTogglePlay;

  bool get _isMine => message.isMine;

  /// The active (filled / progressed) tint: white on the gradient outgoing
  /// bubble, brand pink on the incoming card bubble.
  Color get _activeColor =>
      _isMine ? ChatColors.primaryForeground : ChatColors.primary;

  /// The inactive (un-played) tint — a faded version of the active color.
  Color get _inactiveColor => _isMine
      ? ChatColors.primaryForeground.withValues(alpha: 0.45)
      : ChatColors.mutedForeground;

  /// Time label color (slightly muted to match the web `/80` opacity).
  Color get _labelColor => _isMine
      ? ChatColors.primaryForeground.withValues(alpha: 0.85)
      : ChatColors.mutedForeground;

  int get _durationMs => message.media?.audioDurationMs ?? 0;

  /// 0..1 playback fraction, clamped. Falls back to 0 when duration unknown.
  double get _progress {
    if (_durationMs <= 0) return 0;
    return (positionMs / _durationMs).clamp(0.0, 1.0);
  }

  /// Whether an incoming note still needs downloading before it can play.
  bool get _needsDownload {
    final media = message.media;
    if (media == null) return false;
    if (_isMine) return false;
    return media.downloadState != MediaDownloadState.downloaded &&
        media.localPath == null;
  }

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 200, maxWidth: 240),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _PlayButton(
            isPlaying: isPlaying,
            isDownloading:
                message.media?.downloadState == MediaDownloadState.downloading,
            needsDownload: _needsDownload,
            tint: _activeColor,
            onPressed: onTogglePlay,
          ),
          const SizedBox(width: ChatSpacing.sm),
          Expanded(
            child: _needsDownload
                ? _DownloadFallback(tint: _activeColor, onTap: onTogglePlay)
                : _Waveform(
                    seed: message.id.hashCode,
                    progress: _progress,
                    activeColor: _activeColor,
                    inactiveColor: _inactiveColor,
                  ),
          ),
          const SizedBox(width: ChatSpacing.sm),
          Text(
            _timeLabel(),
            style: ChatTextStyles.timestamp.copyWith(color: _labelColor),
          ),
        ],
      ),
    );
  }

  /// Shows elapsed time while playing (or once started), otherwise the total
  /// duration — matching the web component's `isPlaying ? currentTime : duration`.
  String _timeLabel() {
    final showElapsed = isPlaying || positionMs > 0;
    final ms = showElapsed ? positionMs : _durationMs;
    return _formatMmSs(ms);
  }
}

/// Circular play / pause control. Also surfaces a busy spinner while an
/// incoming note is downloading, and a download glyph when it is not yet local.
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
    const double size = 34;

    Widget glyph;
    if (isDownloading) {
      glyph = SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(tint),
        ),
      );
    } else if (needsDownload) {
      glyph = Icon(Icons.download_rounded, size: 20, color: tint);
    } else {
      glyph = Icon(
        isPlaying ? Icons.pause : Icons.play_arrow,
        size: 22,
        color: tint,
      );
    }

    return Semantics(
      button: true,
      label: needsDownload
          ? 'Download voice message'
          : (isPlaying ? 'Pause voice message' : 'Play voice message'),
      child: Material(
        color: tint.withValues(alpha: 0.14),
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

/// A deterministic synthetic waveform: [_kBarCount] thin vertical bars whose
/// heights are derived from [seed] (so they are stable across rebuilds). Bars
/// to the left of the playback [progress] point use [activeColor]; the rest
/// use [inactiveColor].
class _Waveform extends StatelessWidget {
  const _Waveform({
    required this.seed,
    required this.progress,
    required this.activeColor,
    required this.inactiveColor,
  });

  final int seed;
  final double progress;
  final Color activeColor;
  final Color inactiveColor;

  /// Deterministic pseudo-random bar height in the 0.25..1.0 range for [index].
  double _heightFactor(int index) {
    // Simple, stable hash mix — no dart:math.Random so it never drifts.
    var h = (seed ^ (index * 0x9E3779B1)) & 0x7FFFFFFF;
    h = (h ^ (h >> 13)) * 0x5BD1E995;
    final unit = ((h >> 8) & 0xFFFF) / 0xFFFF; // 0..1
    return 0.25 + unit * 0.75;
  }

  @override
  Widget build(BuildContext context) {
    const double maxBarHeight = 26;
    final int filledBars = (progress * _kBarCount).round();

    return SizedBox(
      height: maxBarHeight,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: List<Widget>.generate(_kBarCount, (i) {
          final isActive = i < filledBars;
          return Container(
            width: 2.5,
            height: maxBarHeight * _heightFactor(i),
            decoration: BoxDecoration(
              color: isActive ? activeColor : inactiveColor,
              borderRadius: const BorderRadius.all(Radius.circular(2)),
            ),
          );
        }),
      ),
    );
  }
}

/// Tap-to-download strip shown for an incoming note that has not been fetched
/// yet — replaces the waveform until [MediaDownloadState.downloaded].
class _DownloadFallback extends StatelessWidget {
  const _DownloadFallback({required this.tint, required this.onTap});

  final Color tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: ChatRadii.chip,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.sm),
        decoration: BoxDecoration(
          color: tint.withValues(alpha: 0.10),
          borderRadius: ChatRadii.chip,
        ),
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🎤', style: TextStyle(fontSize: 13)),
            const SizedBox(width: ChatSpacing.xs),
            Flexible(
              child: Text(
                'Voice message',
                overflow: TextOverflow.ellipsis,
                style: ChatTextStyles.subtitle.copyWith(color: tint),
              ),
            ),
            const SizedBox(width: ChatSpacing.xs),
            Icon(Icons.download_rounded, size: 14, color: tint),
          ],
        ),
      ),
    );
  }
}

/// Formats milliseconds as `m:ss` (e.g. 0:07, 1:42) — parity with the web
/// `formatTime` helper which pads only seconds.
String _formatMmSs(int millis) {
  final totalSeconds = (millis < 0 ? 0 : millis) ~/ 1000;
  final minutes = totalSeconds ~/ 60;
  final seconds = totalSeconds % 60;
  return '$minutes:${seconds.toString().padLeft(2, '0')}';
}
