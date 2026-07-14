import 'package:supabase_flutter/supabase_flutter.dart';

typedef MessageRpcInvoker =
    Future<dynamic> Function(
      String functionName,
      Map<String, Object?> parameters,
    );

/// Remote actions on an individual message.
///
/// The RPCs enforce participant/author checks server-side. Auto-detection and
/// nullable mutation results let the chat UI degrade cleanly when Supabase is
/// unavailable or a local-only message has not reached the server yet.
///
/// These operate on the SERVER message id, which for materialized messages is
/// `LocalMessage.id` (see message_materializer.dart). Locally-queued messages
/// that haven't synced yet have no server row, so actions return a soft failure.
class MessageInteractionsDataSource {
  const MessageInteractionsDataSource({
    required this.isConfigured,
    MessageRpcInvoker? rpcInvoker,
  }) : _rpcInvoker = rpcInvoker;

  factory MessageInteractionsDataSource.autoDetect() {
    var configured = false;
    try {
      Supabase.instance.client;
      configured = true;
    } catch (_) {
      configured = false;
    }
    return MessageInteractionsDataSource(isConfigured: configured);
  }

  final bool isConfigured;
  final MessageRpcInvoker? _rpcInvoker;

  SupabaseClient? get _client {
    if (!isConfigured) return null;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  Future<dynamic> _rpc(
    String functionName,
    Map<String, Object?> parameters,
  ) async {
    final invoker = _rpcInvoker;
    if (invoker != null) {
      return invoker(functionName, parameters);
    }
    final client = _client;
    if (client == null) {
      throw StateError('Supabase is not configured.');
    }
    return client.rpc<dynamic>(functionName, params: parameters);
  }

  /// Toggles [emoji] on [messageId] for the current user. Returns whether the
  /// reaction is now present (true) or was removed (false); null on failure.
  Future<bool?> toggleReaction(String messageId, String emoji) async {
    if (!isConfigured && _rpcInvoker == null) return null;
    final normalizedMessageId = messageId.trim();
    final normalizedEmoji = emoji.trim();
    if (normalizedMessageId.isEmpty || normalizedEmoji.isEmpty) return null;
    try {
      final result = await _rpc('toggle_message_reaction', {
        'p_message_id': normalizedMessageId,
        'p_emoji': normalizedEmoji,
      });
      return result is bool ? result : null;
    } catch (_) {
      return null;
    }
  }

  /// Soft-deletes [messageId] (author only, enforced server-side). Returns true
  /// on success.
  Future<bool> deleteMessage(String messageId) async {
    if (!isConfigured && _rpcInvoker == null) return false;
    final normalizedMessageId = messageId.trim();
    if (normalizedMessageId.isEmpty) return false;
    try {
      await _rpc('delete_message', {'p_message_id': normalizedMessageId});
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Marks a view-once [messageId] as seen (recipient only, enforced
  /// server-side): stamps `view_once_seen_at` and blanks the payload so it can
  /// never be re-fetched. Returns true on success.
  Future<bool> markViewOnceSeen(String messageId) async {
    if (!isConfigured && _rpcInvoker == null) return false;
    final normalizedMessageId = messageId.trim();
    if (normalizedMessageId.isEmpty) return false;
    try {
      await _rpc('mark_view_once_seen', {'p_message_id': normalizedMessageId});
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Sets the per-conversation disappearing-message timer ([seconds]; 0 = off),
  /// participant-only. Returns true on success.
  Future<bool> setDisappearingTimer(String conversationId, int seconds) async {
    if (!isConfigured && _rpcInvoker == null) return false;
    final normalizedConversationId = conversationId.trim();
    if (normalizedConversationId.isEmpty) return false;
    try {
      await _rpc('set_disappearing_timer', {
        'p_conversation_id': normalizedConversationId,
        'p_seconds': seconds,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Returns the current user's starred message ids in [conversationId].
  ///
  /// `null` means the request failed or Supabase is unavailable; an empty set
  /// is a successful response with no stars.
  Future<Set<String>?> fetchStarredMessageIds(String conversationId) async {
    if (!isConfigured && _rpcInvoker == null) return null;
    final normalizedConversationId = conversationId.trim();
    if (normalizedConversationId.isEmpty) return null;
    try {
      final result = await _rpc('get_starred_message_ids', {
        'p_conversation_id': normalizedConversationId,
      });
      if (result is! List) return null;

      final messageIds = <String>{};
      for (final row in result) {
        final rawId = row is Map ? row['message_id'] : row;
        final id = rawId?.toString().trim();
        if (id != null && id.isNotEmpty) {
          messageIds.add(id);
        }
      }
      return messageIds;
    } catch (_) {
      return null;
    }
  }

  /// Toggles the current user's star for [messageId]. Returns true when the
  /// message is now starred, false when unstarred, and null on failure.
  Future<bool?> toggleStar(String messageId) async {
    if (!isConfigured && _rpcInvoker == null) return null;
    final normalizedMessageId = messageId.trim();
    if (normalizedMessageId.isEmpty) return null;
    try {
      final result = await _rpc('toggle_message_star', {
        'p_message_id': normalizedMessageId,
      });
      return result is bool ? result : null;
    } catch (_) {
      return null;
    }
  }

  /// Submits a participant-scoped moderation report for [messageId].
  ///
  /// The server derives the reported user from the message row and rejects
  /// self-reports, invalid reasons, and reports from non-participants.
  Future<bool> reportMessage({
    required String messageId,
    required String reason,
    String? description,
  }) async {
    if (!isConfigured && _rpcInvoker == null) return false;
    final normalizedMessageId = messageId.trim();
    final normalizedReason = reason.trim();
    if (normalizedMessageId.isEmpty || normalizedReason.isEmpty) return false;
    try {
      final result = await _rpc('report_message', {
        'p_message_id': normalizedMessageId,
        'p_reason': normalizedReason,
        'p_description': _trimmedOrNull(description),
      });
      if (result is bool) return result;
      return result?.toString().trim().isNotEmpty ?? false;
    } catch (_) {
      return false;
    }
  }
}

String? _trimmedOrNull(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}
