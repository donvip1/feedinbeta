import 'package:feedin/src/core/notifications/push_notification_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('keeps calls on the native incoming-call presentation path', () {
    expect(
      backgroundPresentationForData({'type': 'call', 'call_id': 'k1'}),
      BackgroundPushPresentation.call,
    );
  });

  test('presents messages with rich conversation notifications', () {
    expect(
      backgroundPresentationForData({
        'type': 'message',
        'conversation_id': 'c1',
      }),
      BackgroundPushPresentation.message,
    );
  });

  test('presents gift and social events as local notifications', () {
    for (final type in ['gift', 'comment', 'mention', 'tag', 'follow']) {
      expect(
        backgroundPresentationForData({'type': type}),
        BackgroundPushPresentation.social,
        reason: type,
      );
    }
  });

  test('ignores unknown background payloads', () {
    expect(
      backgroundPresentationForData({'type': 'unknown'}),
      BackgroundPushPresentation.ignore,
    );
  });
}
