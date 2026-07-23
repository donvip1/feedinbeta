import 'package:feedin/src/features/communication/domain/content_block.dart';
import 'package:feedin/src/features/communication/domain/delivery_state.dart';
import 'package:feedin/src/features/communication/domain/hybrid_clock.dart';
import 'package:feedin/src/features/communication/domain/message_envelope.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:feedin/src/features/communication/transport/supabase_wire_codec.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  MessageEnvelope make(ContentBlock content, {String? replyToId}) =>
      MessageEnvelope(
        id: '11111111-1111-1111-1111-111111111111',
        conversationId: '22222222-2222-2222-2222-222222222222',
        senderId: 'user-1',
        sentAt: const HybridTimestamp(millis: 1000, counter: 0, nodeId: 'dev'),
        content: content,
        replyToId: replyToId,
      );

  group('toWire (domain -> send_message)', () {
    test('text maps to content_type text + payload.text', () {
      final wire = SupabaseWireCodec.toWire(make(const TextBlock('hey'))).valueOrNull!;
      expect(wire['content_type'], 'text');
      expect((wire['payload'] as Map)['text'], 'hey');
      expect(wire['id'], '11111111-1111-1111-1111-111111111111');
      expect(wire.containsKey('reply_to_id'), isFalse);
    });

    test('sticker maps to payload.asset_key (server contract)', () {
      final wire =
          SupabaseWireCodec.toWire(make(const StickerBlock('wave'))).valueOrNull!;
      expect(wire['content_type'], 'sticker');
      expect((wire['payload'] as Map)['asset_key'], 'wave');
    });

    test('uploaded media maps to payload.media.path with metadata', () {
      final wire = SupabaseWireCodec.toWire(
        make(const VideoBlock(
          MediaRef(
            remoteUrl: 'conversations/c1/v.mp4',
            mimeType: 'video/mp4',
            sizeBytes: 123,
            sha256: 'abc',
          ),
          durationMs: 4200,
        )),
      ).valueOrNull!;
      expect(wire['content_type'], 'video');
      final payload = wire['payload'] as Map;
      expect((payload['media'] as Map)['path'], 'conversations/c1/v.mp4');
      expect((payload['media'] as Map)['sha256'], 'abc');
      expect(payload['duration_ms'], 4200);
    });

    test('NOT-uploaded media is a permanent validation error (invariant)', () {
      final result = SupabaseWireCodec.toWire(
        make(const ImageBlock(MediaRef(localPath: '/tmp/x.jpg'))),
      );
      expect(result.isErr, isTrue);
      expect(result.errorOrNull!.kind, CommErrorKind.validation);
      expect(result.errorOrNull!.isTransient, isFalse);
    });

    test('unsupported-on-wire kinds are permanent errors, not silent drops', () {
      final result = SupabaseWireCodec.toWire(
        make(const PollBlock(question: 'Q', options: ['a', 'b'])),
      );
      expect(result.isErr, isTrue);
      expect(result.errorOrNull!.kind, CommErrorKind.validation);
    });

    test('reply id is forwarded', () {
      final wire = SupabaseWireCodec.toWire(
        make(const TextBlock('re'), replyToId: 'parent-1'),
      ).valueOrNull!;
      expect(wire['reply_to_id'], 'parent-1');
    });
  });

  group('fromWire (server envelope -> domain)', () {
    Map<String, Object?> serverWire({
      String contentType = 'text',
      Map<String, Object?> payload = const {'text': 'hello'},
      String status = 'sent',
      int revision = 4,
    }) => {
      'id': 'm-1',
      'conversation_id': 'c-1',
      'sender_id': 'u-2',
      'content_type': contentType,
      'payload': payload,
      'reply_to_id': null,
      'status': status,
      'metadata': {'schema_version': 1, 'revision': revision},
      'created_at': '2026-07-23T10:00:00.000Z',
      'updated_at': '2026-07-23T10:00:01.000Z',
    };

    test('decodes text with revision and delivery state', () {
      final env = SupabaseWireCodec.fromWire(serverWire(status: 'read'));
      expect(env.id, 'm-1');
      expect(env.revision, 4);
      expect(env.deliveryState, DeliveryState.read);
      expect((env.content as TextBlock).text, 'hello');
      expect(env.sentAt.millis, greaterThan(0));
    });

    test('decodes voice (and legacy audio alias) to VoiceNoteBlock', () {
      for (final type in ['voice', 'audio']) {
        final env = SupabaseWireCodec.fromWire(serverWire(
          contentType: type,
          payload: {
            'media': {'path': 'p/a.m4a', 'mime_type': 'audio/mp4'},
            'duration_ms': 900,
          },
        ));
        final block = env.content as VoiceNoteBlock;
        expect(block.media.remoteUrl, 'p/a.m4a');
        expect(block.durationMs, 900);
      }
    });

    test('unknown content type degrades to UnsupportedBlock (never crashes)', () {
      final env = SupabaseWireCodec.fromWire(
        serverWire(contentType: 'hologram', payload: {'x': 1}),
      );
      expect(env.content.kind, ContentBlockKind.unsupported);
    });

    test('toWire -> fromWire round-trips the meaningful fields', () {
      final original = make(const TextBlock('round trip'));
      final wire = SupabaseWireCodec.toWire(original).valueOrNull!;
      // Simulate the server echoing an envelope for that message.
      final echoed = SupabaseWireCodec.fromWire({
        ...wire,
        'status': 'sent',
        'metadata': {'revision': 1},
        'created_at': '2026-07-23T10:00:00.000Z',
        'updated_at': '2026-07-23T10:00:00.000Z',
      });
      expect(echoed.id, original.id);
      expect(echoed.conversationId, original.conversationId);
      expect((echoed.content as TextBlock).text, 'round trip');
      expect(echoed.revision, 1);
    });
  });

  group('cursor keyset', () {
    test('encode/decode round-trip; ids with pipes rejected safely', () {
      final cursor = SupabaseWireCodec.encodeCursor(
        '2026-07-23T10:00:01.000Z',
        'm-1',
      );
      final decoded = SupabaseWireCodec.decodeCursor(cursor)!;
      expect(decoded.updatedAt, '2026-07-23T10:00:01.000Z');
      expect(decoded.id, 'm-1');
      expect(SupabaseWireCodec.decodeCursor(null), isNull);
      expect(SupabaseWireCodec.decodeCursor('garbage'), isNull);
    });

    test('cursorForWire uses updated_at + id', () {
      final cursor = SupabaseWireCodec.cursorForWire({
        'id': 'm-9',
        'updated_at': '2026-07-23T11:00:00.000Z',
      });
      expect(cursor, '2026-07-23T11:00:00.000Z|m-9');
    });
  });

  group('error classification (drives outbox retry policy)', () {
    test('permanent server rejections are non-transient', () {
      for (final code in [
        'EMPTY_MESSAGE',
        'INVALID_CONTENT_TYPE',
        'INVALID_MEDIA_PAYLOAD',
        'INVALID_REPLY_TARGET',
        'SERVER_OWNED_CONTENT_TYPE',
        'MESSAGE_ID_CONFLICT',
      ]) {
        final err = SupabaseWireCodec.classifyError(code);
        expect(err.isTransient, isFalse, reason: code);
        expect(err.kind, CommErrorKind.validation, reason: code);
      }
      expect(
        SupabaseWireCodec.classifyError('NOT_AUTHORIZED').kind,
        CommErrorKind.permission,
      );
      expect(
        SupabaseWireCodec.classifyError('NOT_AUTHENTICATED').kind,
        CommErrorKind.unauthorized,
      );
    });

    test('everything else is transient (retried with backoff)', () {
      final err = SupabaseWireCodec.classifyError('connection reset by peer');
      expect(err.isTransient, isTrue);
      expect(err.kind, CommErrorKind.network);
    });
  });
}
