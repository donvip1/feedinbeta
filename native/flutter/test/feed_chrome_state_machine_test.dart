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

    test('arming the immersive surface + video playback schedules timer', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock);
      final changes = <FeedChromeVisibility>[];
      machine.attachListener(changes.add);

      machine.reportImmersiveSurface(isActive: true);
      machine.reportVideoPlayback(isPlaying: true);

      clock.advance(const Duration(seconds: 2));
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

    test('hidden → socialOnly → full reveal sequence', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 2));
      expect(machine.state, FeedChromeVisibility.hidden);

      machine.handleSurfaceTap(FeedSurfaceTapIntent.chromeReveal);
      expect(machine.state, FeedChromeVisibility.socialOnly);

      machine.handleSurfaceTap(FeedSurfaceTapIntent.chromeReveal);
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('reveal taps do not toggle playback (chromeReveal intent)', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 2));

      machine.handleSurfaceTap(FeedSurfaceTapIntent.chromeReveal);
      expect(machine.state, FeedChromeVisibility.socialOnly);
      // No auto-hide restart on reveal.
      machine.handleSurfaceTap(FeedSurfaceTapIntent.chromeReveal);
      expect(machine.state, FeedChromeVisibility.full);
      // Should not auto-hide immediately on entering full.
      clock.advance(const Duration(milliseconds: 500));
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('video playback tap cancels any pending timer', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(milliseconds: 500));
      machine.handleSurfaceTap(FeedSurfaceTapIntent.videoPlayback);
      // Advance past the original deadline — no hide should fire.
      clock.advance(const Duration(seconds: 5));
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('route / surface inactive resets chrome to full', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 2));
      expect(machine.state, FeedChromeVisibility.hidden);

      machine.reportImmersiveSurface(isActive: false);
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('resetToFull cancels pending timer and restores full', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(milliseconds: 500));
      machine.handleSurfaceTap(FeedSurfaceTapIntent.chromeReveal);
      expect(machine.state, FeedChromeVisibility.socialOnly);

      machine.resetToFull();
      expect(machine.state, FeedChromeVisibility.full);
      clock.advance(const Duration(seconds: 5));
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('multiple advance calls fire timers in chronological order', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 1));
      clock.advance(const Duration(seconds: 1));
      expect(machine.state, FeedChromeVisibility.hidden);
    });
  });
}