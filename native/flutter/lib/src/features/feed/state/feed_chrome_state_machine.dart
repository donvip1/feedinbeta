import 'dart:async' show Timer, Zone;

import 'package:flutter/foundation.dart';

/// Visibility for the primary Feed/Home chrome.
///
/// The pager-driven Feed auto-hides its chrome while a video is actively
/// playing so the viewer gets an immersive experience. A single tap toggles
/// between two resting states:
///
/// * [hidden] — video only, playing full screen. No chrome is interactive.
/// * [full]   — all chrome visible (caption, action rail, playback controls,
///   FeedIn branding, tabs, search, bell, bottom nav) and the video paused.
///
/// The rule is "playing = chrome hidden; paused = chrome visible": a tap on a
/// hidden surface pauses the video and reveals full chrome; a tap on a visible
/// surface hides it and resumes playback. While a video keeps playing, the
/// inactivity countdown hides the chrome after `autoHideDelay`.
///
/// [socialOnly] is retained for backward compatibility with callers that still
/// switch over the enum, but the tap flow no longer produces it (reveal goes
/// straight to [full] in one tap).
///
/// The state machine itself only owns transitions and timer bookkeeping;
/// it never reads or writes the video controller. Callers wire video
/// readiness/playback into the helper via the [isVideoPlaying] gate, and
/// route user gestures through [handleSurfaceTap] to drive the chrome while
/// keeping video playback semantics intact.
enum FeedChromeVisibility { hidden, socialOnly, full }

/// Surface-tap input classification. A single tap on an immersive video
/// toggles the chrome AND playback together:
///
/// * [reveal] — tap while chrome is hidden: show chrome and pause the video.
/// * [hide]   — tap while chrome is visible: hide chrome and resume the video.
/// * [none]   — absorbed (e.g. a non-video surface or a child widget).
enum FeedSurfaceTapIntent { reveal, hide, none }

/// Pure, side-effect-free state machine that drives the Feed chrome. Tests
/// inject a deterministic [FeedChromeClock] so they don't depend on real
/// time, and tests inject a `void Function(FeedChromeVisibility)` callback
/// instead of mounting the widget tree.
class FeedChromeStateMachine {
  FeedChromeStateMachine({
    FeedChromeClock clock = const _SystemClock(),
    Duration autoHideDelay = const Duration(seconds: 3),
  }) : _clock = clock,
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

  /// Report whether the video is actively playing. Playing arms the
  /// inactivity countdown (chrome hides after [autoHideDelay]). Playback is
  /// otherwise decoupled from chrome: pausing does NOT force the chrome back —
  /// the center play/pause tap must not disturb the current chrome state.
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

  /// Apply a single surface tap.
  ///
  /// - [FeedSurfaceTapIntent.reveal] shows full chrome (the caller pauses the
  ///   video); the inactivity countdown is cancelled because a paused video
  ///   keeps its chrome visible.
  /// - [FeedSurfaceTapIntent.hide] hides the chrome (the caller resumes the
  ///   video); playback resuming re-arms the countdown via
  ///   [reportVideoPlayback].
  /// - [FeedSurfaceTapIntent.none] is a no-op.
  ///
  /// Returns the new visibility state for convenience.
  FeedChromeVisibility handleSurfaceTap(FeedSurfaceTapIntent intent) {
    switch (intent) {
      case FeedSurfaceTapIntent.none:
        return _state;
      case FeedSurfaceTapIntent.reveal:
        setState(FeedChromeVisibility.full);
        // While a video keeps playing, re-arm the inactivity countdown so the
        // revealed chrome fades back out for immersive viewing.
        _scheduleAutoHide();
        return _state;
      case FeedSurfaceTapIntent.hide:
        _cancelAutoHide();
        setState(FeedChromeVisibility.hidden);
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
