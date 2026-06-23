import 'dart:io';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

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
    if (oldWidget.url != widget.url || oldWidget.localPath != widget.localPath) {
      _controller?.dispose();
      _controller = null;
      _initialize();
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _initialize() async {
    final localPath = widget.localPath;
    final url = widget.url;

    final controller = localPath != null && File(localPath).existsSync()
        ? VideoPlayerController.file(File(localPath))
        : url == null
        ? null
        : VideoPlayerController.networkUrl(Uri.parse(url));

    if (controller == null) return;

    _controller = controller;
    await controller.setLooping(true);
    await controller.initialize();
    await controller.play();

    if (!mounted) return;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return const Center(child: CircularProgressIndicator());
    }

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
                      controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
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
