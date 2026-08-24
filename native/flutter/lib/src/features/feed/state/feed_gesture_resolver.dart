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

  /// A tap that arrived while the chrome is hidden should reveal it (and the
  /// caller pauses the video).
  static const FeedGestureDecision reveal = FeedGestureDecision(
    chromeIntent: FeedSurfaceTapIntent.reveal,
    shouldTogglePlayback: true,
  );

  /// A tap that arrived while the chrome is visible should hide it (and the
  /// caller resumes the video).
  static const FeedGestureDecision hide = FeedGestureDecision(
    chromeIntent: FeedSurfaceTapIntent.hide,
    shouldTogglePlayback: true,
  );

  /// A tap that should be absorbed without affecting either subsystem.
  static const FeedGestureDecision absorb = FeedGestureDecision(
    chromeIntent: FeedSurfaceTapIntent.none,
    shouldTogglePlayback: false,
  );
}

/// Static helpers that derive gesture decisions from the active video's
/// playback state. The immersive surface asks "what does this tap mean?" and
/// forwards the answer. The decision is keyed off PLAYBACK, not chrome
/// visibility, so tapping a playing video always pauses it (and reveals the
/// chrome) — even during the brief window where the chrome is still visible
/// while playback has just begun.
class FeedGestureResolver {
  const FeedGestureResolver._();

  static FeedGestureDecision decideSurfaceTap({
    required bool isActiveVideoPage,
    required bool isPlaying,
  }) {
    // Only the active video page owns the pause/resume + reveal/hide gesture.
    if (!isActiveVideoPage) return FeedGestureDecision.absorb;

    // Playing → pause and reveal the chrome; paused → resume and hide it.
    return isPlaying ? FeedGestureDecision.reveal : FeedGestureDecision.hide;
  }
}