import 'package:flutter/foundation.dart';

import 'data/currency_models.dart';
import 'data/wallet_gift_models.dart';
import 'data/wallet_models.dart';
import 'data/wallet_remote_data_source.dart';

/// Loading phase for a section of the wallet.
enum WalletLoadState { idle, loading, ready, error }

const double kMinimumCreatorPayoutUsd = 10;

/// Lifecycle of a hosted checkout while the user moves between the app and the
/// provider browser.
enum WalletCheckoutState {
  idle,
  awaitingReturn,
  verifying,
  confirmed,
  processing,
  error,
}

/// A [ChangeNotifier] that owns all wallet state and orchestrates loads through
/// [WalletRemoteDataSource]. Widgets subscribe via `ListenableBuilder` and stay
/// dumb — they never touch Supabase directly (mirrors the profile parity split
/// where the host drives data and passes view-models down).
///
/// Every load degrades gracefully: an unconfigured / signed-out data source
/// returns empty/neutral values, so the screen renders an honest empty state
/// rather than throwing.
class WalletPresenter extends ChangeNotifier {
  WalletPresenter({
    WalletDataSource? dataSource,
    List<Duration> checkoutRefreshDelays = const [
      Duration.zero,
      Duration(seconds: 1),
      Duration(seconds: 2),
      Duration(seconds: 3),
    ],
    DateTime Function()? now,
  }) : _data = dataSource ?? WalletRemoteDataSource.autoDetect(),
       _checkoutRefreshDelays = List.unmodifiable(checkoutRefreshDelays),
       _now = now ?? DateTime.now;

  final WalletDataSource _data;
  final List<Duration> _checkoutRefreshDelays;
  final DateTime Function() _now;

  // --- Overview / balance ---
  WalletLoadState _overviewState = WalletLoadState.idle;
  WalletLoadState get overviewState => _overviewState;

  CreditBalance _balance = CreditBalance.empty;
  CreditBalance get balance => _balance;

  UserSubscription? _activeSubscription;
  UserSubscription? get activeSubscription => _activeSubscription;

  // --- Packages ---
  WalletLoadState _packagesState = WalletLoadState.idle;
  WalletLoadState get packagesState => _packagesState;
  List<CreditPackage> _packages = const [];
  List<CreditPackage> get packages => _packages;
  CurrencyQuote _currencyQuote = CurrencyQuote.usd;
  CurrencyQuote get currencyQuote => _currencyQuote;

  CurrencyDisplayPrice get balanceApproximation =>
      CurrencyDisplayPrice.fromUsdMinor(
        (_balance.approxUsd * 100).round(),
        _currencyQuote,
      );

  CurrencyDisplayPrice packagePrice(CreditPackage package) =>
      CurrencyDisplayPrice.fromUsdMinor(package.priceCents, _currencyQuote);

  CurrencyDisplayPrice subscriptionPrice(SubscriptionTier tier) =>
      CurrencyDisplayPrice.fromUsdMinor(tier.priceCents, _currencyQuote);

  // --- Transactions ---
  WalletLoadState _transactionsState = WalletLoadState.idle;
  WalletLoadState get transactionsState => _transactionsState;
  List<CreditTransaction> _transactions = const [];
  List<CreditTransaction> get transactions => _transactions;

  TransactionFilter _transactionFilter = TransactionFilter.all;
  TransactionFilter get transactionFilter => _transactionFilter;
  List<CreditTransaction> get filteredTransactions =>
      _transactions.where(_transactionFilter.matches).toList();

  // --- Gifts ---
  WalletLoadState _giftsState = WalletLoadState.idle;
  WalletLoadState get giftsState => _giftsState;
  List<WalletGiftReceipt> _receivedGifts = const [];
  List<WalletGiftReceipt> get receivedGifts => _receivedGifts;
  List<WalletGiftReceipt> _sentGifts = const [];
  List<WalletGiftReceipt> get sentGifts => _sentGifts;

