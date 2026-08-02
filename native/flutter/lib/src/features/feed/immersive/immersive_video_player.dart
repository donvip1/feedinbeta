import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

import '../../../core/media/reel_preloader.dart';
import '../state/feed_chrome_state_machine.dart';
import 'feed_immersive_theme.dart';
import 'immersive_audio.dart';

/// Full-screen, TikTok-style autoplay video player.
///
/// Built on the `video_player` package (same dependency as the simpler
/// [FeedVideoPlayer] at `../feed_video_player.dart`). Plays only while
/// [isActive] is true and loops forever.
///
/// Audio behaviour (web parity with `src/components/feed/ImmersivePostCard.tsx`):
/// the active reel autoplays **with sound**. Mute is a shared, session-wide flag
/// ([immersiveFeedMuted]) so toggling it on one reel carries to every reel you
/// swipe to. Off-screen reels are always paused *and* have their volume zeroed,
/// so only the single active page ever produces audio — no bleed between pages.
///
/// Gesture behaviour while the host chrome is `hidden`/`socialOnly`:
/// single taps on the video surface are forwarded to the host as a
/// reveal gesture ([onSurfaceTap]) and do NOT toggle play/pause. When
/// the chrome reaches `full`, single taps toggle play/pause as before.
/// Double-tap Like is always forwarded via [onDoubleTapLike].
class ImmersiveVideoPlayer extends StatefulWidget {
  const ImmersiveVideoPlayer({
    super.key,
    required this.url,
    required this.localPath,
    required this.isActive,
    this.onDoubleTapLike,
    this.onSurfaceTap,
    this.chromeState = FeedChromeVisibility.full,
    this.onPlaybackChange,
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

  /// Invoked for single-taps that should advance the chrome reveal. The
  /// host decides whether the tap reveals chrome or toggles playback
  /// based on its current chrome state.
  final void Function(FeedSurfaceTapIntent intent)? onSurfaceTap;

  /// Current chrome visibility. Tells the player whether single-tap
  /// should be treated as a reveal gesture (hidden / socialOnly) or as
  /// a normal play/pause toggle (full).
  final FeedChromeVisibility chromeState;

  /// Notified when playback state changes (e.g. so the host can arm the
  /// auto-hide timer once the video actually starts playing).
  final void Function(bool isPlaying)? onPlaybackChange;

  @override
  State<ImmersiveVideoPlayer> createState() => _ImmersiveVideoPlayerState();
}

class _ImmersiveVideoPlayerState extends State<ImmersiveVideoPlayer> {
  VideoPlayerController? _controller;

  /// Whether the controller finished initializing successfully.
  bool _isInitialized = false;

  /// Icon shown briefly in the center after a single tap (play/pause feedback).
  IconData? _tapIcon;
  Timer? _tapIconTimer;

  bool _lastReportedPlaying = false;

  @override
  void initState() {
    super.initState();
    // Re-apply the correct volume whenever the shared mute flag flips while this
    // reel is on screen (e.g. the user mutes from a different reel).
    immersiveFeedMuted.addListener(_onMuteChanged);
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
    immersiveFeedMuted.removeListener(_onMuteChanged);
    _tapIconTimer?.cancel();
    _disposeController();
    _reportPlayback(false);
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

    // Prefer an explicit local file; otherwise use a preloaded cache file when
    // one is ready so a swiped-to reel starts instantly instead of cold-
    // streaming. Falls back to the network URL when nothing is cached yet.
    String? filePath = (localPath != null && File(localPath).existsSync())
        ? localPath
        : null;
    filePath ??= await ReelPreloader.instance.cachedFileFor(url);
    if (!mounted) return; // widget disposed during the cache lookup

    final controller = filePath != null
        ? VideoPlayerController.file(
            File(filePath),
            videoPlayerOptions: _audioPlaybackOptions(),
          )
        : url == null
        ? null
        : VideoPlayerController.networkUrl(
            Uri.parse(url),
            videoPlayerOptions: _audioPlaybackOptions(),
          );

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
      // Apply the current audio state up front so the active reel comes up with
      // sound (or muted, if the user muted a previous reel this session).
      await controller.setVolume(_effectiveVolume);
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

  /// Options that let media audio play through the device speaker.
  ///
  /// `mixWithOthers: false` claims exclusive audio focus for the active reel, so
  /// starting one reel ducks/stops other app audio and — combined with the
  /// per-page volume gating below — guarantees only one reel is ever audible.
  VideoPlayerOptions _audioPlaybackOptions() =>
      VideoPlayerOptions(mixWithOthers: false);

  /// The volume this reel should currently play at: full volume only when it is
  /// the active page and the shared mute flag is off; silent otherwise. This is
  /// what prevents audio bleed between the active reel and its neighbours.
  double get _effectiveVolume =>
      (widget.isActive && !immersiveFeedMuted.value) ? 1.0 : 0.0;

  void _onMuteChanged() {
    final controller = _controller;
    if (controller != null && _isInitialized) {
      controller.setVolume(_effectiveVolume);
    }
    if (mounted) setState(() {});
  }

  void _onControllerUpdate() {
    // Drive the progress bar, buffering spinner, and play/pause state.
    if (mounted) setState(() {});

    final controller = _controller;
    if (controller == null || !_isInitialized) return;
    final playing = controller.value.isPlaying;
    if (playing != _lastReportedPlaying) {
      _reportPlayback(playing);
    }
  }

  /// Aligns playback and volume with [widget.isActive].
  void _syncPlayback() {
    final controller = _controller;
    if (controller == null || !_isInitialized) return;

    // Always re-assert volume: an off-screen reel must be silent even if it was
    // left playing for a frame during a fast swipe.
    controller.setVolume(_effectiveVolume);

    if (widget.isActive) {
      controller.play();
    } else {
      controller.pause();
      controller.seekTo(Duration.zero);
    }
    _reportPlayback(controller.value.isPlaying);
  }

  /// Push the current playback state to the host so it can arm/disarm
  /// the auto-hide timer. Debounced to "fire only on a real change" via
  /// [_lastReportedPlaying].
  void _reportPlayback(bool isPlaying) {
    _lastReportedPlaying = isPlaying;
    final callback = widget.onPlaybackChange;
    if (callback != null) callback(isPlaying);
  }

  /// Decide what a single tap on the video means.
  ///
  /// The chrome state machine is owned by the host pager; this widget
  /// just forwards a strongly-typed intent. When chrome is hidden or
  /// socialOnly, taps are reveal gestures (do not toggle play/pause).
  /// When chrome is full, taps toggle play/pause as before.
  void _handleTap() {
    final controller = _controller;
    final host = widget.onSurfaceTap;
    final canToggle = controller != null && _isInitialized;

    final intent = widget.chromeState == FeedChromeVisibility.full
        ? FeedSurfaceTapIntent.videoPlayback
        : FeedSurfaceTapIntent.chromeReveal;

    if (host != null) {
      host(intent);
    }

    // Only toggle playback when the chrome is already full AND the
    // controller is ready. Hidden / socialOnly taps are pure reveal
    // gestures.
    if (intent == FeedSurfaceTapIntent.videoPlayback && canToggle) {
      final wasPlaying = controller.value.isPlaying;
      if (wasPlaying) {
        controller.pause();
      } else {
        controller.play();
      }
      HapticFeedback.selectionClick();
      _flashTapIcon(wasPlaying ? Icons.pause : Icons.play_arrow);
    } else if (intent == FeedSurfaceTapIntent.chromeReveal) {
      HapticFeedback.selectionClick();
    }
  }

  void _flashTapIcon(IconData icon) {
    _tapIconTimer?.cancel();
    setState(() => _tapIcon = icon);
    _tapIconTimer = Timer(FeedImmersiveTheme.motionPlaybackVisible, () {
      if (mounted) setState(() => _tapIcon = null);
    });
  }

  /// Flips the shared, session-wide mute flag (web parity: `toggleMute`). The
  /// notifier listener re-applies volume to this and every other live reel.
  void _toggleMute() {
    immersiveFeedMuted.value = !immersiveFeedMuted.value;
  }

  /// True once the controller reports it is actively buffering (network stalls).
  bool _isBuffering(VideoPlayerController controller) {
    final value = controller.value;
    if (!value.isInitialized) return false;
    if (!value.isBuffering) return false;
    // Only surface the spinner when we actually intend to be playing, otherwise
    // a paused off-screen reel would show a spinner.
    return widget.isActive;
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final ready = controller != null && _isInitialized;

    return GestureDetector(
      onTap: _handleTap,
      onDoubleTap: widget.onDoubleTapLike,
      child: ColoredBox(
        color: FeedImmersiveTheme.mediaBackdrop,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (ready)
              _buildVideo(controller)
            else
              _buildPlaceholder(loading: _hasSource),
            if (ready && _isBuffering(controller)) _buildBufferingSpinner(),
            if (ready && widget.chromeState == FeedChromeVisibility.full) ...[
              _buildTapFeedback(),
              _buildProgressBar(controller),
            ],
            // The mute control is part of the full chrome stage only — it
            // is hidden alongside caption/progress when chrome is hidden
            // or socialOnly.
            if (widget.chromeState == FeedChromeVisibility.full)
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
      fit: BoxFit.contain,
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
                width: FeedImmersiveTheme.loadingIndicatorSm,
                height: FeedImmersiveTheme.loadingIndicatorSm,
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

  /// Spinner shown over the (already visible) first frame while the network
  /// stream re-buffers mid-playback.
  Widget _buildBufferingSpinner() {
    return const Center(
      child: SizedBox(
        width: FeedImmersiveTheme.loadingIndicatorMd,
        height: FeedImmersiveTheme.loadingIndicatorMd,
        child: CircularProgressIndicator(
          strokeWidth: 2.6,
          valueColor: AlwaysStoppedAnimation<Color>(FeedImmersiveTheme.onMedia),
        ),
      ),
    );
  }

  Widget _buildTapFeedback() {
    final icon = _tapIcon;
    return Center(
      child: AnimatedScale(
        scale: icon == null ? 0.84 : FeedImmersiveTheme.opacityVisible,
        duration: FeedImmersiveTheme.motionPlaybackFeedback,
        curve: FeedImmersiveTheme.premiumSettleCurve,
        child: AnimatedOpacity(
          opacity: icon == null
              ? FeedImmersiveTheme.opacityHidden
              : FeedImmersiveTheme.opacityVisible,
          duration: FeedImmersiveTheme.motionPlaybackFade,
          curve: FeedImmersiveTheme.premiumSettleCurve,
          child: Container(
            padding: const EdgeInsets.all(
              FeedImmersiveTheme.playbackFeedbackPadding,
            ),
            decoration: const BoxDecoration(
              color: FeedImmersiveTheme.overlayControl,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon ?? Icons.play_arrow,
              color: FeedImmersiveTheme.onMedia,
              size: FeedImmersiveTheme.playbackFeedbackIcon,
              shadows: FeedImmersiveTheme.textShadow,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressBar(VideoPlayerController controller) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: SizedBox(
        height: FeedImmersiveTheme.progressTrackHeight,
        child: VideoProgressIndicator(
          controller,
          allowScrubbing: false,
          padding: EdgeInsets.zero,
          colors: const VideoProgressColors(
            playedColor: FeedImmersiveTheme.brandPink,
            bufferedColor: FeedImmersiveTheme.progressBuffered,
            backgroundColor: FeedImmersiveTheme.progressTrack,
          ),
        ),
      ),
    );
  }

  Widget _buildMuteButton({required bool enabled}) {
    final muted = immersiveFeedMuted.value;
    return Align(
      alignment: Alignment.bottomRight,
      child: Padding(
        // Sit just above the progress bar.
        padding: const EdgeInsets.only(
          right: FeedImmersiveTheme.muteControlRightInset,
          bottom: FeedImmersiveTheme.muteControlBottomInset,
        ),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: FeedImmersiveTheme.overlayControlSoft,
            shape: BoxShape.circle,
            boxShadow: FeedImmersiveTheme.mediaControlShadow,
          ),
          child: IconButton(
            tooltip: muted ? 'Unmute' : 'Mute',
            onPressed: enabled ? _toggleMute : null,
            color: FeedImmersiveTheme.onMedia,
            iconSize: FeedImmersiveTheme.iconMd,
            icon: Icon(muted ? Icons.volume_off : Icons.volume_up),
          ),
        ),
      ),
    );
  }
}