import 'package:feedin/src/features/p2p/data/p2p_models.dart';
import 'package:feedin/src/features/p2p/data/p2p_remote_data_source.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('P2PRemoteDataSource RPC mutations', () {
    test(
      'starts a transaction with an idempotency key and parses its row',
      () async {
        late _RpcCall call;
        final dataSource = P2PRemoteDataSource(
          isConfigured: false,
          idempotencyKeyFactory: () => 'idempotency-key',
          rpcInvoker: (functionName, parameters) async {
            call = _RpcCall(functionName, parameters);
            return [_transactionRow()];
          },
        );

        final transaction = await dataSource.initiatePurchase(_listing());

        expect(transaction, isNotNull);
        expect(transaction!.id, 'transaction-id');
        expect(transaction.escrowLocked, isTrue);
        expect(call.functionName, 'p2p_start_transaction');
        expect(call.parameters, {
          'p_listing_id': 'listing-id',
          'p_idempotency_key': 'idempotency-key',
        });
      },
    );

    test(
      'submits proof URL and notes and parses the updated transaction',
      () async {
        late _RpcCall call;
        final dataSource = P2PRemoteDataSource(
          isConfigured: false,
          rpcInvoker: (functionName, parameters) async {
            call = _RpcCall(functionName, parameters);
            return {'transaction': _transactionRow(status: 'proof_submitted')};
          },
        );

        final transaction = await dataSource.submitPaymentProof(
          transactionId: ' transaction-id ',
          proofUrl: ' https://proofs.example.com/receipt.jpg ',
          notes: ' bank reference 123 ',
        );

        expect(transaction.status, 'proof_submitted');
        expect(call.functionName, 'p2p_submit_payment_proof');
        expect(call.parameters, {
          'p_transaction_id': 'transaction-id',
          'p_proof_url': 'https://proofs.example.com/receipt.jpg',
          'p_notes': 'bank reference 123',
        });
      },
    );

    test('keeps markProofSubmitted callable without an attachment', () async {
      late _RpcCall call;
      final dataSource = P2PRemoteDataSource(
        isConfigured: false,
        rpcInvoker: (functionName, parameters) async {
          call = _RpcCall(functionName, parameters);
          return _transactionRow(status: 'proof_submitted');
        },
      );

      await dataSource.markProofSubmitted('transaction-id');

      expect(call.functionName, 'p2p_submit_payment_proof');
      expect(call.parameters, {
        'p_transaction_id': 'transaction-id',
        'p_proof_url': null,
        'p_notes': null,
      });
    });

    test('releases and cancels through their transaction RPCs', () async {
      final calls = <_RpcCall>[];
      final dataSource = P2PRemoteDataSource(
        isConfigured: false,
        rpcInvoker: (functionName, parameters) async {
          calls.add(_RpcCall(functionName, parameters));
          return _transactionRow(
            status: functionName == 'p2p_release_credits'
                ? 'completed'
                : 'cancelled',
            escrowLocked: false,
          );
        },
      );

      final released = await dataSource.releaseCredits(' transaction-id ');
      final cancelled = await dataSource.cancelTransactionWithResult(
        'transaction-id',
      );

      expect(released.status, 'completed');
      expect(cancelled.status, 'cancelled');
      expect(calls.map((call) => call.functionName), [
        'p2p_release_credits',
        'p2p_cancel_transaction',
      ]);
      expect(calls.map((call) => call.parameters), [
        {'p_transaction_id': 'transaction-id'},
        {'p_transaction_id': 'transaction-id'},
      ]);
    });

    test(
      'opens a dispute through the RPC and parses the dispute row',
      () async {
        late _RpcCall call;
        final dataSource = P2PRemoteDataSource(
          isConfigured: false,
          rpcInvoker: (functionName, parameters) async {
            call = _RpcCall(functionName, parameters);
            return [_disputeRow()];
          },
        );

        final dispute = await dataSource.openDispute(
          transactionId: ' transaction-id ',
          reason: ' wrong_amount ',
        );

        expect(dispute, isNotNull);
        expect(dispute!.id, 'dispute-id');
        expect(dispute.reason, 'wrong_amount');
        expect(call.functionName, 'p2p_open_dispute');
        expect(call.parameters, {
          'p_transaction_id': 'transaction-id',
          'p_reason': 'wrong_amount',
        });
      },
    );

    test('rejects malformed or missing RPC rows', () async {
      final emptyDataSource = P2PRemoteDataSource(
        isConfigured: false,
        rpcInvoker: (_, _) async => const [],
      );
      final incompleteDataSource = P2PRemoteDataSource(
        isConfigured: false,
        rpcInvoker: (_, _) async => {'id': 'transaction-id'},
      );

      expect(
        () => emptyDataSource.releaseCredits('transaction-id'),
        throwsA(
          isA<P2PBackendUnavailable>().having(
            (error) => error.message,
            'message',
            contains('returned 0 rows'),
          ),
        ),
      );
      expect(
        () => incompleteDataSource.cancelTransaction('transaction-id'),
        throwsA(
          isA<P2PBackendUnavailable>().having(
            (error) => error.message,
            'message',
            contains('server response was missing'),
          ),
        ),
      );
    });

    test('wraps transport failures without claiming a backend gap', () async {
      final dataSource = P2PRemoteDataSource(
        isConfigured: false,
        rpcInvoker: (_, _) async => throw StateError('network down'),
      );

      expect(
        () => dataSource.releaseCredits('transaction-id'),
        throwsA(
          isA<P2PBackendUnavailable>()
              .having(
                (error) => error.message,
                'message',
                'Could not release credits.',
              )
              .having((error) => error.cause, 'cause', isA<StateError>()),
        ),
      );
    });
  });
}

P2PListing _listing() {
  return const P2PListing(
    id: 'listing-id',
    sellerId: 'seller-id',
    creditsAmount: 500,
    priceCents: 250000,
    currency: 'NGN',
    status: 'active',
    createdAtMillis: 0,
  );
}

Map<String, Object?> _transactionRow({
  String status = 'pending',
  bool escrowLocked = true,
}) {
  return {
    'id': 'transaction-id',
    'listing_id': 'listing-id',
    'buyer_id': 'buyer-id',
    'seller_id': 'seller-id',
    'credits_amount': 500,
    'price_cents': 250000,
    'currency': 'NGN',
    'status': status,
    'escrow_locked': escrowLocked,
    'expires_at': '2026-07-15T13:00:00Z',
    'created_at': '2026-07-15T12:00:00Z',
  };
}

Map<String, Object?> _disputeRow() {
  return {
    'id': 'dispute-id',
    'transaction_id': 'transaction-id',
    'initiated_by': 'buyer-id',
    'moderator_id': null,
    'reason': 'wrong_amount',
    'status': 'open',
    'resolution': null,
    'created_at': '2026-07-15T12:30:00Z',
    'resolved_at': null,
  };
}

class _RpcCall {
  const _RpcCall(this.functionName, this.parameters);

  final String functionName;
  final Map<String, Object?> parameters;
}
