import 'package:flutter/foundation.dart';

import 'data/wallet_models.dart';
import 'data/wallet_remote_data_source.dart';

/// Loading phase for a section of the wallet.
enum WalletLoadState { idle, loading, ready, error }

/// A [ChangeNotifier] that owns all wallet state and orchestrates loads through
/// [WalletRemoteDataSource]. Widgets subscribe via `ListenableBuilder` and stay
/// dumb — they never touch Supabase directly (mirrors the profile parity split
/// where the host drives data and passes view-models down).
///
/// Every load degrades gracefully: an unconfigured / signed-out data source
/// returns empty/neutral values, so the screen renders an honest empty state
/// rather than throwing.
class WalletPresenter extends ChangeNotifier {
  WalletPresenter({WalletRemoteDataSource? dataSource})
    : _data = dataSource ?? WalletRemoteDataSource.autoDetect();

  final WalletRemoteDataSource _data;

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

  // --- Transactions ---
  WalletLoadState _transactionsState = WalletLoadState.idle;
  WalletLoadState get transactionsState => _transactionsState;
  List<CreditTransaction> _transactions = const [];
  List<CreditTransaction> get transactions => _transactions;

  TransactionFilter _transactionFilter = TransactionFilter.all;
  TransactionFilter get transactionFilter => _transactionFilter;
  List<CreditTransaction> get filteredTransactions =>
      _transactions.where(_transactionFilter.matches).toList();

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

  /// Whether the payout tab should be shown at all (creator is monetized).
  bool get isMonetizedCreator => _monetization.isMonetized;

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
      _packages = await _data.fetchPackages();
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
      ]);
      _monetization = results[0] as CreatorMonetization;
      _payoutRequests = results[1] as List<PayoutRequest>;
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
    await Future.wait([loadOverview(), loadTransactions()]);
  }

  // --- Money moves (delegate to the data source; caller handles UX) -------

  Future<String> startCreditCheckout(String packageId) =>
      _data.startCreditCheckout(packageId);

  Future<String> startSubscriptionCheckout(String tierId) =>
      _data.startSubscriptionCheckout(tierId);

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

  Future<PayoutRequest?> requestPayout({
    required double amount,
    required String currency,
    String? payoutMethod,
  }) => _data.requestPayout(
    amount: amount,
    currency: currency,
    payoutMethod: payoutMethod,
  );
}
