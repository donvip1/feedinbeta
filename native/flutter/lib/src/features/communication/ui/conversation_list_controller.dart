import 'package:flutter/foundation.dart';

import '../data/conversation_store.dart';
import '../domain/conversation.dart';

/// State holder for the new Chats inbox (business logic stays out of widgets).
///
/// Reads the unified [ConversationStore] and optionally runs an injected
/// [backfill] (server refresh) before each load. Backfill failures are
/// swallowed by design — a stale inbox beats an empty one.
class ConversationListController extends ChangeNotifier {
  ConversationListController({
    required ConversationStore store,
    Future<int> Function()? backfill,
  }) : _store = store,
       _backfill = backfill;

  final ConversationStore _store;
  final Future<int> Function()? _backfill;

  List<Conversation> _conversations = const [];
  List<Conversation> get conversations => _conversations;

  bool _loading = true;
  bool get loading => _loading;

  bool _disposed = false;

  Future<void> init() => refresh();

  Future<void> refresh() async {
    if (_disposed) return;
    _loading = _conversations.isEmpty;
    _notify();
    try {
      try {
        await _backfill?.call();
      } catch (_) {
        // Offline / server hiccup: fall through to the local inbox.
      }
      final items = await _store.inbox(
        types: const [ConversationType.dm, ConversationType.group],
      );
      if (_disposed) return;
      _conversations = items;
    } finally {
      if (!_disposed) {
        _loading = false;
        _notify();
      }
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
