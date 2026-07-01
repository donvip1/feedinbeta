import 'package:flutter/material.dart';

import '../call_models.dart';
import '../call_theme.dart';
import 'call_avatar.dart';

/// The video-call stage: a full-bleed remote video surface with a small
/// draggable local-preview tile in the top-right corner (web
/// `FloatingCallWidget` / `Call.tsx` layout).
///
/// Because real media transport is not wired in this module (see
/// [call_media_engine.dart]), [remoteView] / [localView] are typically null and
/// this widget renders labelled placeholders so the full video UX is visible.
class VideoStage extends StatelessWidget {
  const VideoStage({
    super.key,
    required this.peer,
    this.remoteView,
    this.localView,
    this.isLocalVideoOff = false,
    this.showLocalTile = true,
    this.isScreenSharing = false,
  });

  final CallParticipant peer;

  /// The remote peer's rendered video, or null -> placeholder.
  final Widget? remoteView;

  /// The local camera preview, or null -> placeholder.
  final Widget? localView;

  final bool isLocalVideoOff;
  final bool showLocalTile;

  /// Whether the local user is sharing their screen — shows the "you're sharing
  /// your screen" surface over the local tile.
  final bool isScreenSharing;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Remote video (full screen).
        _remoteSurface(),

        // Local preview tile.
        if (showLocalTile)
          Positioned(
            top: 16,
            right: 16,
            child: _LocalTile(
              localView: localView,
              isVideoOff: isLocalVideoOff,
              isScreenSharing: isScreenSharing,
            ),
          ),

        // "You're sharing your screen" surface (top-center banner).
        if (isScreenSharing)
          const Positioned(
            top: 16,
            left: 16,
            child: ScreenShareBanner(),
          ),
      ],
    );
  }

  Widget _remoteSurface() {
    if (remoteView != null) {
      return ColoredBox(color: CallColors.videoPlaceholder, child: remoteView);
    }
    return _VideoPlaceholder(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CallAvatar(participant: peer, diameter: 96, borderWidth: 3),
          const SizedBox(height: 16),
          Text(peer.displayName, style: CallTextStyles.statusLine),
          const SizedBox(height: 6),
          const Text(
            'Camera preview appears here',
            style: TextStyle(fontSize: 12, color: CallColors.subtle),
          ),
        ],
      ),
    );
  }
}

class _LocalTile extends StatelessWidget {
  const _LocalTile({
    required this.localView,
    required this.isVideoOff,
    this.isScreenSharing = false,
  });

  final Widget? localView;
  final bool isVideoOff;
  final bool isScreenSharing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: CallSizing.localVideoWidth,
      height: CallSizing.localVideoHeight,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          // Highlight the tile while screen sharing (active pink border).
          color: isScreenSharing
              ? CallColors.activeControlFg
              : CallColors.localTileBorder,
          width: 1.5,
        ),
        color: CallColors.videoPlaceholder,
      ),
      // While sharing the screen, the local tile represents the shared surface
      // (the stub captures no pixels — a real engine renders the screen track).
      child: isScreenSharing
          ? const _ScreenShareTilePlaceholder()
          : (localView != null && !isVideoOff)
              ? localView
              : Container(
                  decoration: const BoxDecoration(
                    gradient: CallGradients.videoPlaceholder,
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    isVideoOff
                        ? Icons.videocam_off_rounded
                        : Icons.person_rounded,
                    color: CallColors.subtle,
                    size: 32,
                  ),
                ),
    );
  }
}

class _ScreenShareTilePlaceholder extends StatelessWidget {
  const _ScreenShareTilePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: CallGradients.videoPlaceholder,
      ),
      alignment: Alignment.center,
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.screen_share_rounded,
            color: CallColors.activeControlFg,
            size: 28,
          ),
          SizedBox(height: 6),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              'Your screen',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: CallColors.subtle),
            ),
          ),
        ],
      ),
    );
  }
}

/// A compact "You're sharing your screen" pill shown while the local user is
/// screen sharing. Placeholder surface for the flagged capture dependency — a
/// real engine renders the shared screen track; this only signals the state.
class ScreenShareBanner extends StatelessWidget {
  const ScreenShareBanner({super.key, this.compact = false});

  /// When true, drops the descriptive line (used inline above the audio
  /// controls where vertical space is tight).
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 12,
        vertical: compact ? 8 : 10,
      ),
      decoration: BoxDecoration(
        color: CallColors.activeControlBg,
        borderRadius: BorderRadius.circular(compact ? 999 : 12),
        border: Border.all(color: CallColors.activeControlFg, width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.screen_share_rounded,
            size: 16,
            color: CallColors.activeControlFg,
          ),
          const SizedBox(width: 8),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "You're sharing your screen",
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: CallColors.foreground,
                ),
              ),
              if (!compact)
                const Text(
                  'Others in the call can see your screen',
                  style: TextStyle(fontSize: 11, color: CallColors.subtle),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VideoPlaceholder extends StatelessWidget {
  const _VideoPlaceholder({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: CallGradients.videoPlaceholder,
      ),
      alignment: Alignment.center,
      child: child,
    );
  }
}
