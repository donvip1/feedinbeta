import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_ce/hive.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:feedin/src/core/connectivity/connectivity_service.dart';
import 'package:feedin/src/core/sync/incremental_message_sync_service.dart';
import 'package:feedin/src/data/local/canonical_message_store.dart';
import 'package:feedin/src/data/remote/canonical_messages_remote_data_source.dart';
import 'package:feedin/src/features/messages/canonical_message.dart';

void main() {
  late Directory directory;
  late Box<Map> messages;
  late Box<Map> outbox;
  late Box<Map> cursors;
  late _FakeRemote remote;
  late IncrementalMessageSyncService service;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('feedin-message-v2-');
    Hive.init(directory.path);
    messages = await Hive.openBox<Map>('messages');
    outbox = await Hive.openBox<Map>('outbox');
    cursors = await Hive.openBox<Map>('cursors');
    remote = _FakeRemote();
    service = IncrementalMessageSyncService(
      store: CanonicalMessageStore(
        messagesBox: messages,
        outboxBox: outbox,
        cursorsBox: cursors,
      ),
      remote: remote,
      connectivity: ConnectivityService(isEnabled: false),
      now: () => DateTime.utc(2026, 7, 16, 12),
    );
  });

  tearDown(() async {
    await service.dispose();
    await Hive.close();
    await directory.delete(recursive: true);
  });

  test(
    'durable outbox sends one idempotent canonical message on start',
    () async {
      final pending = _message(status: CanonicalMessageStatus.sending);
      await service.enqueue(pending);

      expect(outbox.length, 1);
      expect(remote.sent, isEmpty);

      await service.start(pending.senderId);

      expect(remote.sent.map((message) => message.id), [pending.id]);
      expect(outbox, isEmpty);
      final local = await service.loadConversation(pending.conversationId);
      expect(local.single.syncState, MessageSyncState.synced);
      expect(local.single.message.status, CanonicalMessageStatus.sent);
    },
  );

  test('realtime updates materialize only the changed message id', () async {
    final incoming = _message(
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      senderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      revision: 4,
    );
    remote.messages[incoming.id] = incoming;
    await service.start('33333333-3333-4333-8333-333333333333');

    remote.emit(
      CanonicalMessageRealtimeChange(
        kind: PostgresChangeEvent.update,
        messageId: incoming.id,
        conversationId: incoming.conversationId,
        revision: incoming.revision,
      ),
    );
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(remote.fetchedIds, [incoming.id]);
    final local = await service.loadConversation(incoming.conversationId);
    expect(local.single.message.revision, 4);
  });
}

CanonicalMessage _message({
  String id = '11111111-1111-4111-8111-111111111111',
  String senderId = '33333333-3333-4333-8333-333333333333',
  CanonicalMessageStatus status = CanonicalMessageStatus.sent,
  int revision = 1,
}) {
  final timestamp = DateTime.utc(2026, 7, 16, 12);
  return CanonicalMessage(
    id: id,
    conversationId: '22222222-2222-4222-8222-222222222222',
    senderId: senderId,
    contentType: CanonicalMessageContentType.text,
    payload: const {'text': 'Incremental message'},
    status: status,
    metadata: {
      'schema_version': 1,
      'revision': revision,
      'reactions': <Object?>[],
      'pin': <String, Object?>{
        'is_pinned': false,
        'pinned_by': null,
        'pinned_at': null,
      },
      'is_starred_by_me': false,
      'forwarded': <String, Object?>{
        'original_message_id': null,
        'original_sender_id': null,
        'original_sender_name': null,
        'original_created_at': null,
      },
      'receipts': <String, Object?>{
        'delivered_count': 0,
        'read_count': 0,
        'read_by_me_at': null,
      },
      'ephemeral': <String, Object?>{
        'view_once': false,
        'viewed_at': null,
        'expires_at': null,
      },
      'edited_at': null,
      'deleted_at': null,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  );
}

class _FakeRemote implements CanonicalMessagesRemoteGateway {
  final messages = <String, CanonicalMessage>{};
  final sent = <CanonicalMessage>[];
  final fetchedIds = <String>[];
  void Function(CanonicalMessageRealtimeChange change)? _listener;

  void emit(CanonicalMessageRealtimeChange change) => _listener?.call(change);

  @override
  Future<void> disconnect() async {
    _listener = null;
  }

  @override
  Future<List<CanonicalMessage>> fetchChanged({
    MessageRemoteCursor? after,
    int limit = 100,
  }) async {
    return const [];
  }

  @override
  Future<List<CanonicalMessage>> fetchConversationPage(
    String conversationId, {
    DateTime? beforeCreatedAt,
    String? beforeId,
    int limit = 50,
  }) async {
    return const [];
  }

  @override
  Future<CanonicalMessage?> fetchMessage(String messageId) async {
    fetchedIds.add(messageId);
    return messages[messageId];
  }

  @override
  Future<CanonicalMessage> send(CanonicalMessage message) async {
    sent.add(message);
    return message.copyWith(status: CanonicalMessageStatus.sent);
  }

  @override
  Future<void> subscribe(
    String userId,
    void Function(CanonicalMessageRealtimeChange change) onChange,
  ) async {
    _listener = onChange;
  }

  @override
  Future<void> uploadMedia(CanonicalMessage message, String localPath) async {}
}
