import 'package:feedin/src/features/wallet/data/wallet_models.dart';
import 'package:feedin/src/features/wallet/wallet_presenter.dart';
import 'package:flutter_test/flutter_test.dart';

import 'wallet_test_fakes.dart';

void main() {
  test('verifies credit checkout and refreshes balance and ledger', () async {
    final data = FakeWalletDataSource()
      ..balance = const CreditBalance(
        balance: 100,
        lifetimeEarned: 100,
        lifetimeSpent: 0,
      )
      ..creditCheckout = fakeCheckoutSession(
        kind: WalletCheckoutKind.credits,
        itemId: 'package-id',
      );
    final presenter = WalletPresenter(
      dataSource: data,
      checkoutRefreshDelays: const [Duration.zero],
    );

    await presenter.loadOverview();
    await presenter.loadTransactions();
    await presenter.startCreditCheckout('package-id');

    data
      ..verification = const WalletCheckoutVerification(
        paymentIntentId: 'intent-id',
        status: 'completed',
        alreadyProcessed: false,
        purchaseKind: WalletCheckoutKind.credits,
        balanceAfter: 250,
      )
      ..balance = const CreditBalance(
        balance: 250,
        lifetimeEarned: 250,
        lifetimeSpent: 0,
      )
      ..transactions = const [
        CreditTransaction(
          id: 'purchase-id',
          amount: 150,
          type: 'purchase',
          createdAtMillis: 1,
          paymentReference: 'fi_reference',
        ),
      ];

    final outcome = await presenter.refreshPendingCheckout();

    expect(outcome, WalletCheckoutRefreshOutcome.confirmed);
    expect(presenter.checkoutState, WalletCheckoutState.confirmed);
    expect(presenter.hasPendingCheckout, isFalse);
    expect(presenter.balance.balance, 250);
    expect(presenter.transactions.single.id, 'purchase-id');
    expect(data.verifiedReference, 'fi_reference');
  });

  test('subscription checkout refreshes the active tier', () async {
    final data = FakeWalletDataSource()
      ..subscriptionCheckout = fakeCheckoutSession(
        kind: WalletCheckoutKind.subscription,
        itemId: 'tier-pro',
      );
    final presenter = WalletPresenter(
      dataSource: data,
      checkoutRefreshDelays: const [Duration.zero],
    );

    await presenter.loadOverview();
    await presenter.loadTransactions();
    await presenter.startSubscriptionCheckout('tier-pro');

    data
      ..verification = const WalletCheckoutVerification(
        paymentIntentId: 'intent-id',
        status: 'completed',
        alreadyProcessed: false,
        purchaseKind: WalletCheckoutKind.subscription,
        subscriptionId: 'subscription-id',
      )
      ..activeSubscription = const UserSubscription(
        id: 'subscription-id',
        tierId: 'tier-pro',
        status: 'active',
      );

    final outcome = await presenter.refreshPendingCheckout();

    expect(outcome, WalletCheckoutRefreshOutcome.confirmed);
    expect(presenter.activeTierId, 'tier-pro');
    expect(
      presenter.checkoutMessage,
      contains('current plan has been refreshed'),
    );
  });

  test(
    'keeps an unconfirmed checkout available for another verification',
    () async {
      final data = FakeWalletDataSource()
        ..creditCheckout = fakeCheckoutSession(
          kind: WalletCheckoutKind.credits,
          itemId: 'package-id',
        )
        ..verificationError = const WalletCheckoutVerificationException(
          'Payment has not been completed',
          code: 'PAYMENT_NOT_COMPLETE',
        );
      final presenter = WalletPresenter(
        dataSource: data,
        checkoutRefreshDelays: const [Duration.zero],
      );

      await presenter.loadOverview();
      await presenter.loadTransactions();
      await presenter.startCreditCheckout('package-id');

      final outcome = await presenter.refreshPendingCheckout();

      expect(outcome, WalletCheckoutRefreshOutcome.processing);
      expect(presenter.checkoutState, WalletCheckoutState.processing);
      expect(presenter.hasPendingCheckout, isTrue);
    },
  );

  test('submits and cancels a pending finance buyback', () async {
    const pending = FinanceBuybackRequest(
      id: 'buyback-id',
      creditsAmount: 250,
      status: 'pending',
      requestedAtMillis: 1,
    );
    final data = FakeWalletDataSource()
      ..balance = const CreditBalance(
        balance: 500,
        lifetimeEarned: 500,
        lifetimeSpent: 0,
      )
      ..financeBuybackResponse = pending;
    final presenter = WalletPresenter(dataSource: data);

    await presenter.loadOverview();
    await presenter.loadFinanceBuybacks();
    expect(presenter.canRequestFinanceBuyback, isTrue);

    await presenter.requestFinanceBuyback(creditsAmount: 250);

    expect(data.financeBuybackRequestCalls, 1);
    expect(data.requestedFinanceBuybackCredits, 250);
    expect(presenter.buybackRequests.single.id, 'buyback-id');
    expect(presenter.hasPendingFinanceBuyback, isTrue);
    expect(presenter.canRequestFinanceBuyback, isFalse);

    await presenter.cancelFinanceBuyback(pending);

    expect(data.financeBuybackCancelCalls, 1);
    expect(data.canceledFinanceBuybackRequestId, 'buyback-id');
    expect(presenter.buybackRequests.single.isCanceled, isTrue);
    expect(presenter.hasPendingFinanceBuyback, isFalse);
    expect(presenter.buybackMutationState, WalletLoadState.ready);
  });

  test('rejects a finance buyback above the credit balance', () async {
    final data = FakeWalletDataSource()
      ..balance = const CreditBalance(
        balance: 100,
        lifetimeEarned: 100,
        lifetimeSpent: 0,
      );
    final presenter = WalletPresenter(dataSource: data);

    await presenter.loadOverview();
    await presenter.loadFinanceBuybacks();

    expect(
      () => presenter.requestFinanceBuyback(creditsAmount: 101),
      throwsA(
        isA<WalletBackendUnavailable>().having(
          (error) => error.message,
          'message',
          'You do not have enough credits for this buyback request.',
        ),
      ),
    );
    expect(data.financeBuybackRequestCalls, 0);
  });

  test('submits a payout and refreshes request history', () async {
    const request = PayoutRequest(
      id: 'payout-id',
      amount: 20,
      currency: 'USD',
      status: 'pending',
      requestedAtMillis: 1,
    );
    final data = FakeWalletDataSource()
      ..monetization = const CreatorMonetization(
        isMonetized: true,
        totalEarnings: 100,
        availableBalance: 80,
      )
      ..payoutDestinations = const [
        PayoutDestination(
          id: 'destination-id',
          provider: 'paystack',
          displayLabel: 'Test Bank - ****1234',
          currency: 'NGN',
          status: 'active',
          isDefault: true,
        ),
      ]
      ..payoutResponse = request;
    final presenter = WalletPresenter(dataSource: data);

    await presenter.loadOverview();
    await presenter.loadPayouts();
    expect(presenter.canRequestPayout, isTrue);

    final result = await presenter.requestPayout(amount: 20);

    expect(result.id, 'payout-id');
    expect(data.payoutCalls, 1);
    expect(presenter.payoutRequestState, WalletLoadState.ready);
    expect(presenter.payoutRequests.single.id, 'payout-id');
    expect(presenter.hasOpenPayoutRequest, isTrue);
    expect(presenter.canRequestPayout, isFalse);
  });

  test('requires a payout destination and the minimum balance', () async {
    final data = FakeWalletDataSource()
      ..monetization = const CreatorMonetization(
        isMonetized: true,
        totalEarnings: 9,
        availableBalance: 9,
      );
    final presenter = WalletPresenter(dataSource: data);

    await presenter.loadPayouts();
    expect(
      presenter.payoutBlockedReason,
      'Add a bank account before requesting a payout.',
    );

    data.payoutDestinations = const [
      PayoutDestination(
        id: 'destination-id',
        provider: 'paystack',
        displayLabel: 'Test Bank - ****1234',
        currency: 'NGN',
        status: 'active',
        isDefault: true,
      ),
    ];
    await presenter.loadPayouts();
    expect(
      presenter.payoutBlockedReason,
      'The minimum creator payout is \$10.00.',
    );
  });
}
