import '../domain/content_block.dart';
import '../domain/delivery_state.dart';
import '../domain/hybrid_clock.dart';
import '../domain/message_envelope.dart';
import '../domain/result.dart';

/// Pure translation between the domain [MessageEnvelope] and the Supabase
/// canonical wire contract (`send_message` / `get_changed_message_envelopes` /
/// `get_message_envelope` jsonb shapes).
///
/// This is the anti-corruption layer: the ONLY place that knows the server's
/// field names, content-type vocabulary, error codes, and cursor format. It is
/// pure Dart (no SDK import) so every mapping is unit-tested without a network.
class SupabaseWireCodec {
  const SupabaseWireCodec._();

  // -- Outbound: domain -> send_message(p_message) ---------------------------

  /// Build the `p_message` jsonb for `send_message`. Returns a permanent
  /// validation error for content the server contract can't carry yet, and
  /// enforces the "media is uploaded before a message exists" invariant
  /// (media blocks must carry a remote storage path by delivery time).
  static Result<Map<String, Object?>> toWire(MessageEnvelope envelope) {
    final content = envelope.content;
    final (String, Map<String, Object?>)? mapped = switch (content) {
      TextBlock(:final text) => ('text', {'text': text}),
      StickerBlock(:final stickerId) => ('sticker', {'asset_key': stickerId}),
      ImageBlock(:final media) => _mediaWire('image', media),
      VideoBlock(:final media, :final durationMs) => _mediaWire(
        'video',
        media,
        extra: {'duration_ms': durationMs},
      ),
      VoiceNoteBlock(:final media, :final durationMs) => _mediaWire(
        'voice',
        media,
        extra: {'duration_ms': durationMs},
      ),
      FileBlock(:final media, :final fileName) => _mediaWire(
        'file',
        media,
        extra: {'file_name': fileName},
      ),
      _ => null,
    };
    if (mapped == null) {
      return Err(
        CommError.validation(
          'Content kind ${content.kind.name} is not supported by the wire '
          'contract yet',
        ),
      );
    }
    final (contentType, payload) = mapped;
    if (payload.isEmpty) {
      return Err(
        CommError.validation('Media must be uploaded before delivery'),
      );
    }
    return Ok({
      'id': envelope.id,
      'conversation_id': envelope.conversationId,
      'sender_id': envelope.senderId,
      'content_type': contentType,
      'payload': payload,
      if (envelope.replyToId != null) 'reply_to_id': envelope.replyToId,
    });
  }

  /// Empty map = media not uploaded (caller converts to a permanent error).
  static (String, Map<String, Object?>) _mediaWire(
    String contentType,
    MediaRef media, {
    Map<String, Object?> extra = const {},
  }) {
    final path = media.remoteUrl?.trim();
    if (path == null || path.isEmpty) return (contentType, const {});
    return (
      contentType,
      {
        'media': {
          'path': path,
          if (media.mimeType != null) 'mime_type': media.mimeType,
          if (media.sizeBytes > 0) 'size_bytes': media.sizeBytes,
          if (media.sha256 != null) 'sha256': media.sha256,
        },
        ...extra,
      },
    );
  }

  // -- Inbound: server envelope jsonb -> domain ------------------------------

  /// Decode one server envelope. Unknown content types degrade to
  /// [UnsupportedBlock] so newer servers never crash this client.
  static MessageEnvelope fromWire(Map<String, Object?> wire) {
    final metadata =
        (wire['metadata'] as Map?)?.cast<String, Object?>() ?? const {};
    final payload =
        (wire['payload'] as Map?)?.cast<String, Object?>() ?? const {};
    final contentType = wire['content_type']?.toString() ?? 'text';
    final createdMillis = _millis(wire['created_at']) ?? 0;
    final deletedAt = _millis(metadata['deleted_at']);
    final ephemeralMeta =
        (metadata['ephemeral'] as Map?)?.cast<String, Object?>();
    final expiresAt = _millis(ephemeralMeta?['expires_at']);

    return MessageEnvelope(
      id: wire['id']?.toString() ?? '',
      conversationId: wire['conversation_id']?.toString() ?? '',
      senderId: wire['sender_id']?.toString() ?? '',
      sentAt: HybridTimestamp(
        millis: createdMillis,
        counter: 0,
        nodeId: 'server',
      ),
      revision: (metadata['revision'] as num?)?.toInt() ?? 0,
      content: _contentFromWire(contentType, payload),
      replyToId: wire['reply_to_id']?.toString(),
      deliveryState: switch (wire['status']?.toString()) {
        'read' => DeliveryState.read,
        'delivered' => DeliveryState.delivered,
        _ => DeliveryState.sent,
      },
      editedAtMillis: _millis(metadata['edited_at']),
      deletedAtMillis: deletedAt,
      ephemeral: expiresAt == null
          ? null
          : Ephemeral(ttlSeconds: 0, expiresAtMillis: expiresAt),
    );
  }