  // --- Finance buyback ---
  WalletLoadState _buybackState = WalletLoadState.idle;
  WalletLoadState get buybackState => _buybackState;
  List<FinanceBuybackRequest> _buybackRequests = const [];
  List<FinanceBuybackRequest> get buybackRequests => _buybackRequests;

  WalletLoadState _buybackMutationState = WalletLoadState.idle;
  WalletLoadState get buybackMutationState => _buybackMutationState;
  String? _cancelingBuybackRequestId;
  String? get cancelingBuybackRequestId => _cancelingBuybackRequestId;

  bool get hasPendingFinanceBuyback =>
      _buybackRequests.any((request) => request.isPending);

  bool get canRequestFinanceBuyback => financeBuybackBlockedReason == null;

  String? get financeBuybackBlockedReason {
    if (_buybackState == WalletLoadState.idle ||
        _buybackState == WalletLoadState.loading) {
      return 'Buyback history is still loading.';
    }
    if (_buybackState == WalletLoadState.error) {
      return 'Refresh buyback history before submitting a request.';
    }
    if (_buybackMutationState == WalletLoadState.loading) {
      return 'A finance buyback update is in progress.';
    }
    if (hasPendingFinanceBuyback) {
      return 'You already have a pending finance buyback request.';
    }
    if (_balance.balance <= 0) {
      return 'You do not have credits available for buyback.';
    }
    return null;
  }

  // --- Subscription tiers ---
  WalletLoadState _tiersState = WalletLoadState.idle;
  WalletLoadState get tiersState => _tiersState;
  List<SubscriptionTier> _tiers = const [];
  List<SubscriptionTier> get tiers => _tiers;

  String? get activeTierId => _activeSubscription?.tierId;

  // --- Payouts ---
  WalletLoadState _payoutState = WalletLoadState.idle;
  WalletLoadState get payoutState => _payoutState;
  CreatorMonetization _monetization = CreatorMonetization.empty;
  CreatorMonetization get monetization => _monetization;
  List<PayoutRequest> _payoutRequests = const [];
  List<PayoutRequest> get payoutRequests => _payoutRequests;
  List<PayoutDestination> _payoutDestinations = const [];
  List<PayoutDestination> get payoutDestinations => _payoutDestinations;
  PayoutDestination? get defaultPayoutDestination {
    for (final destination in _payoutDestinations) {
      if (destination.isActive && destination.isDefault) return destination;
    }
    for (final destination in _payoutDestinations) {
      if (destination.isActive) return destination;
    }
    return null;
  }

  WalletLoadState _payoutRequestState = WalletLoadState.idle;
  WalletLoadState get payoutRequestState => _payoutRequestState;

  /// Whether the payout tab should be shown at all (creator is monetized).
  bool get isMonetizedCreator => _monetization.isMonetized;
  bool get hasOpenPayoutRequest =>
      _payoutRequests.any((request) => request.isOpen);

  bool get canRequestPayout => payoutBlockedReason == null;

  String? get payoutBlockedReason {
    if (!_monetization.isMonetized) {
      return 'Creator payouts are not enabled for this account.';
    }
    if (_payoutState == WalletLoadState.idle ||
        _payoutState == WalletLoadState.loading) {
      return 'Payout eligibility is still loading.';
    }
    if (_payoutState == WalletLoadState.error) {
      return 'Refresh payout history before requesting another payout.';
    }
    if (_payoutRequestState == WalletLoadState.loading) {
      return 'A payout request is being submitted.';
    }
    if (hasOpenPayoutRequest) {
      return 'A payout request is already being processed.';
    }
    if (defaultPayoutDestination == null) {
      return 'Add a bank account before requesting a payout.';
    }
    if (_monetization.availableBalance < kMinimumCreatorPayoutUsd) {
      return 'The minimum creator payout is \$10.00.';
    }
    final nextEligible = _monetization.nextEligiblePayoutMillis;
    if (nextEligible != null &&
        DateTime.fromMillisecondsSinceEpoch(nextEligible).isAfter(_now())) {
      return 'The next payout date has not been reached yet.';
    }
    return null;
  }

