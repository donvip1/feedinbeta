import 'dart:io';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// Inline (non-immersive) video player used by the post-detail media preview.
///
/// Autoplays looping with sound on. A mute/unmute toggle plus play/pause control
/// sit in the bottom-right. Prefers a locally cached file over the network URL.
class FeedVideoPlayer extends StatefulWidget {
  const FeedVideoPlayer({
    super.key,
    required this.url,
    required this.localPath,
  });

  final String? url;
  final String? localPath;

  @override
  State<FeedVideoPlayer> createState() => _FeedVideoPlayerState();
}

class _FeedVideoPlayerState extends State<FeedVideoPlayer> {
  VideoPlayerController? _controller;
  bool _isMuted = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void didUpdateWidget(covariant FeedVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url ||
        oldWidget.localPath != widget.localPath) {
      _disposeController();
      _initialize();
    }
  }

  @override
  void dispose() {
    _disposeController();
    super.dispose();
  }

  void _disposeController() {
    final controller = _controller;
    if (controller != null) {
      controller.removeListener(_onControllerUpdate);
      controller.dispose();
    }
    _controller = null;
  }

  Future<void> _initialize() async {
    final localPath = widget.localPath;
    final url = widget.url;

    // `mixWithOthers: false` claims audio focus and, on iOS, selects the
    // playback category so audio is audible through the speaker (even with the
    // silent switch on) rather than the silent "ambient" default.
    final options = VideoPlayerOptions(mixWithOthers: false);
    final controller = localPath != null && File(localPath).existsSync()
        ? VideoPlayerController.file(File(localPath), videoPlayerOptions: options)
        : url == null
        ? null
        : VideoPlayerController.networkUrl(
            Uri.parse(url),
            videoPlayerOptions: options,
          );

    if (controller == null) return;

    _controller = controller;
    controller.addListener(_onControllerUpdate);
    await controller.setLooping(true);
    await controller.initialize();
    await controller.setVolume(_isMuted ? 0 : 1);

    // Guard against re-init / disposal while awaiting above.
    if (!mounted || !identical(_controller, controller)) {
      controller.removeListener(_onControllerUpdate);
      await controller.dispose();
      return;
    }

    await controller.play();
    if (!mounted) return;
    setState(() {});
  }

  void _onControllerUpdate() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return const Center(child: CircularProgressIndicator());
    }

    final isBuffering = controller.value.isBuffering;

    return GestureDetector(
      onTap: () {
        setState(() {
          controller.value.isPlaying ? controller.pause() : controller.play();
        });
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          FittedBox(
            fit: BoxFit.cover,
            child: SizedBox(
              width: controller.value.size.width,
              height: controller.value.size.height,
              child: VideoPlayer(controller),
            ),
          ),
          if (isBuffering)
            const Center(
              child: SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(strokeWidth: 2.4),
              ),
            ),
          Align(
            alignment: Alignment.bottomRight,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton.filledTonal(
                    tooltip: controller.value.isPlaying ? 'Pause' : 'Play',
                    onPressed: () {
                      setState(() {
                        controller.value.isPlaying
                            ? controller.pause()
                            : controller.play();
                      });
                    },
                    icon: Icon(
                      controller.value.isPlaying
                          ? Icons.pause
                          : Icons.play_arrow,
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filledTonal(
                    tooltip: _isMuted ? 'Unmute' : 'Mute',
                    onPressed: () async {
                      final nextMuted = !_isMuted;
                      await controller.setVolume(nextMuted ? 0 : 1);
                      if (!mounted) return;
                      setState(() => _isMuted = nextMuted);
                    },
                    icon: Icon(_isMuted ? Icons.volume_off : Icons.volume_up),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
