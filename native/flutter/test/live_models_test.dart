import 'package:feedin/src/features/live/data/live_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses a group-conversation-scoped live stream', () {
    final stream = LiveStreamSummary.fromJson({
      'id': 'stream-1',
      'user_id': 'host-1',
      'title': 'Study session',
      'status': 'live',
      'viewer_count': 4,
      'group_conversation_id': 'conversation-1',
    });

    expect(stream.groupConversationId, 'conversation-1');
    expect(stream.isLive, isTrue);
  });
}