  _PendingCheckout? _pendingCheckout;
  WalletCheckoutSession? get pendingCheckout => _pendingCheckout?.session;
  bool get hasPendingCheckout => _pendingCheckout != null;
  WalletCheckoutState _checkoutState = WalletCheckoutState.idle;
  WalletCheckoutState get checkoutState => _checkoutState;
  String? _checkoutMessage;
  String? get checkoutMessage => _checkoutMessage;
  Future<WalletCheckoutRefreshOutcome>? _checkoutRefreshFuture;

  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _safeNotify() {
    if (!_disposed) notifyListeners();
  }

  // --- Loads --------------------------------------------------------------

  /// Loads the overview: balance + active subscription + monetization (so the
  /// payout tab can decide whether to appear).
  Future<void> loadOverview() async {
    _overviewState = WalletLoadState.loading;
    _safeNotify();
    try {
      final results = await Future.wait([
        _data.fetchBalance(),
        _data.fetchActiveSubscription(),
        _data.fetchMonetization(),
      ]);
      _balance = results[0] as CreditBalance;
      _activeSubscription = results[1] as UserSubscription?;
      _monetization = results[2] as CreatorMonetization;
      _overviewState = WalletLoadState.ready;
    } catch (_) {
      _overviewState = WalletLoadState.error;
    }
    _safeNotify();
  }

  Future<void> loadPackages() async {
    if (_packagesState == WalletLoadState.loading) return;
    _packagesState = WalletLoadState.loading;
    _safeNotify();
    try {
      final results = await Future.wait([
        _data.fetchPackages(),
        _data.fetchCurrencyQuote(),
      ]);
      _packages = results[0] as List<CreditPackage>;
      _currencyQuote = results[1] as CurrencyQuote;
      _packagesState = WalletLoadState.ready;
    } catch (_) {
      _packagesState = WalletLoadState.error;
    }
    _safeNotify();
  }

  Future<void> loadTransactions() async {
    if (_transactionsState == WalletLoadState.loading) return;
    _transactionsState = WalletLoadState.loading;
    _safeNotify();
    try {
      _transactions = await _data.fetchTransactions();
      _transactionsState = WalletLoadState.ready;
    } catch (_) {
      _transactionsState = WalletLoadState.error;
    }
    _safeNotify();
  }

  Future<void> loadGifts() async {
    if (_giftsState == WalletLoadState.loading) return;
    _giftsState = WalletLoadState.loading;
    _safeNotify();
    try {
      final results = await Future.wait([
        _data.fetchReceivedGifts(),
        _data.fetchSentGifts(),
      ]);
      _receivedGifts = results[0];
      _sentGifts = results[1];
      _giftsState = WalletLoadState.ready;
    } catch (_) {
      _giftsState = WalletLoadState.error;
    }
    _safeNotify();
  }

  Future<void> loadFinanceBuybacks() async {
    if (_buybackState == WalletLoadState.loading) return;
    _buybackState = WalletLoadState.loading;
    _safeNotify();
    try {
      _buybackRequests = await _data.fetchFinanceBuybackRequests();
      _buybackState = WalletLoadState.ready;
    } catch (_) {
      _buybackState = WalletLoadState.error;
    }
    _safeNotify();
  }

  Future<void> loadTiers() async {
    if (_tiersState == WalletLoadState.loading) return;
    _tiersState = WalletLoadState.loading;
    _safeNotify();
    try {
      _tiers = await _data.fetchTiers();
      _tiersState = WalletLoadState.ready;
    } catch (_) {
      _tiersState = WalletLoadState.error;
    }
    _safeNotify();
  }