  static ContentBlock _contentFromWire(
    String contentType,
    Map<String, Object?> payload,
  ) {
    final media = (payload['media'] as Map?)?.cast<String, Object?>();
    MediaRef ref() => MediaRef(
      remoteUrl: media?['path']?.toString(),
      mimeType: media?['mime_type']?.toString(),
      sizeBytes: (media?['size_bytes'] as num?)?.toInt() ?? 0,
      sha256: media?['sha256']?.toString(),
    );
    final durationMs = (payload['duration_ms'] as num?)?.toInt() ?? 0;

    return switch (contentType) {
      'text' => TextBlock(payload['text']?.toString() ?? ''),
      'sticker' => StickerBlock(payload['asset_key']?.toString() ?? ''),
      'image' => ImageBlock(ref()),
      'video' => VideoBlock(ref(), durationMs: durationMs),
      'voice' || 'audio' => VoiceNoteBlock(ref(), durationMs: durationMs),
      'file' => FileBlock(
        ref(),
        fileName: payload['file_name']?.toString() ?? 'file',
      ),
      'system' => SystemEventBlock(payload['event']?.toString() ?? 'unknown'),
      'call' => CallEventBlock(
        callId: payload['call_id']?.toString() ?? '',
        outcome: payload['outcome']?.toString() ?? 'unknown',
        durationSeconds: (payload['duration_seconds'] as num?)?.toInt() ?? 0,
      ),
      _ => UnsupportedBlock({'kind': contentType, ...payload}),
    };
  }

  /// The server-assigned revision from a `send_message` response envelope.
  static int revisionFromWire(Map<String, Object?> wire) {
    final metadata =
        (wire['metadata'] as Map?)?.cast<String, Object?>() ?? const {};
    return (metadata['revision'] as num?)?.toInt() ?? 0;
  }

  // -- Cursor: (updated_at, id) keyset ---------------------------------------

  /// Encode the reconcile cursor as `updatedAtIso|id`.
  static String encodeCursor(String updatedAtIso, String id) =>
      '$updatedAtIso|$id';

  /// Decode a cursor into RPC params, or null for "from the beginning".
  static ({String updatedAt, String id})? decodeCursor(String? cursor) {
    if (cursor == null || cursor.isEmpty) return null;
    final split = cursor.indexOf('|');
    if (split <= 0 || split >= cursor.length - 1) return null;
    return (
      updatedAt: cursor.substring(0, split),
      id: cursor.substring(split + 1),
    );
  }

  /// The cursor covering [wire] (the last envelope of a page).
  static String? cursorForWire(Map<String, Object?> wire) {
    final updatedAt = wire['updated_at']?.toString();
    final id = wire['id']?.toString();
    if (updatedAt == null || id == null) return null;
    return encodeCursor(updatedAt, id);
  }

  // -- Error classification ---------------------------------------------------

  /// Map a server error message/code onto a [CommError] with the right
  /// permanence, so the outbox retries only what can ever succeed.
  static CommError classifyError(String message) {
    final upper = message.toUpperCase();
    if (upper.contains('NOT_AUTHENTICATED')) {
      return CommError.unauthorized('Not signed in');
    }
    if (upper.contains('NOT_AUTHORIZED') || upper.contains('INVALID_SENDER')) {
      return CommError.permission(message);
    }
    if (upper.contains('EMPTY_MESSAGE') ||
        upper.contains('INVALID_CONTENT_TYPE') ||
        upper.contains('INVALID_MEDIA_PAYLOAD') ||
        upper.contains('INVALID_REPLY_TARGET') ||
        upper.contains('INVALID_MESSAGE_IDENTITY') ||
        upper.contains('SERVER_OWNED_CONTENT_TYPE') ||
        upper.contains('MESSAGE_ID_CONFLICT')) {
      return CommError.validation(message);
    }
    // Anything else (socket errors, 5xx, timeouts) is worth retrying.
    return CommError.network(message);
  }

  static int? _millis(Object? value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
  }
}
