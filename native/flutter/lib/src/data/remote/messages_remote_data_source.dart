import 'package:supabase_flutter/supabase_flutter.dart';

class MessagesRemoteDataSource {
  const MessagesRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<List<RemoteConversation>> fetchConversations() async {
    if (!isConfigured) return const [];

    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return const [];

    final rows = await client.rpc<List<dynamic>>(
      'get_conversations_with_details',
      params: {'p_user_id': userId},
    );

    return rows
        .whereType<Map>()
        .map(
          (row) => RemoteConversation.fromJson(Map<String, Object?>.from(row)),
        )
        .toList();
  }

  Future<List<RemoteMessage>> fetchMessages(String serverConversationId) async {
    if (!isConfigured) return const [];

    final client = Supabase.instance.client;
    final viewerId = client.auth.currentUser?.id;

    // IMPORTANT: select ONLY columns that exist on the live `messages` table
    // (id, conversation_id, sender_id, content, message_type, status,
    // created_at). Selecting columns the table lacks (e.g. is_read / read_at /
    // metadata / message_attachments) raises a PostgREST schema-cache error and
    // breaks the whole conversation load. Read state is therefore derived from
    // the recipient's conversation_participants.last_read_at instead of a
    // per-message flag.
    //
    // The ephemeral columns (view_once / expires_at / view_once_seen_at) are
    // added by 20260706000000_message_ephemeral.sql, so they are safe to select
    // here; RemoteMessage.fromJson tolerates their absence on older backends.
    final rows = await client
        .from('messages')
        .select(
          'id, conversation_id, sender_id, content, message_type, status, '
          'created_at, reply_to_id, view_once, expires_at, view_once_seen_at, '
          'profiles!messages_sender_id_fkey(display_name, username, avatar_url)',
        )
        .eq('conversation_id', serverConversationId)
        .order('created_at');

    final attachments = await _fetchMessageAttachments(serverConversationId);

    // The other participant's last_read_at: every message I sent at or before
    // this timestamp has been read by them. This drives the outgoing-bubble
    // read tick without needing a per-message read column on `messages`.
    final otherReadState = await _otherParticipantReadState(
      serverConversationId,
      viewerId,
    );

    return rows.whereType<Map>().map((row) {
      final json = Map<String, Object?>.from(row);
      final messageId = json['id']?.toString();
      if (messageId != null) {
        json['attachment'] = attachments[messageId];
      }
      return RemoteMessage.fromJson(
        json,
        viewerId: viewerId,
        otherLastReadAtMillis: otherReadState?.readAtMillis,
        otherReaderUserId: otherReadState?.userId,
      );
    }).toList();
  }

  /// Loads the first live attachment for each message and signs its private
  /// storage path. Attachment failures never hide the underlying thread.
  Future<Map<String, Map<String, Object?>>> _fetchMessageAttachments(
    String serverConversationId,
  ) async {
    try {
      final client = Supabase.instance.client;
      final rows = await client
          .from('message_attachments')
          .select(
            'message_id, storage_bucket, storage_path, public_url, file_name, '
            'file_size_bytes, mime_type, media_type, thumbnail_url, '
            'duration_ms, deleted_at, created_at',
          )
          .eq('conversation_id', serverConversationId)
          .order('created_at');

      final byMessage = <String, Map<String, Object?>>{};
      for (final raw in rows.whereType<Map>()) {
        final attachment = Map<String, Object?>.from(raw);
        if (attachment['deleted_at'] != null) continue;

        final messageId = attachment['message_id']?.toString();
        if (messageId == null || messageId.isEmpty) continue;

        final bucket = attachment['storage_bucket']?.toString();
        final path = attachment['storage_path']?.toString();
        if (bucket != null &&
            bucket.isNotEmpty &&
            path != null &&
            path.isNotEmpty) {
          try {
            attachment['signed_url'] = await client.storage
                .from(bucket)
                .createSignedUrl(path, 3600);
          } catch (_) {
            // Metadata is still useful when URL signing is temporarily down.
          }
        }
        byMessage.putIfAbsent(messageId, () => attachment);
      }
      return byMessage;
    } catch (_) {
      // Older deployments may not have the attachment parity table yet.
      return const <String, Map<String, Object?>>{};
    }
  }