  Future<void> loadPayouts() async {
    if (_payoutState == WalletLoadState.loading) return;
    _payoutState = WalletLoadState.loading;
    _safeNotify();
    try {
      final results = await Future.wait([
        _data.fetchMonetization(),
        _data.fetchMyPayoutRequests(),
        _data.fetchPayoutDestinations(),
      ]);
      _monetization = results[0] as CreatorMonetization;
      _payoutRequests = results[1] as List<PayoutRequest>;
      _payoutDestinations = results[2] as List<PayoutDestination>;
      _payoutState = WalletLoadState.ready;
    } catch (_) {
      _payoutState = WalletLoadState.error;
    }
    _safeNotify();
  }

  void setTransactionFilter(TransactionFilter filter) {
    if (_transactionFilter == filter) return;
    _transactionFilter = filter;
    _safeNotify();
  }

  /// Refresh the balance + ledger after a money move.
  Future<void> refreshAfterMutation() async {
    await Future.wait([loadOverview(), loadTransactions(), loadGifts()]);
  }

  // --- Money moves (delegate to the data source; caller handles UX) -------

  Future<WalletCheckoutSession> startCreditCheckout(String packageId) async {
    final session = await _data.startCreditCheckout(
      packageId,
      currency: _currencyQuote.currencyCode,
    );
    _rememberCheckout(session);
    return session;
  }

  Future<WalletCheckoutSession> startSubscriptionCheckout(String tierId) async {
    final session = await _data.startSubscriptionCheckout(
      tierId,
      currency: _currencyQuote.currencyCode,
    );
    _rememberCheckout(session);
    return session;
  }

  void _rememberCheckout(WalletCheckoutSession session) {
    _pendingCheckout = _PendingCheckout(
      session: session,
      balanceBefore: _balance.balance,
      activeTierBefore: activeTierId,
      transactionIdsBefore: _transactions.map((tx) => tx.id).toSet(),
    );
    _checkoutState = WalletCheckoutState.awaitingReturn;
    _checkoutMessage = switch (session.kind) {
      WalletCheckoutKind.credits =>
        'Complete the payment in your browser, then return here.',
      WalletCheckoutKind.subscription =>
        'Complete the subscription payment in your browser, then return here.',
    };
    _safeNotify();
  }

  void cancelPendingCheckout() {
    if (_pendingCheckout == null &&
        _checkoutState == WalletCheckoutState.idle) {
      return;
    }
    _pendingCheckout = null;
    _checkoutState = WalletCheckoutState.idle;
    _checkoutMessage = null;
    _safeNotify();
  }

  void checkoutLaunchFailed(String message) {
    _pendingCheckout = null;
    _checkoutState = WalletCheckoutState.error;
    _checkoutMessage = message;
    _safeNotify();
  }

  void clearCheckoutStatus() {
    if (_pendingCheckout != null) {
      cancelPendingCheckout();
      return;
    }
    if (_checkoutState == WalletCheckoutState.idle) return;
    _checkoutState = WalletCheckoutState.idle;
    _checkoutMessage = null;
    _safeNotify();
  }

  /// Reloads balance, subscription, monetization and ledger after the app
  /// returns from hosted checkout. A few bounded retries cover webhook /
  /// callback processing delay without reporting payment success prematurely.
  Future<WalletCheckoutRefreshOutcome> refreshPendingCheckout() async {
    final running = _checkoutRefreshFuture;
    if (running != null) return running;

    late final Future<WalletCheckoutRefreshOutcome> refresh;
    refresh = _performCheckoutRefresh().whenComplete(() {
      if (identical(_checkoutRefreshFuture, refresh)) {
        _checkoutRefreshFuture = null;
      }
    });
    _checkoutRefreshFuture = refresh;
    return refresh;
  }

