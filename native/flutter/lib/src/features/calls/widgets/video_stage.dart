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
  });

  final CallParticipant peer;

  /// The remote peer's rendered video, or null -> placeholder.
  final Widget? remoteView;

  /// The local camera preview, or null -> placeholder.
  final Widget? localView;

  final bool isLocalVideoOff;
  final bool showLocalTile;

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
            ),
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
  const _LocalTile({required this.localView, required this.isVideoOff});

  final Widget? localView;
  final bool isVideoOff;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: CallSizing.localVideoWidth,
      height: CallSizing.localVideoHeight,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: CallColors.localTileBorder, width: 1.5),
        color: CallColors.videoPlaceholder,
      ),
      child: (localView != null && !isVideoOff)
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
