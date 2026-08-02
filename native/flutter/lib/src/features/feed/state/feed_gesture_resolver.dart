import 'feed_chrome_state_machine.dart';

/// Pure, side-effect-free helpers for deciding what a Feed/Home gesture
/// should do given the current chrome state and the playback status of
/// the video at the active page.
///
/// Keeping this logic in one place makes the visibility state machine
/// deterministic and unit-testable: the immersive surface widgets just
/// ask "what does this tap mean?" and forward the answer.
class FeedGestureDecision {
  const FeedGestureDecision({
    required this.chromeIntent,
    required this.shouldTogglePlayback,
  });

  /// What the host pager should do with the chrome state machine.
  final FeedSurfaceTapIntent chromeIntent;

  /// Whether the immersive video player should toggle play/pause.
  final bool shouldTogglePlayback;

  /// A tap that arrived while the video is hidden should reveal chrome,
  /// not toggle playback.
  static const FeedGestureDecision reveal = FeedGestureDecision(
    chromeIntent: FeedSurfaceTapIntent.chromeReveal,
    shouldTogglePlayback: false,
  );

  /// A tap that arrived while the chrome is already full should toggle
  /// playback and not touch the chrome state.
  static const FeedGestureDecision playback = FeedGestureDecision(
    chromeIntent: FeedSurfaceTapIntent.videoPlayback,
    shouldTogglePlayback: true,
  );

  /// A tap that should be absorbed without affecting either subsystem.
  static const FeedGestureDecision absorb = FeedGestureDecision(
    chromeIntent: FeedSurfaceTapIntent.none,
    shouldTogglePlayback: false,
  );
}

/// Static helpers that derive gesture decisions from the current chrome
/// state. The host pager passes the current visibility and decides
/// whether the active post is a video; the helper returns the correct
/// intent.
class FeedGestureResolver {
  const FeedGestureResolver._();

  static FeedGestureDecision decideSurfaceTap({
    required FeedChromeVisibility chromeState,
    required bool isActiveVideoPage,
  }) {
    // Only a real video page owns the reveal-vs-playback distinction.
    if (!isActiveVideoPage) return FeedGestureDecision.absorb;

    switch (chromeState) {
      case FeedChromeVisibility.hidden:
      case FeedChromeVisibility.socialOnly:
        return FeedGestureDecision.reveal;
      case FeedChromeVisibility.full:
        return FeedGestureDecision.playback;
    }
  }
}