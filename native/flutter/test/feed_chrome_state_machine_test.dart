import 'package:feedin/src/features/feed/state/feed_chrome_state_machine.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FeedChromeStateMachine', () {
    test('starts in full chrome', () {
      final machine = FeedChromeStateMachine(clock: FakeFeedChromeClock());
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('video enters immersive mode after four seconds', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 3, milliseconds: 999));
      expect(machine.state, FeedChromeVisibility.full);
      clock.advance(const Duration(milliseconds: 1));
      expect(machine.state, FeedChromeVisibility.hidden);
    });

    test('corner tap restores the complete chrome in one gesture', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 4));
      machine.handleSurfaceTap(FeedSurfaceTapIntent.chromeReveal);
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('photos and inactive surfaces never auto-hide', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: false)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 10));
      expect(machine.state, FeedChromeVisibility.full);
    });

    test('pausing video cancels the hide timer', () {
      final clock = FakeFeedChromeClock();
      final machine = FeedChromeStateMachine(clock: clock)
        ..reportImmersiveSurface(isActive: true)
        ..reportVideoPlayback(isPlaying: true);
      clock.advance(const Duration(seconds: 2));
      machine.reportVideoPlayback(isPlaying: false);
      clock.advance(const Duration(seconds: 5));
      expect(machine.state, FeedChromeVisibility.full);
    });
  });
}
