import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../live_theme.dart';

/// Full-bleed HLS playback for a live stream, built on the existing
/// [video_player] package (same dependency the feed uses in
/// `FeedVideoPlayer` — no new media dependency is introduced).
///
/// Audio: unlike the feed's muted TikTok autoplay, a live stream is a lean-in
/// experience, so playback starts with audio ON (`setVolume(1.0)`). The [muted]
/// flag is hoisted to the viewer so its header can offer a mute toggle (web
/// parity with `LiveKitViewer`'s Volume button). On iOS the hardware silent
/// switch still governs whether that audio is audible — muting audio in a live
/// room without an in-app audio-session dependency is a known limitation
/// (see the module report); the mute toggle is the client-feasible control.
///
/// When [playbackUrl] is null/empty (no ingest configured — native broadcasting
/// is not built), a branded "stream starting" placeholder is shown instead of a
/// spinner, so browsing into a not-yet-broadcasting stream degrades cleanly.
class LiveStreamVideo extends StatefulWidget {
  const LiveStreamVideo({
    super.key,
    required this.playbackUrl,
    this.muted = false,
  });

  final String? playbackUrl;

  /// When true the stream plays silently. Toggled from the viewer header.
  final bool muted;

  @override
  State<LiveStreamVideo> createState() => _LiveStreamVideoState();
}

class _LiveStreamVideoState extends State<LiveStreamVideo> {
  VideoPlayerController? _controller;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void didUpdateWidget(covariant LiveStreamVideo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.playbackUrl != widget.playbackUrl) {
      _controller?.removeListener(_onControllerUpdate);
      _controller?.dispose();
      _controller = null;
      _failed = false;
      _initialize();
    } else if (oldWidget.muted != widget.muted) {
      _applyVolume();
    }
  }

  @override
  void dispose() {
    _controller?.removeListener(_onControllerUpdate);
    _controller?.dispose();
    super.dispose();
  }

  void _onControllerUpdate() {
    // Rebuild for buffering-state and first-frame transitions.
    if (mounted) setState(() {});
  }

  Future<void> _applyVolume() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    try {
      await controller.setVolume(widget.muted ? 0 : 1);
    } catch (_) {
      // Volume is best-effort; ignore platform hiccups.
    }
  }

  Future<void> _initialize() async {
    final url = widget.playbackUrl;
    if (url == null || url.trim().isEmpty) return;

    final controller = VideoPlayerController.networkUrl(
      Uri.parse(url),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
    );
    _controller = controller;
    controller.addListener(_onControllerUpdate);
    try {
      // Live edge: no looping. Audio on so the stream is heard, then play as
      // soon as the manifest is ready.
      await controller.initialize();
      await controller.setVolume(widget.muted ? 0 : 1);
      await controller.play();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
      return;
    }
    if (!mounted) {
      controller.removeListener(_onControllerUpdate);
      await controller.dispose();
      return;
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final url = widget.playbackUrl;
    final controller = _controller;

    if (url == null || url.trim().isEmpty || _failed) {
      return const _StreamPlaceholder();
    }
    if (controller == null || !controller.value.isInitialized) {
      return const ColoredBox(
        color: LiveTheme.background,
        child: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(LiveTheme.liveRed),
          ),
        ),
      );
    }

    return ColoredBox(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Center(
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: controller.value.size.width,
                height: controller.value.size.height,
                child: VideoPlayer(controller),
              ),
            ),
          ),
          // Buffering spinner while the live edge re-fills.
          if (controller.value.isBuffering)
            const Center(
              child: SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(LiveTheme.liveRed),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StreamPlaceholder extends StatelessWidget {
  const _StreamPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(gradient: LiveTheme.streamFallback),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.sensors_rounded, color: Colors.white, size: 44),
            SizedBox(height: 12),
            Text(
              'Waiting for the broadcast',
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'The host is connecting their camera',
              style: TextStyle(color: LiveTheme.onSurfaceMuted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
