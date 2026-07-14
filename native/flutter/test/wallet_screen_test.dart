import 'package:feedin/src/features/wallet/data/wallet_models.dart';
import 'package:feedin/src/features/wallet/wallet_presenter.dart';
import 'package:feedin/src/features/wallet/wallet_screen.dart';
import 'package:feedin/src/features/wallet/wallet_theme.dart';
import 'package:feedin/src/features/wallet/widgets/payout_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'wallet_test_fakes.dart';

void main() {
  testWidgets('verifies hosted checkout when the app resumes', (tester) async {
    final data = FakeWalletDataSource()
      ..packages = const [
        CreditPackage(
          id: 'package-id',
          name: 'Starter',
          credits: 100,
          bonusCredits: 0,
          priceCents: 100,
          currency: 'USD',
        ),
      ]
      ..creditCheckout = fakeCheckoutSession(
        kind: WalletCheckoutKind.credits,
        itemId: 'package-id',
      )
      ..verification = const WalletCheckoutVerification(
        paymentIntentId: 'intent-id',
        status: 'completed',
        alreadyProcessed: false,
        purchaseKind: WalletCheckoutKind.credits,
        balanceAfter: 100,
      );
    final presenter = WalletPresenter(
      dataSource: data,
      checkoutRefreshDelays: const [Duration.zero],
    );
    Uri? launchedUri;

    await tester.pumpWidget(
      MaterialApp(
        home: WalletScreen(
          presenter: presenter,
          checkoutLauncher: (uri) async {
            launchedUri = uri;
            return true;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Buy Now'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Buy Now'));
    await tester.pumpAndSettle();

    expect(launchedUri, Uri.parse('https://checkout.example.com/pay'));
    expect(presenter.checkoutState, WalletCheckoutState.awaitingReturn);

    data
      ..balance = const CreditBalance(
        balance: 100,
        lifetimeEarned: 100,
        lifetimeSpent: 0,
      )
      ..transactions = const [
        CreditTransaction(
          id: 'purchase-id',
          amount: 100,
          type: 'purchase',
          createdAtMillis: 1,
          paymentReference: 'fi_reference',
        ),
      ];

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(data.verifyCalls, 1);
    expect(presenter.checkoutState, WalletCheckoutState.confirmed);
    expect(presenter.balance.balance, 100);
  });

  testWidgets('renders payout loading errors and request history', (
    tester,
  ) async {
    const request = PayoutRequest(
      id: 'payout-id',
      amount: 20,
      currency: 'USD',
      status: 'pending',
      requestedAtMillis: 1,
      payoutMethod: 'Bank account ending 1234',
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          backgroundColor: WalletColors.background,
          body: SingleChildScrollView(
            child: WalletPayoutSection(
              monetization: CreatorMonetization(
                isMonetized: true,
                totalEarnings: 100,
                availableBalance: 80,
              ),
              requests: [request],
              state: WalletLoadState.error,
              requestState: WalletLoadState.ready,
              blockedReason: 'A payout request is already being processed.',
              destination: PayoutDestination(
                id: 'destination-id',
                provider: 'paystack',
                displayLabel: 'Test Bank - ****1234',
                currency: 'NGN',
                status: 'active',
                isDefault: true,
              ),
              onRequest: null,
              onConfigureDestination: _noop,
              onRetry: _noop,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Creator payouts'), findsOneWidget);
    expect(find.text('\$80.00'), findsOneWidget);
    expect(find.text('Could not refresh payout history.'), findsOneWidget);
    expect(find.text('\$20.00'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Bank account ending 1234'), findsOneWidget);
  });
}

void _noop() {}
