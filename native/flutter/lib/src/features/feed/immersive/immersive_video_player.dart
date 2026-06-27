import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import 'feed_immersive_theme.dart';

/// Full-screen, TikTok-style autoplay video player.
///
/// Built on the `video_player` package (same dependency as the simpler
/// [FeedVideoPlayer] at `../feed_video_player.dart`). Plays only while
/// [isActive] is true, loops forever, and starts muted to mirror TikTok web
/// autoplay behaviour.
class ImmersiveVideoPlayer extends StatefulWidget {
  const ImmersiveVideoPlayer({
    super.key,
    required this.url,
    required this.localPath,
    required this.isActive,
    this.onDoubleTapLike,
  });

  /// Remote media URL. Used when [localPath] is null or missing on disk.
  final String? url;

  /// Path to a locally cached file. Preferred over [url] when it exists.
  final String? localPath;

  /// Autoplay gate: the video only plays while this is true (the visible page
  /// in the immersive pager).
  final bool isActive;

  /// Invoked when the user double-taps the video (e.g. to "like").
  final VoidCallback? onDoubleTapLike;

  @override
  State<ImmersiveVideoPlayer> createState() => _ImmersiveVideoPlayerState();
}

class _ImmersiveVideoPlayerState extends State<ImmersiveVideoPlayer> {
  VideoPlayerController? _controller;

  /// Muted by default, like TikTok web autoplay.
  bool _isMuted = true;

  /// Whether the controller finished initializing successfully.
  bool _isInitialized = false;

  /// Icon shown briefly in the center after a single tap (play/pause feedback).
  IconData? _tapIcon;
  Timer? _tapIconTimer;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void didUpdateWidget(covariant ImmersiveVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Re-initialize when the media source changes.
    if (oldWidget.url != widget.url ||
        oldWidget.localPath != widget.localPath) {
      _disposeController();
      _initialize();
      return;
    }

    // React to autoplay activation changes.
    if (oldWidget.isActive != widget.isActive) {
      _syncPlayback();
    }
  }

  @override
  void dispose() {
    _tapIconTimer?.cancel();
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
    _isInitialized = false;
  }

  Future<void> _initialize() async {
    final localPath = widget.localPath;
    final url = widget.url;

    final controller = localPath != null && File(localPath).existsSync()
        ? VideoPlayerController.file(File(localPath))
        : url == null
        ? null
        : VideoPlayerController.networkUrl(Uri.parse(url));

    // No source -> show the gradient placeholder via build().
    if (controller == null) {
      if (mounted) setState(() {});
      return;
    }

    _controller = controller;
    controller.addListener(_onControllerUpdate);

    try {
      await controller.setLooping(true);
      await controller.initialize();
      await controller.setVolume(_isMuted ? 0 : 1);
    } catch (_) {
      // Initialization failed (bad URL/codec). Leave the placeholder visible.
      if (!mounted) {
        controller.removeListener(_onControllerUpdate);
        await controller.dispose();
      }
      return;
    }

    // Guard against the widget being disposed (or re-init'd) mid-await.
    if (!mounted || !identical(_controller, controller)) {
      controller.removeListener(_onControllerUpdate);
      await controller.dispose();
      return;
    }

    _isInitialized = true;
    setState(() {});
    _syncPlayback();
  }

  void _onControllerUpdate() {
    // Drive the progress bar and play/pause state.
    if (mounted) setState(() {});
  }

  /// Aligns playback with [widget.isActive].
  void _syncPlayback() {
    final controller = _controller;
    if (controller == null || !_isInitialized) return;

    if (widget.isActive) {
      controller.play();
    } else {
      controller.pause();
      controller.seekTo(Duration.zero);
    }
  }

  void _handleTap() {
    final controller = _controller;
    if (controller == null || !_isInitialized) return;

    final wasPlaying = controller.value.isPlaying;
    if (wasPlaying) {
      controller.pause();
    } else {
      controller.play();
    }
    _flashTapIcon(wasPlaying ? Icons.pause : Icons.play_arrow);
  }

  void _flashTapIcon(IconData icon) {
    _tapIconTimer?.cancel();
    setState(() => _tapIcon = icon);
    _tapIconTimer = Timer(const Duration(milliseconds: 600), () {
      if (mounted) setState(() => _tapIcon = null);
    });
  }

  Future<void> _toggleMute() async {
    final controller = _controller;
    final nextMuted = !_isMuted;
    if (controller != null && _isInitialized) {
      await controller.setVolume(nextMuted ? 0 : 1);
    }
    if (!mounted) return;
    setState(() => _isMuted = nextMuted);
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final ready = controller != null && _isInitialized;

    return GestureDetector(
      onTap: _handleTap,
      onDoubleTap: widget.onDoubleTapLike,
      child: ColoredBox(
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (ready)
              _buildVideo(controller)
            else
              _buildPlaceholder(loading: _hasSource),
            if (ready) ...[_buildTapFeedback(), _buildProgressBar(controller)],
            _buildMuteButton(enabled: ready),
          ],
        ),
      ),
    );
  }

  bool get _hasSource {
    final localPath = widget.localPath;
    if (localPath != null && File(localPath).existsSync()) return true;
    return widget.url != null;
  }

  Widget _buildVideo(VideoPlayerController controller) {
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: controller.value.size.width,
        height: controller.value.size.height,
        child: VideoPlayer(controller),
      ),
    );
  }

  /// Neutral gradient background shown when there is no source, while the
  /// video loads, or on init failure. Never a white screen.
  Widget _buildPlaceholder({required bool loading}) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: FeedImmersiveTheme.fallbackMediaGradient,
      ),
      child: loading
          ? const Center(
              child: SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    FeedImmersiveTheme.onMedia,
                  ),
                ),
              ),
            )
          : const SizedBox.expand(),
    );
  }

  Widget _buildTapFeedback() {
    final icon = _tapIcon;
    return Center(
      child: AnimatedOpacity(
        opacity: icon == null ? 0 : 1,
        duration: const Duration(milliseconds: 150),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: const BoxDecoration(
            color: Color(0x55000000),
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon ?? Icons.play_arrow,
            color: FeedImmersiveTheme.onMedia,
            size: 56,
            shadows: FeedImmersiveTheme.textShadow,
          ),
        ),
      ),
    );
  }

  Widget _buildProgressBar(VideoPlayerController controller) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: SizedBox(
        height: 3,
        child: VideoProgressIndicator(
          controller,
          allowScrubbing: false,
          padding: EdgeInsets.zero,
          colors: const VideoProgressColors(
            playedColor: FeedImmersiveTheme.brandPink,
            bufferedColor: Color(0x66FFFFFF),
            backgroundColor: Color(0x33FFFFFF),
          ),
        ),
      ),
    );
  }

  Widget _buildMuteButton({required bool enabled}) {
    return Align(
      alignment: Alignment.bottomRight,
      child: Padding(
        // Sit just above the progress bar.
        padding: const EdgeInsets.only(right: 10, bottom: 14),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0x40000000),
            shape: BoxShape.circle,
          ),
          child: IconButton(
            tooltip: _isMuted ? 'Unmute' : 'Mute',
            onPressed: enabled ? _toggleMute : null,
            color: FeedImmersiveTheme.onMedia,
            iconSize: 22,
            icon: Icon(_isMuted ? Icons.volume_off : Icons.volume_up),
          ),
        ),
      ),
    );
  }
}