  /// Most-recent `last_read_at` (epoch millis) across every *other* participant
  /// of [serverConversationId], or null when none have read yet.
  Future<_ParticipantReadState?> _otherParticipantReadState(
    String serverConversationId,
    String? viewerId,
  ) async {
    try {
      final rows = await Supabase.instance.client
          .from('conversation_participants')
          .select('user_id, last_read_at')
          .eq('conversation_id', serverConversationId);

      _ParticipantReadState? latest;
      for (final row in rows.whereType<Map>()) {
        final userId = row['user_id']?.toString();
        if (userId == null || userId == viewerId) continue;
        final millis = _parseNullableMillis(row['last_read_at']);
        if (millis == null) continue;
        if (latest == null || millis > latest.readAtMillis) {
          latest = _ParticipantReadState(userId: userId, readAtMillis: millis);
        }
      }
      return latest;
    } catch (_) {
      // last_read_at is optional metadata; never let it break message loading.
      return null;
    }
  }

  Future<void> markConversationRead(String serverConversationId) async {
    if (!isConfigured) return;
    await Supabase.instance.client.rpc<void>(
      'mark_conversation_read',
      params: {'p_conversation_id': serverConversationId},
    );
  }

  Future<void> updatePresence(String status) async {
    if (!isConfigured) return;
    await Supabase.instance.client.rpc<void>(
      'update_presence',
      params: {'p_status': status},
    );
  }
}

class RemoteConversation {
  const RemoteConversation({
    required this.serverConversationId,
    required this.title,
    required this.lastMessagePreview,
    required this.updatedAtMillis,
    required this.unreadCount,
    this.otherUserId,
    this.otherUserAvatarUrl,
    this.otherUserPresence,
    this.otherUserLastSeenAtMillis,
    this.disappearingSeconds = 0,
  });

  final String serverConversationId;
  final String title;
  final String lastMessagePreview;
  final int updatedAtMillis;
  final int unreadCount;
  final String? otherUserId;
  final String? otherUserAvatarUrl;
  final String? otherUserPresence;
  final int? otherUserLastSeenAtMillis;
  final int disappearingSeconds;

  factory RemoteConversation.fromJson(Map<String, Object?> json) {
    final displayName = json['other_user_display_name']?.toString();
    final username = json['other_user_username']?.toString();
    final updatedAt = json['last_message_created_at'] ?? json['updated_at'];

    return RemoteConversation(
      serverConversationId: json['conversation_id'].toString(),
      otherUserId: json['other_user_id']?.toString(),
      title: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn chat',
      otherUserAvatarUrl: json['other_user_avatar_url']?.toString(),
      otherUserPresence: json['other_user_presence']?.toString(),
      otherUserLastSeenAtMillis: _parseNullableMillis(
        json['other_user_last_seen_at'],
      ),
      disappearingSeconds:
          int.tryParse(json['disappearing_seconds']?.toString() ?? '0') ?? 0,
      lastMessagePreview:
          json['last_message_content']?.toString() ??
          'Tap to send your first message.',
      updatedAtMillis: _parseMillis(updatedAt),
      unreadCount: int.tryParse(json['unread_count']?.toString() ?? '0') ?? 0,
    );
  }
}

class RemoteMessage {
  const RemoteMessage({
    required this.id,
    required this.serverConversationId,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAtMillis,
    required this.deliveryStateName,
    this.senderAvatarUrl,
    this.replyToId,
    this.messageType = 'text',
    this.readAtMillis,
    this.readByUserId,
    this.mediaUrl,
    this.thumbnailUrl,
    this.mimeType,
    this.fileName,
    this.fileSizeBytes,
    this.durationMs,
    this.viewOnce = false,
    this.expiresAtMillis,
    this.viewOnceSeenAtMillis,
  });

  final String id;
  final String serverConversationId;
  final String senderId;
  final String senderName;
  final String body;
  final int createdAtMillis;
  final String deliveryStateName;
  final String? senderAvatarUrl;
  final String? replyToId;
  final String messageType;
  final int? readAtMillis;
  final String? readByUserId;

  // Media fields are hydrated from the first live `message_attachments` row.
  final String? mediaUrl;
  final String? thumbnailUrl;
  final String? mimeType;
  final String? fileName;
  final int? fileSizeBytes;
  final int? durationMs;