  Future<WalletCheckoutRefreshOutcome> _performCheckoutRefresh() async {
    final pending = _pendingCheckout;
    if (pending == null) return WalletCheckoutRefreshOutcome.failed;

    _checkoutState = WalletCheckoutState.verifying;
    _checkoutMessage = 'Verifying your payment...';
    _safeNotify();

    var hadSuccessfulRead = false;
    var paymentVerified = false;
    WalletCheckoutVerificationException? lastVerificationError;

    for (final delay in _checkoutRefreshDelays) {
      if (delay > Duration.zero) await Future<void>.delayed(delay);

      try {
        final verification = await _data.verifyCheckout(
          pending.session.reference,
        );
        paymentVerified =
            verification.isCompleted &&
            verification.paymentIntentId == pending.session.paymentIntentId;
        if (!paymentVerified) {
          lastVerificationError = const WalletCheckoutVerificationException(
            'The payment details did not match this checkout.',
            code: 'PAYMENT_INTENT_MISMATCH',
          );
        }
      } on WalletCheckoutVerificationException catch (error) {
        lastVerificationError = error;
        if (!error.isPaymentIncomplete) {
          _checkoutState = WalletCheckoutState.error;
          _checkoutMessage = error.message;
          _safeNotify();
          return WalletCheckoutRefreshOutcome.failed;
        }
      } catch (_) {
        lastVerificationError = const WalletCheckoutVerificationException(
          'Could not verify this payment. Check your connection and try again.',
        );
      }

      await Future.wait([loadOverview(), loadTransactions()]);

      final readSucceeded =
          _overviewState == WalletLoadState.ready ||
          _transactionsState == WalletLoadState.ready;
      hadSuccessfulRead = hadSuccessfulRead || readSucceeded;
      if (paymentVerified || _checkoutIsConfirmed(pending)) {
        _pendingCheckout = null;
        _checkoutState = WalletCheckoutState.confirmed;
        _checkoutMessage = switch (pending.session.kind) {
          WalletCheckoutKind.credits =>
            'Payment confirmed. Your wallet balance has been refreshed.',
          WalletCheckoutKind.subscription =>
            'Subscription confirmed. Your current plan has been refreshed.',
        };
        _safeNotify();
        return WalletCheckoutRefreshOutcome.confirmed;
      }
    }

    if (hadSuccessfulRead &&
        (lastVerificationError == null ||
            lastVerificationError.isPaymentIncomplete)) {
      _checkoutState = WalletCheckoutState.processing;
      _checkoutMessage =
          'Payment has not been confirmed yet. You can check again shortly.';
      _safeNotify();
      return WalletCheckoutRefreshOutcome.processing;
    }

    _checkoutState = WalletCheckoutState.error;
    _checkoutMessage =
        lastVerificationError?.message ??
        'Could not refresh your wallet after checkout.';
    _safeNotify();
    return WalletCheckoutRefreshOutcome.failed;
  }

  bool _checkoutIsConfirmed(_PendingCheckout pending) {
    final session = pending.session;
    final matchingReference = _transactions.any(
      (tx) => tx.paymentReference == session.reference,
    );
    if (matchingReference) return true;

    return switch (session.kind) {
      WalletCheckoutKind.credits =>
        _balance.balance > pending.balanceBefore ||
            _transactions.any(
              (tx) =>
                  tx.isPurchase &&
                  !pending.transactionIdsBefore.contains(tx.id),
            ),
      WalletCheckoutKind.subscription =>
        activeTierId == session.itemId &&
            pending.activeTierBefore != session.itemId,
    };
  }

  Future<void> transferCredits({
    required String recipientUsername,
    required int amount,
  }) => _data.transferCredits(
    recipientUsername: recipientUsername,
    amount: amount,
  );

  Future<void> sendDirectGift({
    required String recipientIdentifier,
    required String giftType,
    required int creditValue,
  }) => _data.sendDirectGift(
    recipientIdentifier: recipientIdentifier,
    giftType: giftType,
    creditValue: creditValue,
  );

