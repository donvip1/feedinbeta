import 'dart:async';

import 'package:hive_ce/hive.dart';

import '../../features/messages/canonical_message.dart';

class CanonicalMessageStore {
  CanonicalMessageStore({
    required Box<Map> messagesBox,
    required Box<Map> outboxBox,
    required Box<Map> cursorsBox,
  }) : _messagesBox = messagesBox,
       _outboxBox = outboxBox,
       _cursorsBox = cursorsBox;

  final Box<Map> _messagesBox;
  final Box<Map> _outboxBox;
  final Box<Map> _cursorsBox;
  final _changes = StreamController<CanonicalMessageStoreChange>.broadcast();

  Stream<CanonicalMessageStoreChange> get changes => _changes.stream;

  Future<LocalCanonicalMessage?> load(String messageId) async {
    return _decode(_messagesBox.get(messageId));
  }

  Future<List<LocalCanonicalMessage>> loadConversation(
    String conversationId, {
    int limit = 50,
    DateTime? before,
  }) async {
    final messages =
        _messagesBox.values
            .map(_decode)
            .whereType<LocalCanonicalMessage>()
            .where(
              (record) =>
                  record.message.conversationId == conversationId &&
                  (before == null || record.message.createdAt.isBefore(before)),
            )
            .toList()
          ..sort((a, b) => b.message.createdAt.compareTo(a.message.createdAt));
    return messages.take(limit).toList(growable: false).reversed.toList();
  }

  Future<void> enqueue(
    CanonicalMessage message, {
    String? localAssetPath,
  }) async {
    final record = LocalCanonicalMessage(
      message: message.copyWith(status: CanonicalMessageStatus.sending),
      syncState: MessageSyncState.pending,
      localAssetPath: localAssetPath,
    );
    await _messagesBox.put(message.id, record.toJson());
    await _outboxBox.put(message.id, record.toJson());
    _emit(message, CanonicalMessageStoreChangeKind.upserted);
  }

  Future<bool> applyRemote(CanonicalMessage message) async {
    final current = _decode(_messagesBox.get(message.id));
    if (current != null && current.message.revision > message.revision) {
      return false;
    }
    if (current != null &&
        current.message.revision == message.revision &&
        !message.updatedAt.isAfter(current.message.updatedAt) &&
        current.syncState == MessageSyncState.synced) {
      return false;
    }

    final record = LocalCanonicalMessage(
      message: message,
      syncState: MessageSyncState.synced,
    );
    await _messagesBox.put(message.id, record.toJson());
    await _outboxBox.delete(message.id);
    _emit(message, CanonicalMessageStoreChangeKind.upserted);
    return true;
  }

  Future<void> remove(String messageId, {String? conversationId}) async {
    await _messagesBox.delete(messageId);
    await _outboxBox.delete(messageId);
    if (!_changes.isClosed) {
      _changes.add(
        CanonicalMessageStoreChange(
          kind: CanonicalMessageStoreChangeKind.removed,
          messageId: messageId,
          conversationId: conversationId,
        ),
      );
    }
  }

  Future<List<LocalCanonicalMessage>> dueOutbox(DateTime now) async {
    final records =
        _outboxBox.values
            .map(_decode)
            .whereType<LocalCanonicalMessage>()
            .where(
              (record) =>
                  record.syncState != MessageSyncState.synced &&
                  (record.nextAttemptAt == null ||
                      !record.nextAttemptAt!.isAfter(now)),
            )
            .toList()
          ..sort((a, b) => a.message.createdAt.compareTo(b.message.createdAt));
    return records;
  }

  Future<void> markOutboxState(
    String messageId,
    MessageSyncState state, {
    int? attemptCount,
    DateTime? nextAttemptAt,
    String? errorCode,
    CanonicalMessage? message,
    bool clearLocalAssetPath = false,
  }) async {
    final current = _decode(_outboxBox.get(messageId));
    if (current == null) return;
    final updated = current.copyWith(
      message: message,
      syncState: state,
      attemptCount: attemptCount,
      nextAttemptAt: nextAttemptAt,
      clearNextAttemptAt: nextAttemptAt == null,
      lastErrorCode: errorCode,
      clearLastErrorCode: errorCode == null,
      clearLocalAssetPath: clearLocalAssetPath,
    );
    await _outboxBox.put(messageId, updated.toJson());
    await _messagesBox.put(messageId, updated.toJson());
    _emit(updated.message, CanonicalMessageStoreChangeKind.upserted);
  }

  Future<MessageSyncCursor?> loadCursor(String userId) async {
    final raw = _cursorsBox.get(userId);
    if (raw == null) return null;
    return MessageSyncCursor.fromJson(Map<String, Object?>.from(raw));
  }

  Future<void> saveCursor(String userId, MessageSyncCursor cursor) async {
    await _cursorsBox.put(userId, cursor.toJson());
  }

  Future<void> dispose() async {
    if (!_changes.isClosed) await _changes.close();
  }

  LocalCanonicalMessage? _decode(Map<dynamic, dynamic>? raw) {
    if (raw == null) return null;
    try {
      return LocalCanonicalMessage.fromJson(Map<String, Object?>.from(raw));
    } catch (_) {
      return null;
    }
  }

  void _emit(CanonicalMessage message, CanonicalMessageStoreChangeKind kind) {
    if (_changes.isClosed) return;
    _changes.add(
      CanonicalMessageStoreChange(
        kind: kind,
        messageId: message.id,
        conversationId: message.conversationId,
        message: message,
      ),
    );
  }
}

enum CanonicalMessageStoreChangeKind { upserted, removed }

class CanonicalMessageStoreChange {
  const CanonicalMessageStoreChange({
    required this.kind,
    required this.messageId,
    this.conversationId,
    this.message,
  });

  final CanonicalMessageStoreChangeKind kind;
  final String messageId;
  final String? conversationId;
  final CanonicalMessage? message;
}

class MessageSyncCursor {
  const MessageSyncCursor({required this.updatedAt, required this.messageId});

  final DateTime updatedAt;
  final String messageId;

  factory MessageSyncCursor.fromJson(Map<String, Object?> json) {
    return MessageSyncCursor(
      updatedAt: DateTime.parse(json['updated_at'].toString()).toUtc(),
      messageId: json['message_id'].toString(),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'updated_at': updatedAt.toUtc().toIso8601String(),
      'message_id': messageId,
    };
  }
}
