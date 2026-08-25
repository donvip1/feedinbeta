import 'package:feedin/src/core/realtime/feedin_realtime_service.dart';
import 'package:feedin/src/core/realtime/incoming_message_resolver.dart';
import 'package:feedin/src/features/feed/feed_shell.dart';
import 'package:feedin/src/features/feed/state/feed_chrome_state_machine.dart';
import 'package:feedin/src/features/feed/state/feed_gesture_resolver.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('feed top chrome keeps tabs centered between action zones', (
    tester,
  ) async {
    // Production padding leaves 304px of a 320px viewport for this layout.
    await tester.binding.setSurfaceSize(const Size(304, 120));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            height: 48,
            child: FeedTopChromeLayout(
              leading: SizedBox(
                key: Key('feed-top-leading'),
                width: 58,
                height: 36,
              ),
              center: SizedBox(
                key: Key('feed-top-tabs'),
                width: 104,
                height: 24,
              ),
              trailing: SizedBox(
                key: Key('feed-top-trailing'),
                width: 108,
                height: 36,
              ),
            ),
          ),
        ),
      ),
    );

    final tabsRect = tester.getRect(find.byKey(const Key('feed-top-tabs')));
    final leadingRect = tester.getRect(
      find.byKey(const Key('feed-top-leading')),
    );
    final trailingRect = tester.getRect(
      find.byKey(const Key('feed-top-trailing')),
    );

    expect(tabsRect.center.dx, closeTo(152, 0.01));
    expect(leadingRect.right, lessThanOrEqualTo(tabsRect.left));
    expect(tabsRect.right, lessThanOrEqualTo(trailingRect.left));
    expect(tester.takeException(), isNull);
  });

  group('FeedGestureResolver', () {
    test('video page + hidden chrome returns reveal', () {
      final decision = FeedGestureResolver.decideSurfaceTap(
        chromeState: FeedChromeVisibility.hidden,
        isActiveVideoPage: true,
      );
      expect(decision.chromeIntent, FeedSurfaceTapIntent.chromeReveal);
      expect(decision.shouldTogglePlayback, isFalse);
    });

    test('video page + socialOnly chrome returns reveal', () {
      final decision = FeedGestureResolver.decideSurfaceTap(
        chromeState: FeedChromeVisibility.socialOnly,
        isActiveVideoPage: true,
      );
      expect(decision.chromeIntent, FeedSurfaceTapIntent.chromeReveal);
    });

    test('video page + full chrome returns playback', () {
      final decision = FeedGestureResolver.decideSurfaceTap(
        chromeState: FeedChromeVisibility.full,
        isActiveVideoPage: true,
      );
      expect(decision.chromeIntent, FeedSurfaceTapIntent.videoPlayback);
      expect(decision.shouldTogglePlayback, isTrue);
    });

    test('photo / text page absorbs taps regardless of chrome state', () {
      for (final state in FeedChromeVisibility.values) {
        final decision = FeedGestureResolver.decideSurfaceTap(
          chromeState: state,
          isActiveVideoPage: false,
        );
        expect(decision.chromeIntent, FeedSurfaceTapIntent.none);
        expect(decision.shouldTogglePlayback, isFalse);
      }
    });
  });

  group('IncomingMessageResolver', () {
    test('insert event for another user builds a banner', () {
      final event = FeedinRealtimeEvent(
        kind: FeedinRealtimeEventKind.insert,
        type: FeedinRealtimeEventType.messageChanged,
        recordId: 'msg-1',
        messageRecord: <String, dynamic>{
          'conversation_id': 'conv-1',
          'sender_id': 'other-user',
          'content': 'Hello there',
          'profiles': <String, dynamic>{
            'display_name': 'Ada',
            'username': 'ada',
            'avatar_url': 'https://example.test/a.png',
          },
        },
      );
      final banner = IncomingMessageResolver(
        currentUserId: 'me',
        event: event,
      ).buildBanner();
      expect(banner, isNotNull);
      expect(banner!.conversationId, 'conv-1');
      expect(banner.senderName, 'Ada');
      expect(banner.preview, 'Hello there');
      expect(banner.avatarUrl, 'https://example.test/a.png');
    });

    test('update event does not build a banner', () {
      final event = FeedinRealtimeEvent(
        kind: FeedinRealtimeEventKind.update,
        type: FeedinRealtimeEventType.messageChanged,
        recordId: 'msg-2',
        messageRecord: <String, dynamic>{
          'conversation_id': 'conv-1',
          'sender_id': 'other-user',
          'content': 'edited',
        },
      );
      expect(
        IncomingMessageResolver(
          currentUserId: 'me',
          event: event,
        ).buildBanner(),
        isNull,
      );
    });

    test('delete event does not build a banner', () {
      final event = FeedinRealtimeEvent(
        kind: FeedinRealtimeEventKind.delete,
        type: FeedinRealtimeEventType.messageChanged,
        recordId: 'msg-3',
        messageRecord: <String, dynamic>{
          'conversation_id': 'conv-1',
          'sender_id': 'other-user',
        },
      );
      expect(
        IncomingMessageResolver(
          currentUserId: 'me',
          event: event,
        ).buildBanner(),
        isNull,
      );
    });

    test('self-authored message does not build a banner', () {
      final event = FeedinRealtimeEvent(
        kind: FeedinRealtimeEventKind.insert,
        type: FeedinRealtimeEventType.messageChanged,
        recordId: 'msg-4',
        messageRecord: <String, dynamic>{
          'conversation_id': 'conv-1',
          'sender_id': 'me',
          'content': 'self message',
        },
      );
      expect(
        IncomingMessageResolver(
          currentUserId: 'me',
          event: event,
        ).buildBanner(),
        isNull,
      );
    });

    test('missing conversation id does not build a banner', () {
      final event = FeedinRealtimeEvent(
        kind: FeedinRealtimeEventKind.insert,
        type: FeedinRealtimeEventType.messageChanged,
        recordId: 'msg-5',
        messageRecord: <String, dynamic>{
          'sender_id': 'other-user',
          'content': 'orphan',
        },
      );
      expect(
        IncomingMessageResolver(
          currentUserId: 'me',
          event: event,
        ).buildBanner(),
        isNull,
      );
    });

    test('missing content falls back to a placeholder preview', () {
      final event = FeedinRealtimeEvent(
        kind: FeedinRealtimeEventKind.insert,
        type: FeedinRealtimeEventType.messageChanged,
        recordId: 'msg-6',
        messageRecord: <String, dynamic>{
          'conversation_id': 'conv-1',
          'sender_id': 'other-user',
        },
      );
      final banner = IncomingMessageResolver(
        currentUserId: 'me',
        event: event,
      ).buildBanner();
      expect(banner, isNotNull);
      expect(banner!.preview, 'New message');
      expect(banner.senderName, 'Someone');
    });
  });
}
