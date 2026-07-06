import 'package:supabase_flutter/supabase_flutter.dart';

/// Remote actions on an individual message: react (toggle emoji) and soft-delete.
/// Backed by the `toggle_message_reaction` / `delete_message` RPCs
/// (migration 20260703030000), which enforce participant/author checks
/// server-side. Auto-detects the Supabase singleton and no-ops gracefully when
/// unconfigured so the chat UI still works offline.
///
/// These operate on the SERVER message id, which for materialized messages is
/// `LocalMessage.id` (see message_materializer.dart). Locally-queued messages
/// that haven't synced yet have no server row, so actions return a soft failure.
class MessageInteractionsDataSource {
  const MessageInteractionsDataSource({required this.isConfigured});

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

  SupabaseClient? get _client {
    if (!isConfigured) return null;
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  /// Toggles [emoji] on [messageId] for the current user. Returns whether the
  /// reaction is now present (true) or was removed (false); null on failure.
  Future<bool?> toggleReaction(String messageId, String emoji) async {
    final client = _client;
    if (client == null) return null;
    try {
      final result = await client.rpc<dynamic>(
        'toggle_message_reaction',
        params: {'p_message_id': messageId, 'p_emoji': emoji},
      );
      return result == true;
    } catch (_) {
      return null;
    }
  }

  /// Soft-deletes [messageId] (author only, enforced server-side). Returns true
  /// on success.
  Future<bool> deleteMessage(String messageId) async {
    final client = _client;
    if (client == null) return false;
    try {
      await client.rpc<dynamic>(
        'delete_message',
        params: {'p_message_id': messageId},
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Marks a view-once [messageId] as seen (recipient only, enforced
  /// server-side): stamps `view_once_seen_at` and blanks the payload so it can
  /// never be re-fetched. Returns true on success.
  Future<bool> markViewOnceSeen(String messageId) async {
    final client = _client;
    if (client == null) return false;
    try {
      await client.rpc<dynamic>(
        'mark_view_once_seen',
        params: {'p_message_id': messageId},
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Sets the per-conversation disappearing-message timer ([seconds]; 0 = off),
  /// participant-only. Returns true on success.
  Future<bool> setDisappearingTimer(String conversationId, int seconds) async {
    final client = _client;
    if (client == null) return false;
    try {
      await client.rpc<dynamic>(
        'set_disappearing_timer',
        params: {
          'p_conversation_id': conversationId,
          'p_seconds': seconds,
        },
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
