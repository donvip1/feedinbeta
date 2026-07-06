import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// A single reply typed into a message-notification's inline reply field.
class PendingReply {
  const PendingReply({required this.conversationId, required this.body});

  final String conversationId;
  final String body;

  Map<String, dynamic> toJson() => {
        'conversationId': conversationId,
        'body': body,
      };

  static PendingReply? fromJson(Map<String, dynamic> json) {
    final conversationId = json['conversationId']?.toString();
    final body = json['body']?.toString();
    if (conversationId == null || conversationId.isEmpty || body == null) {
      return null;
    }
    return PendingReply(conversationId: conversationId, body: body);
  }
}

/// Durable hand-off for notification replies that cross the isolate boundary.
///
/// When the user replies from a message notification while the app is
/// backgrounded or killed, the reply arrives in a separate notification-response
/// isolate that has no access to the widget tree, Hive, or the Supabase session.
/// Rather than bootstrap all of that in the second isolate, we persist the reply
/// text here (a plain `SharedPreferences` list) and [FeedShell] drains it through
/// the normal `queueMessage()` + `syncNow()` path the next time the app resumes —
/// which tapping the reply action does within moments anyway.
///
/// Storage is a JSON-encoded list under a single key so appends from the
/// background isolate and drains from the UI isolate never interleave partial
/// state. All methods are best-effort and never throw.
class PendingReplyStore {
  const PendingReplyStore();

  static const String _key = 'feedin.pending_notification_replies';

  /// Append a reply from any isolate. Safe to call from the background
  /// notification-response handler.
  Future<void> append(PendingReply reply) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Re-read inside the same call so we don't clobber a concurrent append.
      final existing = prefs.getStringList(_key) ?? <String>[];
      existing.add(jsonEncode(reply.toJson()));
      await prefs.setStringList(_key, existing);
    } catch (_) {
      // Best effort — a lost reply is preferable to a crash in a headless isolate.
    }
  }

  /// Return every queued reply and clear the store atomically-enough for our
  /// single-writer/single-drainer usage. Returns an empty list on any error.
  Future<List<PendingReply>> drain() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getStringList(_key) ?? const <String>[];
      if (raw.isEmpty) return const <PendingReply>[];
      await prefs.remove(_key);
      final result = <PendingReply>[];
      for (final entry in raw) {
        try {
          final decoded = jsonDecode(entry);
          if (decoded is Map<String, dynamic>) {
            final reply = PendingReply.fromJson(decoded);
            if (reply != null) result.add(reply);
          }
        } catch (_) {
          // Skip a corrupt entry rather than dropping the whole batch.
        }
      }
      return result;
    } catch (_) {
      return const <PendingReply>[];
    }
  }
}
