import 'package:feedin/src/features/feed/state/feed_chrome_state_machine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FeedChromeStateMachine', () {
    test('starts in full chrome with no pending timer', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock);
      expect(machine.state, FeedChromeVisibility.full);
      expect(machine.isVideoPlaying, isFalse);
      expect(machine.isImmersiveSurfaceActive, isFalse);
    });

    test('playing video auto-hides chrome after the 3s inactivity delay', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock);
      final changes = <FeedChromeVisibility>[];
      machine.attachListener(changes.add);

      machine.reportImmersiveSurface(isActive: true);
      machine.reportVideoPlayback(isPlaying: true);

      clock.advance(const Duration(milliseconds: 2999));
      expect(machine.state, FeedChromeVisibility.full);
      clock.advance(const Duration(milliseconds: 1));
      expect(machine.state, FeedChromeVisibility.hidden);
      expect(changes, [FeedChromeVisibility.hidden]);
    });

    test('photo posts / non-immersive tabs do not arm the timer', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock);
      machine.reportImmersiveSurface(isActive: false);
      machine.reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 5));
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('one reveal tap shows full chrome (no intermediate stage)', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 3));
      expect(machine.state, FeedChromeVisibility.hidden);

      machine.handleSurfaceTap(FeedSurfaceTapIntent.reveal);
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('reveal cancels the inactivity timer (paused = stays visible)', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 3));
      expect(machine.state, FeedChromeVisibility.hidden);

      // Tap reveals chrome; the caller pauses playback.
      machine.handleSurfaceTap(FeedSurfaceTapIntent.reveal);
      machine.reportVideoPlayback(isPlaying: false);
      expect(machine.state, FeedChromeVisibility.full);

      // A paused, revealed surface never auto-hides.
      clock.advance(const Duration(seconds: 10));
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('hide tap hides chrome immediately', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true);
      // Chrome starts visible (full); a hide tap drops straight to hidden.
      expect(machine.state, FeedChromeVisibility.full);
      machine.handleSurfaceTap(FeedSurfaceTapIntent.hide);
      expect(machine.state, FeedChromeVisibility.hidden);
    });

    test('none intent is a no-op', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true);
      final before = machine.state;
      machine.handleSurfaceTap(FeedSurfaceTapIntent.none);
      expect(machine.state, before);
    });

    test('route / surface inactive resets chrome to full', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 3));
      expect(machine.state, FeedChromeVisibility.hidden);

      machine.reportImmersiveSurface(isActive: false);
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('resetToFull cancels pending timer and restores full', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 3));
      expect(machine.state, FeedChromeVisibility.hidden);

      machine.resetToFull();
      expect(machine.state, FeedChromeVisibility.full);
      clock.advance(const Duration(seconds: 5));
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('pausing does NOT change chrome (play/pause is decoupled)', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 3));
      expect(machine.state, FeedChromeVisibility.hidden);

      // Center-tap pause must leave the chrome exactly as it is.
      machine.reportVideoPlayback(isPlaying: false);
      expect(machine.state, FeedChromeVisibility.hidden);
      clock.advance(const Duration(seconds: 5));
      expect(machine.state, FeedChromeVisibility.hidden);
    });

    test('a reveal tap re-hides after 3s while the video keeps playing', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 3));
      expect(machine.state, FeedChromeVisibility.hidden);

      machine.handleSurfaceTap(FeedSurfaceTapIntent.reveal);
      expect(machine.state, FeedChromeVisibility.full);
      clock.advance(const Duration(milliseconds: 2999));
      expect(machine.state, FeedChromeVisibility.full);
      clock.advance(const Duration(milliseconds: 1));
      expect(machine.state, FeedChromeVisibility.hidden);
    });
  });
}
