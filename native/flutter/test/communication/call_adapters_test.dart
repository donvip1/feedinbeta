import 'package:feedin/src/features/communication/data/communication_database.dart';
import 'package:feedin/src/features/communication/data/conversation_store.dart';
import 'package:feedin/src/features/communication/domain/call_session.dart';
import 'package:feedin/src/features/communication/domain/conversation.dart';
import 'package:feedin/src/features/communication/domain/result.dart';
import 'package:feedin/src/features/communication/services/call/call_policy_service.dart';
import 'package:feedin/src/features/communication/services/call/call_wire_codec.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();

  group('CallWireCodec', () {
    Map<String, Object?> row({
      String status = 'pending',
      String callType = 'voice',
    }) => {
      'id': 'call-1',
      'caller_id': 'alice',
      'receiver_id': 'bob',
      'call_type': callType,
      'status': status,
      'created_at': '2026-07-26T10:00:00.000Z',
    };

    test('room name matches the token contract', () {
      expect(CallWireCodec.roomName('abc'), 'call-abc');
    });

    test('sessionFromRow maps status/mode/participants', () {
      final session = CallWireCodec.sessionFromRow(
        row(status: 'answered', callType: 'video'),
        selfUserId: 'bob',
      );
      expect(session.state, CallLifecycleState.connected);
      expect(session.mode, CallMode.video);
      expect(session.participants.map((p) => p.userId), ['alice', 'bob']);
    });

    test('insertRowFor writes the pending wire row', () {
      final wire = CallWireCodec.insertRowFor(
        const CallSession(
          id: 'x',
          conversationId: 'c',
          mode: CallMode.video,
          callerId: 'alice',
        ),
        receiverId: 'bob',
      );
      expect(wire['status'], 'pending');
      expect(wire['call_type'], 'video');
      expect(wire['caller_id'], 'alice');
      expect(wire['receiver_id'], 'bob');
    });

    group('signalFor derivation table', () {
      test('callee + INSERT(pending) -> incoming; caller INSERT -> null', () {
        expect(
          CallWireCodec.signalFor(row: row(), selfUserId: 'bob', isInsert: true),
          CallSignalKindWire.incoming,
        );
        expect(
          CallWireCodec.signalFor(
            row: row(),
            selfUserId: 'alice',
            isInsert: true,
          ),
          isNull,
        );
      });

      test('caller sees accepted/rejected; callee does not (self-originated)', () {
        expect(
          CallWireCodec.signalFor(
            row: row(status: 'answered'),
            selfUserId: 'alice',
            isInsert: false,
          ),
          CallSignalKindWire.accepted,
        );
        expect(
          CallWireCodec.signalFor(
            row: row(status: 'answered'),
            selfUserId: 'bob',
            isInsert: false,
          ),
          isNull,
        );
        expect(
          CallWireCodec.signalFor(
            row: row(status: 'rejected'),
            selfUserId: 'alice',
            isInsert: false,
          ),
          CallSignalKindWire.rejected,
        );
      });

      test('callee sees caller-cancel as cancelled (missed status)', () {
        expect(
          CallWireCodec.signalFor(
            row: row(status: 'missed'),
            selfUserId: 'bob',
            isInsert: false,
          ),
          CallSignalKindWire.cancelled,
        );
        // The caller wrote missed themselves — no echo signal.
        expect(
          CallWireCodec.signalFor(
            row: row(status: 'missed'),
            selfUserId: 'alice',
            isInsert: false,
          ),
          isNull,
        );
      });

      test('ended reaches both sides; strangers get nothing', () {
        for (final self in ['alice', 'bob']) {
          expect(
            CallWireCodec.signalFor(
              row: row(status: 'ended'),
              selfUserId: self,
              isInsert: false,
            ),
            CallSignalKindWire.ended,
          );
        }
        expect(
          CallWireCodec.signalFor(
            row: row(status: 'ended'),
            selfUserId: 'mallory',
            isInsert: false,
          ),
          isNull,
        );
      });
    });
  });

  group('CallPolicyService', () {
    late CommunicationDatabase db;
    late ConversationStore store;
    late CallPolicyService policy;
    var nextId = 0;

    setUp(() async {
      nextId = 0;
      db = await CommunicationDatabase.open(
        databaseFactoryFfi,
        inMemoryDatabasePath,
      );
      store = ConversationStore(db);
      policy = CallPolicyService(
        conversations: store,
        newCallId: () => 'call-${nextId++}',
      );
    });

    tearDown(() => db.close());

    test('dm draft: voice/video modes, both members in the roster', () async {
      await store.upsert(const Conversation(
        id: 'dm-1',
        type: ConversationType.dm,
        memberIds: ['me', 'you'],
      ));
      final voice = await policy.draftCall(
        conversationId: 'dm-1', callerId: 'me', video: false);
      expect(voice.valueOrNull!.mode, CallMode.voice);
      expect(voice.valueOrNull!.participants.length, 2);

      final video = await policy.draftCall(
        conversationId: 'dm-1', callerId: 'me', video: true);
      expect(video.valueOrNull!.mode, CallMode.video);
    });

    test('group draft derives groupVoice/groupVideo with the full roster', () async {
      await store.upsert(const Conversation(
        id: 'g-1',
        type: ConversationType.group,
        memberIds: ['me', 'a', 'b', 'c'],
        policy: ConversationPolicy.groupDefault,
      ));
      final draft = await policy.draftCall(
        conversationId: 'g-1', callerId: 'me', video: true);
      expect(draft.valueOrNull!.mode, CallMode.groupVideo);
      expect(draft.valueOrNull!.participants.length, 4);
      expect(draft.valueOrNull!.isGroup, isTrue);
    });

    test('broadcast: subscriber cannot start; owner starts a space/broadcast', () async {
      await store.upsert(const Conversation(
        id: 'bc-1',
        type: ConversationType.broadcast,
        memberIds: ['owner', 'sub'],
        roles: {'owner': MemberRole.owner, 'sub': MemberRole.subscriber},
        policy: ConversationPolicy.broadcastDefault,
      ));
      final denied = await policy.draftCall(
        conversationId: 'bc-1', callerId: 'sub', video: false);
      expect(denied.errorOrNull!.kind, CommErrorKind.permission);

      final space = await policy.draftCall(
        conversationId: 'bc-1', callerId: 'owner', video: false);
      expect(space.valueOrNull!.mode, CallMode.space);
      final broadcast = await policy.draftCall(
        conversationId: 'bc-1', callerId: 'owner', video: true);
      expect(broadcast.valueOrNull!.mode, CallMode.broadcast);
    });

    test('participant cap enforced', () async {
      await store.upsert(Conversation(
        id: 'big',
        type: ConversationType.group,
        memberIds: List.generate(10, (i) => 'u$i'),
        policy: const ConversationPolicy(maxCallParticipants: 8),
      ));
      final denied = await policy.draftCall(
        conversationId: 'big', callerId: 'u0', video: false);
      expect(denied.errorOrNull!.kind, CommErrorKind.validation);
    });

    test('non-member and unknown conversation refused', () async {
      await store.upsert(const Conversation(
        id: 'dm-1',
        type: ConversationType.dm,
        memberIds: ['me', 'you'],
      ));
      expect(
        (await policy.draftCall(
          conversationId: 'dm-1', callerId: 'stranger', video: false))
            .errorOrNull!
            .kind,
        CommErrorKind.permission,
      );
      expect(
        (await policy.draftCall(
          conversationId: 'nope', callerId: 'me', video: false))
            .errorOrNull!
            .kind,
        CommErrorKind.notFound,
      );
    });
  });
}
