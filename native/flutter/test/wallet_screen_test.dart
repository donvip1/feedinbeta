import 'package:feedin/src/features/wallet/data/wallet_models.dart';
import 'package:feedin/src/features/wallet/wallet_presenter.dart';
import 'package:feedin/src/features/wallet/wallet_screen.dart';
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

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(data.verifyCalls, 1);
    expect(presenter.checkoutState, WalletCheckoutState.confirmed);
    expect(presenter.balance.balance, 100);
  });

  testWidgets('renders deposit-only wallet sections and hides legacy actions', (
    tester,
  ) async {
    final data = FakeWalletDataSource()
      ..balance = const CreditBalance(
        balance: 500,
        lifetimeEarned: 500,
        lifetimeSpent: 0,
      )
      ..tiers = const [
        SubscriptionTier(
          id: 'tier-id',
          name: 'Pro',
          priceCents: 999,
          currency: 'USD',
          features: [],
        ),
      ]
      ..monetization = const CreatorMonetization(
        isMonetized: true,
        totalEarnings: 100,
        availableBalance: 80,
      )
      ..payoutRequests = const [
        PayoutRequest(
          id: 'payout-id',
          amount: 20,
          currency: 'USD',
          status: 'pending',
          requestedAtMillis: 1,
        ),
      ]
      ..financeBuybackRequests = const [
        FinanceBuybackRequest(
          id: 'buyback-id',
          creditsAmount: 250,
          status: 'pending',
          requestedAtMillis: 1,
        ),
      ];
    final presenter = WalletPresenter(dataSource: data);

    await tester.pumpWidget(
      MaterialApp(home: WalletScreen(presenter: presenter)),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Finance team buyback'),
      300,
      scrollable: find.byType(Scrollable).first,
    );

    expect(find.text('Finance team buyback'), findsOneWidget);
    expect(find.text('Buyback history'), findsOneWidget);
    expect(find.text('250 credits'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Subscriptions'), findsNothing);
    expect(find.text('Creator payouts'), findsNothing);
    expect(find.text('Payout'), findsNothing);
    expect(find.text('Send'), findsNothing);
    expect(data.fetchTiersCalls, 0);
    expect(data.fetchPayoutRequestsCalls, 0);
  });

  testWidgets('submits and cancels a finance buyback request', (tester) async {
    const request = FinanceBuybackRequest(
      id: 'buyback-id',
      creditsAmount: 200,
      status: 'pending',
      requestedAtMillis: 1,
    );
    final data = FakeWalletDataSource()
      ..balance = const CreditBalance(
        balance: 500,
        lifetimeEarned: 500,
        lifetimeSpent: 0,
      )
      ..financeBuybackResponse = request;
    final presenter = WalletPresenter(dataSource: data);

    await tester.pumpWidget(
      MaterialApp(home: WalletScreen(presenter: presenter)),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const Key('finance_buyback_credits_input')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(
      find.byKey(const Key('finance_buyback_credits_input')),
      '200',
    );
    await tester.scrollUntilVisible(
      find.text('Request buyback'),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Request buyback'));
    await tester.pumpAndSettle();

    expect(data.financeBuybackRequestCalls, 1);
    expect(data.requestedFinanceBuybackCredits, 200);
    expect(find.text('200 credits'), findsOneWidget);

    final cancelFinder = find.byKey(
      const Key('finance_buyback_cancel_buyback-id'),
    );
    await tester.scrollUntilVisible(
      cancelFinder,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(cancelFinder);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel request'));
    await tester.pumpAndSettle();

    expect(data.financeBuybackCancelCalls, 1);
    expect(data.canceledFinanceBuybackRequestId, 'buyback-id');
    expect(find.text('Canceled'), findsOneWidget);
  });
}
