import 'dart:async';
import 'dart:math';

import 'package:postgrest/postgrest.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/local/canonical_message_store.dart';
import '../../data/remote/canonical_messages_remote_data_source.dart';
import '../../features/messages/canonical_message.dart';
import '../connectivity/connectivity_service.dart';

class IncrementalMessageSyncService {
  IncrementalMessageSyncService({
    required CanonicalMessageStore store,
    required CanonicalMessagesRemoteGateway remote,
    required ConnectivityService connectivity,
    DateTime Function()? now,
  }) : _store = store,
       _remote = remote,
       _connectivity = connectivity,
       _now = now ?? DateTime.now;

  final CanonicalMessageStore _store;
  final CanonicalMessagesRemoteGateway _remote;
  final ConnectivityService _connectivity;
  final DateTime Function() _now;

  StreamSubscription<bool>? _connectivitySubscription;
  String? _userId;
  bool _runningOutbox = false;
  bool _reconciling = false;
  bool _disposed = false;

  Stream<CanonicalMessageStoreChange> get changes => _store.changes;

  Future<void> start(String userId) async {
    if (_disposed || userId.isEmpty) return;
    if (_userId == userId) {
      await reconcile();
      await drainOutbox();
      return;
    }

    await stop();
    _userId = userId;
    _connectivitySubscription = _connectivity.onStatusChange.listen((online) {
      if (!online) return;
      unawaited(reconcile());
      unawaited(drainOutbox());
    });

    // Subscribe before catch-up so events arriving during reconciliation are
    // either applied live or observed by the revision cursor.
    await _remote.subscribe(userId, _handleRealtimeChange);
    await _connectivity.refresh();
    if (_connectivity.isOnline) {
      await reconcile();
      await drainOutbox();
    }
  }

  Future<void> stop() async {
    _userId = null;
    await _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
    await _remote.disconnect();
  }

  Future<void> enqueue(
    CanonicalMessage message, {
    String? localAssetPath,
  }) async {
    if (_disposed) throw StateError('Incremental message sync is disposed.');
    await _store.enqueue(message, localAssetPath: localAssetPath);
    if (_connectivity.isOnline) unawaited(drainOutbox());
  }

  Future<List<LocalCanonicalMessage>> loadConversation(
    String conversationId, {
    int limit = 50,
    DateTime? before,
  }) {
    return _store.loadConversation(
      conversationId,
      limit: limit,
      before: before,
    );
  }

  Future<List<LocalCanonicalMessage>> syncConversationPage(
    String conversationId, {
    int limit = 50,
    DateTime? beforeCreatedAt,
    String? beforeId,
  }) async {
    if (_connectivity.isOnline && _userId != null) {
      final page = await _remote.fetchConversationPage(
        conversationId,
        beforeCreatedAt: beforeCreatedAt,
        beforeId: beforeId,
        limit: limit,
      );
      for (final message in page) {
        await _applyRemoteAndAdvanceCursor(message);
      }
    }
    return loadConversation(
      conversationId,
      limit: limit,
      before: beforeCreatedAt,
    );
  }

  Future<void> _handleRealtimeChange(
    CanonicalMessageRealtimeChange change,
  ) async {
    if (_disposed || _userId == null) return;
    if (change.kind == PostgresChangeEvent.delete) {
      await _store.remove(
        change.messageId,
        conversationId: change.conversationId,
      );
      return;
    }

    try {
      final message = await _remote.fetchMessage(change.messageId);
      if (message == null) return;
      await _applyRemoteAndAdvanceCursor(message);
    } catch (_) {
      // Reconciliation is the durable fallback for a missed realtime fetch.
    }
  }

