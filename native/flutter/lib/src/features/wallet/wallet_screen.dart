import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../p2p/p2p_screen.dart';
import 'data/wallet_models.dart';
import 'wallet_presenter.dart';
import 'wallet_theme.dart';
import 'widgets/balance_card.dart';
import 'widgets/package_card.dart';
import 'widgets/send_credits_sheet.dart';
import 'widgets/subscription_card.dart';
import 'widgets/transaction_list.dart';
import 'widgets/wallet_common.dart';

/// Top-level Wallet screen: credit/token balance, buy credits, gift/transfer,
/// subscriptions, transaction history, and (for monetized creators) payouts.
///
/// Owns a [WalletPresenter] (auto-detecting the Supabase singleton) and drives
/// the presentational wallet widgets via [ListenableBuilder]. Push it as a route
/// from Profile or Settings. Everything degrades to honest empty states when
/// signed-out / unconfigured; money moves surface a soft failure via snackbar
/// when the server-side contract isn't available.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, this.presenter});

  /// Optional injected presenter (e.g. for tests). When null the screen creates
  /// and owns one.
  final WalletPresenter? presenter;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  late final WalletPresenter _presenter;
  late final bool _ownsPresenter;
  final GlobalKey _packagesKey = GlobalKey();
  String? _busyPackageId;
  String? _busyTierId;

  @override
  void initState() {
    super.initState();
    _ownsPresenter = widget.presenter == null;
    _presenter = widget.presenter ?? WalletPresenter();
    _load();
  }

  @override
  void dispose() {
    if (_ownsPresenter) _presenter.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    await _presenter.loadOverview();
    await Future.wait([
      _presenter.loadPackages(),
      _presenter.loadTransactions(),
      _presenter.loadTiers(),
    ]);
    if (_presenter.isMonetizedCreator) {
      await _presenter.loadPayouts();
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  String? _activeTierName() {
    final id = _presenter.activeTierId;
    if (id == null) return null;
    for (final tier in _presenter.tiers) {
      if (tier.id == id) return tier.name;
    }
    return null;
  }

  void _scrollToPackages() {
    final ctx = _packagesKey.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 350),
        alignment: 0.05,
      );
    }
  }

  Future<void> _openSend() async {
    final sent = await SendCreditsSheet.show(
      context,
      presenter: _presenter,
      balance: _presenter.balance,
    );
    if (sent == true) await _presenter.refreshAfterMutation();
  }

  /// Opens the P2P credit marketplace. The wallet is the natural entry point:
  /// users buy credits from the store here and can trade them peer-to-peer
  /// there. Refreshes the balance/ledger on return since a trade may have
  /// moved credits.
  Future<void> _openP2P() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeContext) =>
            P2PScreen(onBack: () => Navigator.of(routeContext).maybePop()),
      ),
    );
    if (mounted) await _presenter.refreshAfterMutation();
  }

  Future<void> _openCheckout(String value) async {
    final uri = Uri.tryParse(value);
    if (uri != null && (uri.scheme == 'http' || uri.scheme == 'https')) {
      try {
        if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
      } catch (_) {
        // fall through to the soft confirmation below
      }
    }
    _snack('Checkout ready — complete it to receive your credits.');
  }

  Future<void> _buy(CreditPackage pkg) async {
    setState(() => _busyPackageId = pkg.id);
    try {
      final checkout = await _presenter.startCreditCheckout(pkg.id);
      await _openCheckout(checkout);
      await _presenter.refreshAfterMutation();
    } on WalletBackendUnavailable catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not start checkout. Please try again.');
    } finally {
      if (mounted) setState(() => _busyPackageId = null);
    }
  }

  Future<void> _subscribe(SubscriptionTier tier) async {
    setState(() => _busyTierId = tier.id);
    try {
      final checkout = await _presenter.startSubscriptionCheckout(tier.id);
      await _openCheckout(checkout);
      await _presenter.refreshAfterMutation();
    } on WalletBackendUnavailable catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not start the subscription. Please try again.');
    } finally {
      if (mounted) setState(() => _busyTierId = null);
    }
  }

  Future<void> _openPayout() async {
    final controller = TextEditingController();
    final amount = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: WalletColors.card,
        title: const Text(
          'Request payout',
          style: TextStyle(color: WalletColors.foreground),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(color: WalletColors.foreground),
          decoration: const InputDecoration(
            labelText: 'Amount (USD)',
            labelStyle: TextStyle(color: WalletColors.mutedForeground),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(
              ctx,
            ).pop(double.tryParse(controller.text.trim())),
            child: const Text('Request'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (amount == null || amount <= 0) return;
    try {
      await _presenter.requestPayout(amount: amount, currency: 'USD');
      _snack('Payout requested.');
      await _presenter.loadPayouts();
    } on WalletBackendUnavailable catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not request the payout.');
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
          final p = _presenter;
          return RefreshIndicator(
            onRefresh: _load,
            color: WalletColors.primary,
            backgroundColor: WalletColors.card,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                WalletBalanceCard(
                  balance: p.balance,
                  onSend: () => _openSend(),
                  onBuy: _scrollToPackages,
                  onWithdraw: p.isMonetizedCreator ? () => _openPayout() : null,
                  tierName: _activeTierName(),
                ),
                if (p.overviewState == WalletLoadState.error) ...[
                  const SizedBox(height: 12),
                  WalletInlineError(
                    message:
                        'Could not refresh your balance. Pull to retry or tap '
                        'below.',
                    onRetry: _presenter.loadOverview,
                  ),
                ],
                const SizedBox(height: 16),

                // Peer-to-peer marketplace entry.
                WalletNavTile(
                  icon: Icons.storefront_rounded,
                  title: 'P2P marketplace',
                  subtitle: 'Buy & sell credits with other users',
                  onTap: _openP2P,
                ),
                const SizedBox(height: 20),

                // Buy credits / tokens
                Container(key: _packagesKey),
                const WalletSectionHeader(title: 'Buy credits'),
                const SizedBox(height: 8),
                if (p.packagesState == WalletLoadState.loading)
                  const WalletLoading()
                else if (p.packagesState == WalletLoadState.error)
                  WalletEmptyState(
                    icon: Icons.error_outline_rounded,
                    title: 'Couldn\'t load packages',
                    subtitle: 'Check your connection and try again.',
                    action: WalletSecondaryButton(
                      label: 'Retry',
                      icon: Icons.refresh_rounded,
                      onPressed: _presenter.loadPackages,
                    ),
                  )
                else if (p.packages.isEmpty)
                  _emptyLine('No credit packages available yet.')
                else
                  ...p.packages.map(
                    (pkg) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: WalletPackageCard(
                        package: pkg,
                        onPurchase: () => _buy(pkg),
                        busy: _busyPackageId == pkg.id,
                      ),
                    ),
                  ),
                const SizedBox(height: 20),

                // Subscription tiers
                if (p.tiersState == WalletLoadState.loading ||
                    p.tiersState == WalletLoadState.error ||
                    p.tiers.isNotEmpty) ...[
                  const WalletSectionHeader(title: 'Subscriptions'),
                  const SizedBox(height: 8),
                  if (p.tiersState == WalletLoadState.loading)
                    const WalletLoading()
                  else if (p.tiersState == WalletLoadState.error)
                    WalletEmptyState(
                      icon: Icons.error_outline_rounded,
                      title: 'Couldn\'t load plans',
                      subtitle: 'Check your connection and try again.',
                      action: WalletSecondaryButton(
                        label: 'Retry',
                        icon: Icons.refresh_rounded,
                        onPressed: _presenter.loadTiers,
                      ),
                    )
                  else
                    ...p.tiers.map(
                      (tier) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: WalletSubscriptionCard(
                          tier: tier,
                          onSubscribe: () => _subscribe(tier),
                          isCurrent: p.activeTierId == tier.id,
                          busy: _busyTierId == tier.id,
                        ),
                      ),
                    ),
                  const SizedBox(height: 20),
                ],

                // Transaction history
                const WalletSectionHeader(title: 'Transactions'),
                const SizedBox(height: 8),
                if (p.transactionsState == WalletLoadState.loading)
                  const WalletLoading()
                else if (p.transactionsState == WalletLoadState.error)
                  WalletEmptyState(
                    icon: Icons.error_outline_rounded,
                    title: 'Couldn\'t load transactions',
                    subtitle: 'Check your connection and try again.',
                    action: WalletSecondaryButton(
                      label: 'Retry',
                      icon: Icons.refresh_rounded,
                      onPressed: _presenter.loadTransactions,
                    ),
                  )
                else
                  WalletTransactionList(
                    transactions: p.filteredTransactions,
                    filter: p.transactionFilter,
                    onFilterChanged: p.setTransactionFilter,
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
}
