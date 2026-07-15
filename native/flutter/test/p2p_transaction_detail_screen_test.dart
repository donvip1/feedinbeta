import 'package:feedin/src/features/p2p/data/p2p_models.dart';
import 'package:feedin/src/features/p2p/data/p2p_remote_data_source.dart';
import 'package:feedin/src/features/p2p/screens/p2p_transaction_detail_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('seller can explicitly release credits after proof submission', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(800, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    late String functionName;
    late Map<String, Object?> parameters;
    final dataSource = P2PRemoteDataSource(
      isConfigured: false,
      rpcInvoker: (name, params) async {
        functionName = name;
        parameters = params;
        return _transactionRow(status: 'completed', escrowLocked: false);
      },
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: P2PTransactionDetailScreen(
            dataSource: dataSource,
            transaction: P2PTransaction.fromJson(
              _transactionRow(status: 'proof_submitted'),
            ),
            currentUserId: 'seller-id',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final releaseButton = find.text('Release credits').first;
    await tester.ensureVisible(releaseButton);
    await tester.tap(releaseButton);
    await tester.pumpAndSettle();

    expect(find.text('Release credits'), findsAtLeastNWidgets(2));
    await tester.tap(find.text('Release credits').last);
    await tester.pumpAndSettle();

    expect(functionName, 'p2p_release_credits');
    expect(parameters, {'p_transaction_id': 'transaction-id'});
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Credits released to the buyer.'), findsOneWidget);
  });
}

Map<String, Object?> _transactionRow({
  required String status,
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
