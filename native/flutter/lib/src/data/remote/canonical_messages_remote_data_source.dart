import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/messages/canonical_message.dart';

class CanonicalMessageRealtimeChange {
  const CanonicalMessageRealtimeChange({
    required this.kind,
    required this.messageId,
    this.conversationId,
    this.revision,
  });

  final PostgresChangeEvent kind;
  final String messageId;
  final String? conversationId;
  final int? revision;
}

abstract interface class CanonicalMessagesRemoteGateway {
  Future<CanonicalMessage?> fetchMessage(String messageId);
  Future<List<CanonicalMessage>> fetchChanged({
    MessageRemoteCursor? after,
    int limit,
  });
  Future<List<CanonicalMessage>> fetchConversationPage(
    String conversationId, {
    DateTime? beforeCreatedAt,
    String? beforeId,
    int limit,
  });
  Future<CanonicalMessage> send(CanonicalMessage message);
  Future<void> uploadMedia(CanonicalMessage message, String localPath);
  Future<void> subscribe(
    String userId,
    void Function(CanonicalMessageRealtimeChange change) onChange,
  );
  Future<void> disconnect();
}

class MessageRemoteCursor {
  const MessageRemoteCursor({required this.updatedAt, required this.messageId});

  final DateTime updatedAt;
  final String messageId;
}

class CanonicalMessagesRemoteDataSource
    implements CanonicalMessagesRemoteGateway {
  CanonicalMessagesRemoteDataSource({required this.isConfigured});

  final bool isConfigured;
  RealtimeChannel? _channel;

  SupabaseClient get _client => Supabase.instance.client;

  @override
  Future<CanonicalMessage?> fetchMessage(String messageId) async {
    if (!isConfigured) return null;
    final value = await _client.rpc<dynamic>(
      'get_message_envelope',
      params: {'p_message_id': messageId},
    );
    return _decodeEnvelope(value);
  }

  @override
  Future<List<CanonicalMessage>> fetchChanged({
    MessageRemoteCursor? after,
    int limit = 100,
  }) async {
    if (!isConfigured) return const [];
    final value = await _client.rpc<List<dynamic>>(
      'get_changed_message_envelopes',
      params: {
        'p_after_updated_at': after?.updatedAt.toUtc().toIso8601String(),
        'p_after_id': after?.messageId,
        'p_limit': limit,
      },
    );
    return value
        .map(_decodeEnvelope)
        .whereType<CanonicalMessage>()
        .toList(growable: false);
  }

  @override
  Future<List<CanonicalMessage>> fetchConversationPage(
    String conversationId, {
    DateTime? beforeCreatedAt,
    String? beforeId,
    int limit = 50,
  }) async {
    if (!isConfigured) return const [];
    final value = await _client.rpc<List<dynamic>>(
      'get_message_page',
      params: {
        'p_conversation_id': conversationId,
        'p_before_created_at': beforeCreatedAt?.toUtc().toIso8601String(),
        'p_before_id': beforeId,
        'p_limit': limit,
      },
    );
    return value
        .map(_decodeEnvelope)
        .whereType<CanonicalMessage>()
        .toList(growable: false);
  }

  @override
  Future<CanonicalMessage> send(CanonicalMessage message) async {
    if (!isConfigured) throw StateError('Supabase is not configured.');
    final value = await _client.rpc<dynamic>(
      'send_message',
      params: {'p_message': message.toJson()},
    );
    final sent = _decodeEnvelope(value);
    if (sent == null)
      throw const FormatException('Invalid send_message response.');
    return sent;
  }

  @override
  Future<void> uploadMedia(CanonicalMessage message, String localPath) async {
    if (!isConfigured) throw StateError('Supabase is not configured.');
    final media = message.payload['media'];
    if (media is! Map) throw const FormatException('Missing payload.media.');
    final mediaMap = Map<String, Object?>.from(media);
    final bucket = mediaMap['bucket']?.toString();
    final path = mediaMap['path']?.toString();
    final mimeType = mediaMap['mime_type']?.toString();
    if (bucket == null || bucket.isEmpty || path == null || path.isEmpty) {
      throw const FormatException('Media bucket/path is required.');
    }

    final file = File(localPath);
    if (!file.existsSync())
      throw StateError('Staged message media is missing.');
    await _client.storage
        .from(bucket)
        .upload(
          path,
          file,
          fileOptions: FileOptions(contentType: mimeType, upsert: true),
        );
  }

  @override
  Future<void> subscribe(
    String userId,
    void Function(CanonicalMessageRealtimeChange change) onChange,
  ) async {
    if (!isConfigured || userId.isEmpty) return;
    await disconnect();
    final channel = _client
        .channel('feedin-messaging-v2:$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          callback: (payload) {
            final row = payload.newRecord.isNotEmpty
                ? payload.newRecord
                : payload.oldRecord;
            final id = row['id']?.toString();
            if (id == null || id.isEmpty) return;
            onChange(
              CanonicalMessageRealtimeChange(
                kind: payload.newRecord.isEmpty
                    ? PostgresChangeEvent.delete
                    : PostgresChangeEvent.update,
                messageId: id,
                conversationId: row['conversation_id']?.toString(),
                revision: int.tryParse(row['revision']?.toString() ?? ''),
              ),
            );
          },
        );
    _channel = channel;
    channel.subscribe();
  }

  @override
  Future<void> disconnect() async {
    final channel = _channel;
    _channel = null;
    if (channel == null || !isConfigured) return;
    await _client.removeChannel(channel);
  }

  CanonicalMessage? _decodeEnvelope(dynamic raw) {
    if (raw == null) return null;
    if (raw is Map) {
      return CanonicalMessage.fromJson(Map<String, Object?>.from(raw));
    }
    throw const FormatException(
      'Canonical message envelope must be an object.',
    );
  }
}