  // Ephemeral (view-once / disappearing) fields from the ephemeral migration.
  // Data is carried through to LocalMessage; no behaviour is wired off it yet.
  final bool viewOnce;
  final int? expiresAtMillis;
  final int? viewOnceSeenAtMillis;

  factory RemoteMessage.fromJson(
    Map<String, Object?> json, {
    String? viewerId,
    int? otherLastReadAtMillis,
    String? otherReaderUserId,
  }) {
    final profile = json['profiles'];
    final profileMap = profile is Map
        ? Map<String, Object?>.from(profile)
        : null;
    final displayName = profileMap?['display_name']?.toString();
    final username = profileMap?['username']?.toString();

    final senderId = json['sender_id'].toString();
    final createdAtMillis = _parseMillis(json['created_at']);
    final isMine = viewerId != null && senderId == viewerId;
    final rawAttachment = json['attachment'];
    final attachment = rawAttachment is Map
        ? Map<String, Object?>.from(rawAttachment)
        : null;

    // Read state for MY outgoing messages: read once the other participant's
    // last_read_at is at/after this message's timestamp. Incoming messages keep
    // the server `status`, so they never show a (meaningless) "read" tick.
    int? readAtMillis;
    var deliveryStateName = _deliveryState(json);
    if (isMine &&
        otherLastReadAtMillis != null &&
        otherLastReadAtMillis >= createdAtMillis) {
      deliveryStateName = 'read';
      readAtMillis = otherLastReadAtMillis;
    }

    return RemoteMessage(
      id: json['id'].toString(),
      serverConversationId: json['conversation_id'].toString(),
      senderId: senderId,
      senderName: (displayName != null && displayName.isNotEmpty)
          ? displayName
          : (username != null && username.isNotEmpty)
          ? '@$username'
          : 'feedIn user',
      senderAvatarUrl: profileMap?['avatar_url']?.toString(),
      replyToId: json['reply_to_id']?.toString(),
      body: json['content']?.toString() ?? '',
      createdAtMillis: createdAtMillis,
      deliveryStateName: deliveryStateName,
      messageType:
          attachment?['media_type']?.toString() ??
          json['message_type']?.toString() ??
          'text',
      readAtMillis: readAtMillis,
      readByUserId: readAtMillis == null ? null : otherReaderUserId,
      mediaUrl:
          attachment?['signed_url']?.toString() ??
          attachment?['public_url']?.toString(),
      thumbnailUrl: attachment?['thumbnail_url']?.toString(),
      mimeType: attachment?['mime_type']?.toString(),
      fileName: attachment?['file_name']?.toString(),
      fileSizeBytes: _parseNullableInt(attachment?['file_size_bytes']),
      durationMs: _parseNullableInt(attachment?['duration_ms']),
      viewOnce: _parseBool(json['view_once']),
      expiresAtMillis: _parseNullableMillis(json['expires_at']),
      viewOnceSeenAtMillis: _parseNullableMillis(json['view_once_seen_at']),
    );
  }
}

class _ParticipantReadState {
  const _ParticipantReadState({
    required this.userId,
    required this.readAtMillis,
  });

  final String userId;
  final int readAtMillis;
}

/// Parses a Postgres boolean that may arrive as a Dart [bool] or a string
/// ('true'/'t'/'1'). Defaults to false when absent/unrecognised.
bool _parseBool(Object? value) {
  if (value is bool) return value;
  final s = value?.toString().trim().toLowerCase();
  return s == 'true' || s == 't' || s == '1';
}

/// Delivery state from the live `messages.status` column only. The live table
/// has no `is_read` column, so 'read' is inferred from status === 'read' (and,
/// for outgoing messages, the recipient's last_read_at in [RemoteMessage]).
String _deliveryState(Map<String, Object?> json) {
  final status = json['status']?.toString();
  if (status == 'read') return 'read';
  return status == null || status.isEmpty ? 'delivered' : status;
}

int _parseMillis(Object? value) {
  if (value is DateTime) return value.millisecondsSinceEpoch;
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  return parsed?.millisecondsSinceEpoch ??
      DateTime.now().millisecondsSinceEpoch;
}

int? _parseNullableMillis(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.millisecondsSinceEpoch;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return DateTime.tryParse(value.toString())?.millisecondsSinceEpoch;
}

int? _parseNullableInt(Object? value) {
  if (value is int) return value;
  return int.tryParse(value?.toString() ?? '');
}
