import 'package:feedin/src/features/messages/chat/message_interactions_data_source.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MessageInteractionsDataSource', () {
    test('loads starred message ids from RPC rows', () async {
      final calls = <_RpcCall>[];
      final dataSource = MessageInteractionsDataSource(
        isConfigured: false,
        rpcInvoker: (functionName, parameters) async {
          calls.add(_RpcCall(functionName, parameters));
          return [
            {'message_id': 'message-1'},
            {'message_id': 'message-2'},
            {'message_id': 'message-1'},
            {'message_id': ''},
          ];
        },
      );

      final result = await dataSource.fetchStarredMessageIds(
        ' conversation-1 ',
      );

      expect(result, {'message-1', 'message-2'});
      expect(calls, hasLength(1));
      expect(calls.single.functionName, 'get_starred_message_ids');
      expect(calls.single.parameters, {'p_conversation_id': 'conversation-1'});
    });

    test('treats malformed starred response as a failure', () async {
      final dataSource = MessageInteractionsDataSource(
        isConfigured: false,
        rpcInvoker: (_, _) async => {'message_id': 'message-1'},
      );

      expect(await dataSource.fetchStarredMessageIds('conversation-1'), isNull);
    });

    test('toggles a star and trims the message id', () async {
      late _RpcCall call;
      final dataSource = MessageInteractionsDataSource(
        isConfigured: false,
        rpcInvoker: (functionName, parameters) async {
          call = _RpcCall(functionName, parameters);
          return true;
        },
      );

      expect(await dataSource.toggleStar(' message-1 '), isTrue);
      expect(call.functionName, 'toggle_message_star');
      expect(call.parameters, {'p_message_id': 'message-1'});
    });

    test('submits a trimmed report payload', () async {
      late _RpcCall call;
      final dataSource = MessageInteractionsDataSource(
        isConfigured: false,
        rpcInvoker: (functionName, parameters) async {
          call = _RpcCall(functionName, parameters);
          return 'report-id';
        },
      );

      final result = await dataSource.reportMessage(
        messageId: ' message-1 ',
        reason: ' spam ',
        description: '  repeated unsolicited links  ',
      );

      expect(result, isTrue);
      expect(call.functionName, 'report_message');
      expect(call.parameters, {
        'p_message_id': 'message-1',
        'p_reason': 'spam',
        'p_description': 'repeated unsolicited links',
      });
    });

    test('returns soft failures when RPCs throw', () async {
      final dataSource = MessageInteractionsDataSource(
        isConfigured: false,
        rpcInvoker: (_, _) async => throw StateError('network down'),
      );

      expect(await dataSource.toggleStar('message-1'), isNull);
      expect(await dataSource.fetchStarredMessageIds('conversation-1'), isNull);
      expect(
        await dataSource.reportMessage(messageId: 'message-1', reason: 'spam'),
        isFalse,
      );
    });

    test('does not invoke RPCs for blank identifiers', () async {
      var calls = 0;
      final dataSource = MessageInteractionsDataSource(
        isConfigured: false,
        rpcInvoker: (_, _) async {
          calls += 1;
          return true;
        },
      );

      expect(await dataSource.toggleStar(' '), isNull);
      expect(await dataSource.fetchStarredMessageIds(' '), isNull);
      expect(
        await dataSource.reportMessage(messageId: '', reason: 'spam'),
        isFalse,
      );
      expect(calls, 0);
    });
  });
}

class _RpcCall {
  const _RpcCall(this.functionName, this.parameters);

  final String functionName;
  final Map<String, Object?> parameters;
}