  Future<void> requestFinanceBuyback({required int creditsAmount}) async {
    final blockedReason = financeBuybackBlockedReason;
    if (blockedReason != null) {
      throw WalletBackendUnavailable(blockedReason);
    }
    if (creditsAmount <= 0) {
      throw const WalletBackendUnavailable('Enter a valid number of credits.');
    }
    if (creditsAmount > _balance.balance) {
      throw const WalletBackendUnavailable(
        'You do not have enough credits for this buyback request.',
      );
    }

    _buybackMutationState = WalletLoadState.loading;
    _safeNotify();
    try {
      await _data.requestFinanceBuyback(creditsAmount: creditsAmount);
      await Future.wait([loadFinanceBuybacks(), refreshAfterMutation()]);
      _buybackMutationState = WalletLoadState.ready;
      _safeNotify();
    } catch (_) {
      _buybackMutationState = WalletLoadState.error;
      _safeNotify();
      rethrow;
    }
  }

  Future<void> cancelFinanceBuyback(FinanceBuybackRequest request) async {
    if (!request.isPending) {
      throw const WalletBackendUnavailable(
        'Only pending buyback requests can be canceled.',
      );
    }
    if (_buybackMutationState == WalletLoadState.loading) {
      throw const WalletBackendUnavailable(
        'A finance buyback update is already in progress.',
      );
    }

    _buybackMutationState = WalletLoadState.loading;
    _cancelingBuybackRequestId = request.id;
    _safeNotify();
    try {
      await _data.cancelFinanceBuyback(request.id);
      await Future.wait([loadFinanceBuybacks(), refreshAfterMutation()]);
      _buybackMutationState = WalletLoadState.ready;
      _cancelingBuybackRequestId = null;
      _safeNotify();
    } catch (_) {
      _buybackMutationState = WalletLoadState.error;
      _cancelingBuybackRequestId = null;
      _safeNotify();
      rethrow;
    }
  }

  Future<PayoutRequest> requestPayout({required double amount}) async {
    final blockedReason = payoutBlockedReason;
    if (blockedReason != null) {
      throw WalletBackendUnavailable(blockedReason);
    }
    if (!amount.isFinite || amount < kMinimumCreatorPayoutUsd) {
      throw const WalletBackendUnavailable(
        'The minimum creator payout is \$10.00.',
      );
    }
    if (amount > _monetization.availableBalance) {
      throw const WalletBackendUnavailable(
        'The requested amount is higher than your available creator balance.',
      );
    }
    if (_payoutRequestState == WalletLoadState.loading) {
      throw const WalletBackendUnavailable(
        'A payout request is already being submitted.',
      );
    }

    _payoutRequestState = WalletLoadState.loading;
    _safeNotify();
    try {
      final request = await _data.requestPayout(amount: amount);
      _payoutRequests = [
        request,
        ..._payoutRequests.where((item) => item.id != request.id),
      ];
      _payoutRequestState = WalletLoadState.ready;
      _safeNotify();

      await loadPayouts();
      return request;
    } catch (_) {
      _payoutRequestState = WalletLoadState.error;
      _safeNotify();
      rethrow;
    }
  }

  Future<List<PaystackBank>> fetchPayoutBanks() {
    return _data.fetchPaystackBanks();
  }

  Future<VerifiedPayoutAccount> verifyPayoutAccount({
    required String bankCode,
    required String accountNumber,
  }) {
    return _data.verifyPayoutAccount(
      bankCode: bankCode,
      accountNumber: accountNumber,
    );
  }

  Future<PayoutDestination> savePayoutDestination({
    required PaystackBank bank,
    required String accountNumber,
  }) async {
    final destination = await _data.savePayoutDestination(
      bank: bank,
      accountNumber: accountNumber,
    );
    _payoutDestinations = [
      destination,
      ..._payoutDestinations.where((item) => item.id != destination.id),
    ];
    _safeNotify();
    return destination;
  }
}

class _PendingCheckout {
  const _PendingCheckout({
    required this.session,
    required this.balanceBefore,
    required this.activeTierBefore,
    required this.transactionIdsBefore,
  });

  final WalletCheckoutSession session;
  final int balanceBefore;
  final String? activeTierBefore;
  final Set<String> transactionIdsBefore;
}
