import 'dart:async' show Timer, Zone;

import 'package:flutter/foundation.dart';

/// Three-stage visibility for the primary Feed/Home chrome.
///
/// The pager-driven Feed auto-hides its chrome while a video is actively
/// playing so the viewer gets an immersive experience, and uses a small
/// state machine to reveal UI in two distinct stages:
///
/// 1. [hidden]   — video only. No chrome is interactive.
/// 2. [socialOnly] — first tap from [hidden] reveals the right-side social
///    action rail only (avatar / like / comment / refeed / views / more).
/// 3. [full]     — second tap adds caption, playback controls, FeedIn
///    branding, Videos/Photos/Live tabs, Search, notification bell, the
///    owner More action, the Create FAB, and the bottom navigation bar.
///
/// The state machine itself only owns transitions and timer bookkeeping;
/// it never reads or writes the video controller. Callers wire video
/// readiness/playback into the helper via the [isVideoPlaying] gate, and
/// route user gestures through [handleSurfaceTap]/[handlePlaybackTap] to
/// drive the chrome while keeping video playback semantics intact.
enum FeedChromeVisibility { hidden, socialOnly, full }

/// Surface-tap input classification. The host (Feed pager) tells the helper
/// what kind of surface tap arrived; the helper decides whether the tap
/// advances the chrome state machine, pauses/plays the video, or is
/// ignored.
enum FeedSurfaceTapIntent { chromeReveal, videoPlayback, none }

/// Pure, side-effect-free state machine that drives the Feed chrome. Tests
/// inject a deterministic [FeedChromeClock] so they don't depend on real
/// time, and tests inject a `void Function(FeedChromeVisibility)` callback
/// instead of mounting the widget tree.
class FeedChromeStateMachine {
  FeedChromeStateMachine({
    FeedChromeClock clock = const _SystemClock(),
    Duration autoHideDelay = const Duration(seconds: 2),
  })  : _clock = clock,
        _autoHideDelay = autoHideDelay;

  final FeedChromeClock _clock;
  final Duration _autoHideDelay;

  FeedChromeVisibility _state = FeedChromeVisibility.full;
  FeedChromeVisibility get state => _state;

  /// Latest video playback status; only auto-hide when true.
  bool _isVideoPlaying = false;
  bool get isVideoPlaying => _isVideoPlaying;

  /// Whether the surface is even eligible for the immersive video timer
  /// (primary Video tab, video post, no overlay covering the Feed). Set
  /// this to false on Photos, Live, comment sheets, etc.
  bool _isImmersiveSurfaceActive = false;
  bool get isImmersiveSurfaceActive => _isImmersiveSurfaceActive;

  Timer? _autoHideTimer;

  /// Monotonic tick used by tests to assert the auto-hide timer fired in
  /// the expected order without depending on real wall-clock time.
  int _ticks = 0;
  int get ticks => _ticks;

  void attachListener(void Function(FeedChromeVisibility) listener) {
    _listener = listener;
  }

  void Function(FeedChromeVisibility)? _listener;

  /// Replace the current state and notify the listener. Used by both
  /// explicit transitions (tap) and implicit ones (timer, route change).
  @visibleForTesting
  void setState(FeedChromeVisibility next) {
    if (_state == next) return;
    _state = next;
    _listener?.call(next);
  }

  /// Report whether the video is actively playing. When the gate flips
  /// from false → true and the immersive surface is eligible, start the
  /// auto-hide timer.
  void reportVideoPlayback({required bool isPlaying}) {
    final wasPlaying = _isVideoPlaying;
    _isVideoPlaying = isPlaying;
    if (wasPlaying == isPlaying) return;

    if (isPlaying && _isImmersiveSurfaceActive) {
      _scheduleAutoHide();
    } else {
      _cancelAutoHide();
    }
  }

  /// Update whether the surface qualifies for the immersive timer (e.g.
  /// the user switched to Photos, opened comments, or pushed a route).
  void reportImmersiveSurface({required bool isActive}) {
    final wasActive = _isImmersiveSurfaceActive;
    _isImmersiveSurfaceActive = isActive;
    if (wasActive == isActive) return;

    if (!isActive) {
      _cancelAutoHide();
      // Returning to a non-immersive surface restores the full chrome so
      // the user immediately sees the standard controls.
      setState(FeedChromeVisibility.full);
      return;
    }
    if (_isVideoPlaying) {
      _scheduleAutoHide();
    }
  }

  /// Reset to the initial full-chrome state and cancel any pending timer.
  /// Used on route pop, app resume, and disposal.
  void resetToFull() {
    _cancelAutoHide();
    setState(FeedChromeVisibility.full);
  }

