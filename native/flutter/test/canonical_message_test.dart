import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../lib/src/features/messages/canonical_message.dart';

void main() {
  test('parses and round-trips the shared text fixture', () async {
    final fixture = File(
      '../../contracts/messaging/fixtures/text-message.json',
    );
    final decoded = jsonDecode(await fixture.readAsString());
    final message = CanonicalMessage.fromJson(
      Map<String, Object?>.from(decoded as Map),
    );

    expect(message.contentType, CanonicalMessageContentType.text);
    expect(message.payload['text'], 'Hello from the canonical contract');
    expect(message.isMine('33333333-3333-4333-8333-333333333333'), isTrue);
    expect(message.isMine('44444444-4444-4444-8444-444444444444'), isFalse);
    expect(message.revision, 1);
    expect(CanonicalMessage.fromJson(message.toJson()).id, message.id);
  });

  test('rejects media messages without a canonical storage path', () {
    expect(
      () => CanonicalMessage.fromJson({
        'id': '11111111-1111-4111-8111-111111111111',
        'conversation_id': '22222222-2222-4222-8222-222222222222',
        'sender_id': '33333333-3333-4333-8333-333333333333',
        'content_type': 'image',
        'payload': <String, Object?>{},
        'reply_to_id': null,
        'status': 'sending',
        'metadata': <String, Object?>{'revision': 1},
        'created_at': '2026-07-16T12:00:00.000Z',
        'updated_at': '2026-07-16T12:00:00.000Z',
      }),
      throwsFormatException,
    );
  });
}
