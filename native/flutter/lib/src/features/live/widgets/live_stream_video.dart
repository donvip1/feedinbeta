import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../live_theme.dart';

/// Full-bleed HLS playback for a live stream, built on the existing
/// [video_player] package (same dependency the feed uses in
/// `FeedVideoPlayer` — no new media dependency is introduced).
///
/// When [playbackUrl] is null/empty (no ingest configured — native broadcasting
/// is not built), a branded "stream starting" placeholder is shown instead of a
/// spinner, so browsing into a not-yet-broadcasting stream degrades cleanly.
class LiveStreamVideo extends StatefulWidget {
  const LiveStreamVideo({super.key, required this.playbackUrl});

  final String? playbackUrl;

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
      _controller?.dispose();
      _controller = null;
      _failed = false;
      _initialize();
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _initialize() async {
    final url = widget.playbackUrl;
    if (url == null || url.trim().isEmpty) return;

    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    _controller = controller;
    try {
      // Live edge: no looping; play as soon as the manifest loads.
      await controller.initialize();
      await controller.play();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
      return;
    }
    if (!mounted) return;
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
      child: Center(
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: controller.value.size.width,
            height: controller.value.size.height,
            child: VideoPlayer(controller),
          ),
        ),
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
