import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/messages/chat/chat_mappers.dart';
import 'package:feedin/src/features/messages/canonical_message.dart';
import 'package:feedin/src/features/messages/message_models.dart';

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

  test('projects a pending canonical text record into the chat UI model', () {
    final timestamp = DateTime.utc(2026, 7, 16, 12);
    final canonical = CanonicalMessage(
      id: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      senderId: '33333333-3333-4333-8333-333333333333',
      contentType: CanonicalMessageContentType.text,
      payload: const {'text': 'Queued while offline'},
      status: CanonicalMessageStatus.sending,
      metadata: const {
        'revision': 1,
        'receipts': {'read_count': 0},
        'ephemeral': {
          'view_once': false,
          'viewed_at': null,
          'expires_at': null,
        },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    );

    final local = canonicalMessageToLocalMessage(
      LocalCanonicalMessage(
        message: canonical,
        syncState: MessageSyncState.pending,
      ),
      currentUserId: canonical.senderId,
      currentUserName: 'Ada',
      otherSenderName: 'Tobi',
    );

    expect(local.body, 'Queued while offline');
    expect(local.senderName, 'Ada');
    expect(local.deliveryState, MessageDeliveryState.pending);
    expect(local.createdAtMillis, timestamp.millisecondsSinceEpoch);
  });

  test('projects a canonical sticker emoji into the native bubble model', () {
    final timestamp = DateTime.utc(2026, 7, 22, 8);
    final canonical = CanonicalMessage(
      id: '11111111-1111-4111-8111-111111111112',
      conversationId: '22222222-2222-4222-8222-222222222222',
      senderId: '33333333-3333-4333-8333-333333333333',
      contentType: CanonicalMessageContentType.sticker,
      payload: const {'asset_key': 'rocket', 'emoji': '🚀', 'name': 'Rocket'},
      status: CanonicalMessageStatus.sent,
      metadata: const {'revision': 1},
      createdAt: timestamp,
      updatedAt: timestamp,
    );

    final local = canonicalMessageToLocalMessage(
      LocalCanonicalMessage(
        message: canonical,
        syncState: MessageSyncState.synced,
      ),
      currentUserId: canonical.senderId,
      currentUserName: 'Ada',
      otherSenderName: 'Tobi',
    );

    expect(local.body, '🚀');
    expect(local.messageType, 'sticker');
  });
}
