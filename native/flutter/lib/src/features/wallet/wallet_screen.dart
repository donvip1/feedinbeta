import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../p2p/p2p_screen.dart';
import 'data/wallet_models.dart';
import 'wallet_presenter.dart';
import 'wallet_theme.dart';
import 'widgets/balance_card.dart';
import 'widgets/buyback_section.dart';
import 'widgets/package_card.dart';
import 'widgets/transaction_list.dart';
import 'widgets/wallet_common.dart';

typedef WalletCheckoutLauncher = Future<bool> Function(Uri uri);

/// Top-level deposit-only Wallet screen: credit balance, credit packages,
/// P2P selling, finance-team buyback, and transaction history.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, this.presenter, this.checkoutLauncher});

  final WalletPresenter? presenter;
  final WalletCheckoutLauncher? checkoutLauncher;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen>
    with WidgetsBindingObserver {
  late final WalletPresenter _presenter;
  late final bool _ownsPresenter;
  final GlobalKey _packagesKey = GlobalKey();
  String? _busyPackageId;
  bool _checkoutWasBackgrounded = false;
  bool _checkingCheckout = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ownsPresenter = widget.presenter == null;
    _presenter = widget.presenter ?? WalletPresenter();
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (_ownsPresenter) _presenter.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        if (_checkoutWasBackgrounded && _presenter.hasPendingCheckout) {
          _checkoutWasBackgrounded = false;
          unawaited(_verifyPendingCheckout());
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        if (_presenter.hasPendingCheckout) _checkoutWasBackgrounded = true;
      case AppLifecycleState.detached:
        break;
    }
  }

  Future<void> _load() async {
    await _presenter.loadOverview();
    await Future.wait([
      _presenter.loadPackages(),
      _presenter.loadTransactions(),
      _presenter.loadFinanceBuybacks(),
    ]);
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _scrollToPackages() {
    final context = _packagesKey.currentContext;
    if (context == null) return;
    Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 350),
      alignment: 0.05,
    );
  }

  Future<void> _openP2P() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeContext) =>
            P2PScreen(onBack: () => Navigator.of(routeContext).maybePop()),
      ),
    );
    if (mounted) await _presenter.refreshAfterMutation();
  }

  Future<void> _openCheckout(WalletCheckoutSession session) async {
    try {
      final launched =
          await (widget.checkoutLauncher?.call(session.authorizationUri) ??
              launchUrl(
                session.authorizationUri,
                mode: LaunchMode.externalApplication,
              ));
      if (launched) return;
    } catch (_) {
      // Convert launcher/plugin errors into the same actionable wallet state.
    }
    const message = 'Could not open the secure checkout link.';
    _presenter.checkoutLaunchFailed(message);
    throw const WalletBackendUnavailable(message);
  }

  Future<void> _verifyPendingCheckout() async {
    if (_checkingCheckout || !_presenter.hasPendingCheckout) return;
    _checkingCheckout = true;
    try {
      final outcome = await _presenter.refreshPendingCheckout();
      switch (outcome) {
        case WalletCheckoutRefreshOutcome.confirmed:
          _snack('Payment confirmed.');
        case WalletCheckoutRefreshOutcome.processing:
          _snack('Payment is not confirmed yet. Check again shortly.');
        case WalletCheckoutRefreshOutcome.failed:
          _snack(
            _presenter.checkoutMessage ??
                'Could not verify the payment. Please try again.',
          );
      }
    } finally {
      _checkingCheckout = false;
    }
  }

  Future<void> _buy(CreditPackage package) async {
    setState(() => _busyPackageId = package.id);
    try {
      final checkout = await _presenter.startCreditCheckout(package.id);
      await _openCheckout(checkout);
    } on WalletBackendUnavailable catch (error) {
      _snack(error.message);
    } catch (_) {
      _snack('Could not start checkout. Please try again.');
    } finally {
      if (mounted) setState(() => _busyPackageId = null);
    }
  }

  Future<bool> _requestFinanceBuyback(int creditsAmount) async {
    try {
      await _presenter.requestFinanceBuyback(creditsAmount: creditsAmount);
      _snack('Buyback request submitted.');
      return true;
    } on WalletBackendUnavailable catch (error) {
      _snack(error.message);
    } catch (_) {
      _snack('Could not submit the buyback request.');
    }
    return false;
  }

  Future<void> _cancelFinanceBuyback(FinanceBuybackRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: WalletColors.card,
        title: const Text(
          'Cancel buyback request?',
          style: TextStyle(color: WalletColors.foreground),
        ),
        content: Text(
          '${formatCredits(request.creditsAmount)} credits will return to your '
          'available balance.',
          style: WalletTextStyles.rowMuted,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Keep request'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cancel request'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await _presenter.cancelFinanceBuyback(request);
      _snack('Buyback request canceled.');
    } on WalletBackendUnavailable catch (error) {
      _snack(error.message);
    } catch (_) {
      _snack('Could not cancel the buyback request.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WalletColors.background,
      appBar: AppBar(
        backgroundColor: WalletColors.card,
        surfaceTintColor: WalletColors.card,
        elevation: 0,
        iconTheme: const IconThemeData(color: WalletColors.foreground),
        title: const Text(
          'Wallet',
          style: TextStyle(
            color: WalletColors.foreground,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'P2P marketplace',
            onPressed: _openP2P,
            icon: const Icon(
              Icons.storefront_rounded,
              color: WalletColors.foreground,
            ),
          ),
        ],
      ),
      body: ListenableBuilder(
        listenable: _presenter,
        builder: (context, _) {
          final presenter = _presenter;
          return RefreshIndicator(
            onRefresh: _load,
            color: WalletColors.primary,
            backgroundColor: WalletColors.card,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                WalletBalanceCard(
                  balance: presenter.balance,
                  onBuy: _scrollToPackages,
                ),
                if (presenter.checkoutState != WalletCheckoutState.idle) ...[
                  const SizedBox(height: 12),
                  _checkoutBanner(presenter),
                ],
                if (presenter.overviewState == WalletLoadState.error) ...[
                  const SizedBox(height: 12),
                  WalletInlineError(
                    message:
                        'Could not refresh your wallet balance. '
                        'Pull to retry or tap below.',
                    onRetry: presenter.loadOverview,
                  ),
                ],
                const SizedBox(height: 16),
                WalletNavTile(
                  icon: Icons.storefront_rounded,
                  title: 'Sell credits P2P',
                  subtitle: 'List and trade credits with other users',
                  onTap: _openP2P,
                ),
                const SizedBox(height: 20),
                Container(key: _packagesKey),
                const WalletSectionHeader(title: 'Feedin credit packages'),
                const SizedBox(height: 8),
                if (presenter.packagesState == WalletLoadState.loading)
                  const WalletLoading()
                else if (presenter.packagesState == WalletLoadState.error)
                  WalletEmptyState(
                    icon: Icons.error_outline_rounded,
                    title: 'Couldn\'t load packages',
                    subtitle: 'Check your connection and try again.',
                    action: WalletSecondaryButton(
                      label: 'Retry',
                      icon: Icons.refresh_rounded,
                      onPressed: presenter.loadPackages,
                    ),
                  )
                else if (presenter.packages.isEmpty)
                  _emptyLine('No credit packages available yet.')
                else
                  ...presenter.packages.map(
                    (package) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: WalletPackageCard(
                        package: package,
                        onPurchase: () => _buy(package),
                        busy: _busyPackageId == package.id,
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
                WalletBuybackSection(
                  balance: presenter.balance,
                  requests: presenter.buybackRequests,
                  state: presenter.buybackState,
                  mutationState: presenter.buybackMutationState,
                  blockedReason: presenter.financeBuybackBlockedReason,
                  cancelingRequestId: presenter.cancelingBuybackRequestId,
                  onRequest: _requestFinanceBuyback,
                  onCancel: _cancelFinanceBuyback,
                  onRetry: presenter.loadFinanceBuybacks,
                ),
                const SizedBox(height: 20),
                const WalletSectionHeader(title: 'Transaction history'),
                const SizedBox(height: 8),
                if (presenter.transactionsState == WalletLoadState.loading)
                  const WalletLoading()
                else if (presenter.transactionsState == WalletLoadState.error)
                  WalletEmptyState(
                    icon: Icons.error_outline_rounded,
                    title: 'Couldn\'t load transactions',
                    subtitle: 'Check your connection and try again.',
                    action: WalletSecondaryButton(
                      label: 'Retry',
                      icon: Icons.refresh_rounded,
                      onPressed: presenter.loadTransactions,
                    ),
                  )
                else
                  WalletTransactionList(
                    transactions: presenter.filteredTransactions,
                    filter: presenter.transactionFilter,
                    onFilterChanged: presenter.setTransactionFilter,
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _emptyLine(String message) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 24),
    child: Center(
      child: Text(
        message,
        style: const TextStyle(color: WalletColors.mutedForeground),
      ),
    ),
  );

  Widget _checkoutBanner(WalletPresenter presenter) {
    final message =
        presenter.checkoutMessage ?? 'Complete or verify the hosted checkout.';
    return switch (presenter.checkoutState) {
      WalletCheckoutState.idle => const SizedBox.shrink(),
      WalletCheckoutState.awaitingReturn => WalletStatusBanner(
        icon: Icons.open_in_browser_rounded,
        title: 'Checkout opened',
        message: message,
        actionLabel: 'I completed payment',
        onAction: _verifyPendingCheckout,
        onDismiss: presenter.cancelPendingCheckout,
      ),
      WalletCheckoutState.verifying => WalletStatusBanner(
        icon: Icons.verified_user_rounded,
        title: 'Verifying payment',
        message: message,
        busy: true,
      ),
      WalletCheckoutState.confirmed => WalletStatusBanner(
        icon: Icons.check_circle_rounded,
        title: 'Payment confirmed',
        message: message,
        tone: WalletStatusTone.success,
        onDismiss: presenter.clearCheckoutStatus,
      ),
      WalletCheckoutState.processing => WalletStatusBanner(
        icon: Icons.schedule_rounded,
        title: 'Confirmation pending',
        message: message,
        tone: WalletStatusTone.warning,
        actionLabel: 'Check again',
        onAction: _verifyPendingCheckout,
        onDismiss: presenter.cancelPendingCheckout,
      ),
      WalletCheckoutState.error => WalletStatusBanner(
        icon: Icons.error_outline_rounded,
        title: 'Checkout needs attention',
        message: message,
        tone: WalletStatusTone.error,
        actionLabel: presenter.hasPendingCheckout ? 'Try again' : null,
        onAction: presenter.hasPendingCheckout ? _verifyPendingCheckout : null,
        onDismiss: presenter.clearCheckoutStatus,
      ),
    };
  }
}