  /// Decide what to do with a tap on the immersive surface.
  ///
  /// - [FeedSurfaceTapIntent.chromeReveal] is the staged reveal gesture:
  ///   the caller invokes this *instead* of pausing/playing the video.
  ///   It moves hidden → socialOnly → full.
  /// - [FeedSurfaceTapIntent.videoPlayback] is the explicit play/pause
  ///   tap. The caller invokes this only when the chrome is already
  ///   [full] (so we don't fight the reveal sequence).
  /// - [FeedSurfaceTapIntent.none] is a no-op (e.g. tap absorbed by a
  ///   child interactive widget like the action rail).
  ///
  /// Returns the new visibility state for convenience.
  FeedChromeVisibility handleSurfaceTap(FeedSurfaceTapIntent intent) {
    switch (intent) {
      case FeedSurfaceTapIntent.none:
        return _state;
      case FeedSurfaceTapIntent.chromeReveal:
        return _advanceChrome();
      case FeedSurfaceTapIntent.videoPlayback:
        // Reveal taps don't restart the auto-hide timer; explicit playback
        // taps also clear any pending timer because the user is engaging
        // with the video and we want the chrome to stay visible long
        // enough to react.
        _cancelAutoHide();
        return _state;
    }
  }

  FeedChromeVisibility _advanceChrome() {
    switch (_state) {
      case FeedChromeVisibility.hidden:
        setState(FeedChromeVisibility.socialOnly);
        return _state;
      case FeedChromeVisibility.socialOnly:
        setState(FeedChromeVisibility.full);
        // Full chrome is a stable resting state; the auto-hide timer is
        // not started here. It will start when the user stops interacting
        // and the video is still playing.
        return _state;
      case FeedChromeVisibility.full:
        // Already full: a chrome tap in this state should not restart
        // anything; it's just absorbed.
        return _state;
    }
  }

  /// Restart the auto-hide countdown. Called when entering [hidden] via a
  /// timer (the timer just fired) and when video playback resumes.
  void _scheduleAutoHide() {
    _cancelAutoHide();
    if (!_isVideoPlaying || !_isImmersiveSurfaceActive) return;
    _autoHideTimer = _clock.createTimer(_autoHideDelay, _onAutoHide);
  }

  void _cancelAutoHide() {
    _autoHideTimer?.cancel();
    _autoHideTimer = null;
  }

  void _onAutoHide() {
    _ticks++;
    _autoHideTimer = null;
    if (!_isVideoPlaying || !_isImmersiveSurfaceActive) return;
    setState(FeedChromeVisibility.hidden);
  }

  void dispose() {
    _cancelAutoHide();
    _listener = null;
  }
}

/// Abstraction over a monotonically-advancing clock + scheduler so the
/// state machine can be unit-tested without `dart:async` real time.
abstract class FeedChromeClock {
  const FeedChromeClock();
  Timer createTimer(Duration duration, void Function() onElapsed);
}

class _SystemClock extends FeedChromeClock {
  const _SystemClock();

  @override
  Timer createTimer(Duration duration, void Function() onElapsed) =>
      Timer(duration, onElapsed);
}

/// Test clock: lets the test manually advance virtual time.
@visibleForTesting
class FakeFeedChromeClock extends FeedChromeClock {
  FakeFeedChromeClock();

  final List<_PendingTimer> _pending = <_PendingTimer>[];
  Duration _now = Duration.zero;

  Duration get now => _now;

  @override
  Timer createTimer(Duration duration, void Function() onElapsed) {
    final fireAt = _now + duration;
    final pending = _PendingTimer(fireAt: fireAt, onElapsed: onElapsed);
    _pending.add(pending);
    _pending.sort((a, b) => a.fireAt.compareTo(b.fireAt));
    return _FakeTimer(pending, this);
  }

  /// Advance virtual time and fire any due timers. Multiple timers can
  /// fire in order during a single advance call.
  void advance(Duration delta) {
    _now += delta;
    while (_pending.isNotEmpty && _pending.first.fireAt <= _now) {
      final pending = _pending.removeAt(0);
      pending.onElapsed();
    }
  }

  void _cancel(_PendingTimer pending) {
    _pending.remove(pending);
  }
}

class _PendingTimer {
  _PendingTimer({required this.fireAt, required this.onElapsed});
  final Duration fireAt;
  final VoidCallback onElapsed;
}

class _FakeTimer implements Timer {
  _FakeTimer(this._pending, this._clock);
  final _PendingTimer _pending;
  final FakeFeedChromeClock _clock;

  @override
  void cancel() {
    _clock._cancel(_pending);
  }

  @override
  bool get isActive => true;

  @override
  int get tick => 0;

  Zone get zone => Zone.current;
}