  Future<void> reconcile() async {
    final userId = _userId;
    if (_disposed ||
        userId == null ||
        _reconciling ||
        !_connectivity.isOnline) {
      return;
    }
    _reconciling = true;
    try {
      final storedCursor = await _store.loadCursor(userId);
      // Existing history is paged per conversation when that thread opens. The
      // global cursor only needs a small overlap around the first V2 startup.
      var cursor =
          storedCursor ??
          MessageSyncCursor(
            updatedAt: _now().toUtc().subtract(const Duration(minutes: 5)),
            messageId: '00000000-0000-0000-0000-000000000000',
          );

      const pageSize = 100;
      while (_userId == userId && _connectivity.isOnline) {
        final page = await _remote.fetchChanged(
          after: MessageRemoteCursor(
            updatedAt: cursor.updatedAt,
            messageId: cursor.messageId,
          ),
          limit: pageSize,
        );
        if (page.isEmpty) {
          await _store.saveCursor(userId, cursor);
          break;
        }

        for (final message in page) {
          await _store.applyRemote(message);
          cursor = MessageSyncCursor(
            updatedAt: message.updatedAt,
            messageId: message.id,
          );
          await _store.saveCursor(userId, cursor);
        }
        if (page.length < pageSize) break;
      }
    } finally {
      _reconciling = false;
    }
  }

  Future<void> drainOutbox() async {
    if (_disposed ||
        _userId == null ||
        _runningOutbox ||
        !_connectivity.isOnline) {
      return;
    }
    _runningOutbox = true;
    try {
      final due = await _store.dueOutbox(_now().toUtc());
      for (final record in due) {
        if (!_connectivity.isOnline || _userId == null) break;
        await _sendOutboxRecord(record);
      }
    } finally {
      _runningOutbox = false;
    }
  }

  Future<void> retry(String messageId) async {
    await _store.markOutboxState(
      messageId,
      MessageSyncState.pending,
      attemptCount: 0,
    );
    await drainOutbox();
  }

  Future<void> _sendOutboxRecord(LocalCanonicalMessage record) async {
    final message = record.message;
    await _store.markOutboxState(
      message.id,
      MessageSyncState.syncing,
      attemptCount: record.attemptCount,
    );

    try {
      final localAssetPath = record.localAssetPath;
      if (localAssetPath != null && localAssetPath.isNotEmpty) {
        await _remote.uploadMedia(message, localAssetPath);
      }
      final sent = await _remote.send(message);
      await _store.applyRemote(sent);
      await _advanceCursor(sent);
    } catch (error) {
      final attempts = record.attemptCount + 1;
      final permanent = _isPermanent(error);
      final backoffSeconds = min(900, pow(2, min(attempts, 9)).toInt());
      await _store.markOutboxState(
        message.id,
        permanent ? MessageSyncState.failed : MessageSyncState.pending,
        attemptCount: attempts,
        nextAttemptAt: permanent
            ? null
            : _now().toUtc().add(Duration(seconds: backoffSeconds)),
        errorCode: _errorCode(error),
      );
    }
  }

  Future<void> _applyRemoteAndAdvanceCursor(CanonicalMessage message) async {
    await _store.applyRemote(message);
    await _advanceCursor(message);
  }

  Future<void> _advanceCursor(CanonicalMessage message) async {
    final userId = _userId;
    if (userId == null) return;
    final current = await _store.loadCursor(userId);
    final isNewer =
        current == null ||
        message.updatedAt.isAfter(current.updatedAt) ||
        (message.updatedAt.isAtSameMomentAs(current.updatedAt) &&
            message.id.compareTo(current.messageId) > 0);
    if (!isNewer) return;
    await _store.saveCursor(
      userId,
      MessageSyncCursor(updatedAt: message.updatedAt, messageId: message.id),
    );
  }

  bool _isPermanent(Object error) {
    final code = _errorCode(error);
    return const {
      'INVALID_SENDER',
      'INVALID_CONTENT_TYPE',
      'SERVER_OWNED_CONTENT_TYPE',
      'NOT_AUTHORIZED',
      'EMPTY_MESSAGE',
      'INVALID_MEDIA_PAYLOAD',
      'INVALID_REPLY_TARGET',
      'MESSAGE_ID_CONFLICT',
    }.contains(code);
  }

  String _errorCode(Object error) {
    if (error is PostgrestException) return error.message.trim();
    return error.runtimeType.toString();
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await stop();
    await _store.dispose();
  }
}
