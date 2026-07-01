import 'package:flutter/material.dart';

import 'data/p2p_models.dart';
import 'data/p2p_remote_data_source.dart';
import 'p2p_theme.dart';
import 'screens/p2p_create_listing_sheet.dart';
import 'screens/p2p_payment_methods_screen.dart';
import 'screens/p2p_transaction_detail_screen.dart';
import 'widgets/p2p_common.dart';
import 'widgets/p2p_eligibility_banner.dart';
import 'widgets/p2p_listing_card.dart';
import 'widgets/p2p_transaction_card.dart';

/// Public entry point for the P2P credit marketplace.
///
/// A self-contained module: it owns its own [P2PRemoteDataSource] (auto-detected
/// from the Supabase singleton by default, matching the other native features)
/// and needs nothing from the host beyond an optional injected data source for
/// tests. Reachable, e.g., from a wallet/credits menu item or a bottom-nav tab.
///
/// Web mapping: this screen fuses the web P2P route surfaces — the marketplace
/// listing feed (`P2PListingCard`), the eligibility banner (`EligibilityBanner`),
/// the "Sell Credits" create flow (`CreateListingModal`), and the user's order
/// history (which links into `P2PTransactionTimeline` / `P2PChat` /
/// `P2PDisputePanel` on the detail screen).
class P2PScreen extends StatefulWidget {
  const P2PScreen({super.key, P2PRemoteDataSource? dataSource, this.onBack})
    : _injectedDataSource = dataSource;

  final P2PRemoteDataSource? _injectedDataSource;

  /// Optional back affordance. When provided (e.g. when the screen is pushed as
  /// a route from the wallet), the header renders a back button that invokes
  /// this. When null (e.g. wired as a bottom-nav tab), no back button is shown.
  final VoidCallback? onBack;

  @override
  State<P2PScreen> createState() => _P2PScreenState();
}

enum _P2PTab { marketplace, orders }

class _P2PScreenState extends State<P2PScreen> {
  late final P2PRemoteDataSource _dataSource =
      widget._injectedDataSource ?? P2PRemoteDataSource.autoDetect();

  _P2PTab _tab = _P2PTab.marketplace;

  late Future<_P2PMarketplaceData> _marketFuture;
  late Future<List<P2PTransaction>> _ordersFuture;

  String? get _currentUserId => _dataSource.currentUserId;

  @override
  void initState() {
    super.initState();
    _marketFuture = _loadMarketplace();
    _ordersFuture = _dataSource.fetchMyTransactions();
  }

  Future<_P2PMarketplaceData> _loadMarketplace() async {
    final results = await Future.wait([
      _dataSource.fetchActiveListings(),
      _dataSource.fetchEligibility(),
      _dataSource.fetchCreditBalance(),
    ]);
    return _P2PMarketplaceData(
      listings: results[0] as List<P2PListing>,
      eligibility: results[1] as P2PEligibility,
      creditBalance: results[2] as int,
    );
  }

  void _reloadMarketplace() {
    setState(() => _marketFuture = _loadMarketplace());
  }

  void _reloadOrders() {
    setState(() => _ordersFuture = _dataSource.fetchMyTransactions());
  }

  Future<void> _openCreateListing(_P2PMarketplaceData data) async {
    if (!data.eligibility.canTrade) {
      await _openPaymentMethods();
      return;
    }
    final created = await showModalBottomSheet<P2PListing>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black87,
      builder: (_) => P2PCreateListingSheet(
        dataSource: _dataSource,
        creditBalance: data.creditBalance,
        eligibility: data.eligibility,
      ),
    );
    if (created != null) _reloadMarketplace();
  }

  Future<void> _openPaymentMethods() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => P2PPaymentMethodsScreen(dataSource: _dataSource),
      ),
    );
    _reloadMarketplace();
  }

  Future<void> _buyListing(P2PListing listing) async {
    try {
      final transaction = await _dataSource.initiatePurchase(listing);
      if (!mounted) return;
      if (transaction == null) {
        _toast('Sign in to buy credits.');
        return;
      }
      _reloadOrders();
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => P2PTransactionDetailScreen(
            dataSource: _dataSource,
            transaction: transaction,
            currentUserId: _currentUserId ?? '',
          ),
        ),
      );
      _reloadMarketplace();
      _reloadOrders();
    } on P2PBackendUnavailable catch (error) {
      if (!mounted) return;
      _toast(error.message);
    } catch (_) {
      if (!mounted) return;
      _toast('Could not start this order. Please try again.');
    }
  }

  void _openTransaction(P2PTransaction transaction) {
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => P2PTransactionDetailScreen(
              dataSource: _dataSource,
              transaction: transaction,
              currentUserId: _currentUserId ?? '',
            ),
          ),
        )
        .then((_) => _reloadOrders());
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: P2PTheme.card),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: P2PTheme.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(
              onManagePayments: _openPaymentMethods,
              onBack: widget.onBack,
            ),
            _TabBar(
              tab: _tab,
              onChanged: (tab) => setState(() => _tab = tab),
            ),
            Expanded(
              child: _tab == _P2PTab.marketplace
                  ? _buildMarketplace()
                  : _buildOrders(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMarketplace() {
    return FutureBuilder<_P2PMarketplaceData>(
      future: _marketFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return P2PErrorState(
            title: 'Couldn\'t load the marketplace',
            subtitle: 'Check your connection and try again.',
            onRetry: _reloadMarketplace,
          );
        }
        final data = snapshot.data;
        if (data == null) {
          return const Center(
            child: CircularProgressIndicator(color: P2PTheme.primary),
          );
        }
        final myId = _currentUserId;
        return RefreshIndicator(
          color: P2PTheme.primary,
          backgroundColor: P2PTheme.card,
          onRefresh: () async {
            _reloadMarketplace();
            await _marketFuture;
          },
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Column(
                  children: [
                    _BalanceBanner(
                      balance: data.creditBalance,
                      onSell: () => _openCreateListing(data),
                      canSell: data.eligibility.canTrade,
                    ),
                    P2PEligibilityBanner(
                      eligibility: data.eligibility,
                      onAddPayment: _openPaymentMethods,
                    ),
                  ],
                ),
              ),
              if (data.listings.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: P2PEmptyState(
                    icon: Icons.storefront_outlined,
                    title: 'No active listings',
                    subtitle:
                        'No one is selling credits right now. Check back soon '
                        'or list your own credits for sale.',
                    action: data.eligibility.canTrade
                        ? P2PPrimaryButton(
                            label: 'Sell credits',
                            icon: Icons.sell_outlined,
                            expand: false,
                            onPressed: () => _openCreateListing(data),
                          )
                        : null,
                  ),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate((context, index) {
                    final listing = data.listings[index];
                    return P2PListingCard(
                      listing: listing,
                      isOwnListing: listing.sellerId == myId,
                      onBuy: () => _buyListing(listing),
                    );
                  }, childCount: data.listings.length),
                ),
              const SliverToBoxAdapter(child: SizedBox(height: P2PTheme.xl)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildOrders() {
    return FutureBuilder<List<P2PTransaction>>(
      future: _ordersFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return P2PErrorState(
            title: 'Couldn\'t load your orders',
            subtitle: 'Check your connection and try again.',
            onRetry: _reloadOrders,
          );
        }
        final orders = snapshot.data;
        if (orders == null) {
          return const Center(
            child: CircularProgressIndicator(color: P2PTheme.primary),
          );
        }
        if (orders.isEmpty) {
          return const P2PEmptyState(
            icon: Icons.receipt_long_outlined,
            title: 'No orders yet',
            subtitle:
                'When you buy or sell credits, your orders and their escrow '
                'status appear here.',
          );
        }
        final myId = _currentUserId ?? '';
        return RefreshIndicator(
          color: P2PTheme.primary,
          backgroundColor: P2PTheme.card,
          onRefresh: () async {
            _reloadOrders();
            await _ordersFuture;
          },
          child: ListView.builder(
            padding: const EdgeInsets.only(
              top: P2PTheme.sm,
              bottom: P2PTheme.xl,
            ),
            itemCount: orders.length,
            itemBuilder: (context, index) {
              final order = orders[index];
              return P2PTransactionCard(
                transaction: order,
                currentUserId: myId,
                onTap: () => _openTransaction(order),
              );
            },
          ),
        );
      },
    );
  }
}

/// Bundle returned by the combined marketplace load.
class _P2PMarketplaceData {
  const _P2PMarketplaceData({
    required this.listings,
    required this.eligibility,
    required this.creditBalance,
  });

  final List<P2PListing> listings;
  final P2PEligibility eligibility;
  final int creditBalance;
}

class _Header extends StatelessWidget {
  const _Header({required this.onManagePayments, this.onBack});
  final VoidCallback onManagePayments;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        onBack != null ? P2PTheme.xs : P2PTheme.lg,
        P2PTheme.md,
        P2PTheme.sm,
        P2PTheme.sm,
      ),
      child: Row(
        children: [
          if (onBack != null)
            IconButton(
              tooltip: 'Back',
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back, color: P2PTheme.foreground),
            ),
          const Expanded(child: Text('Marketplace', style: P2PTheme.screenTitle)),
          IconButton(
            tooltip: 'Payment methods',
            onPressed: onManagePayments,
            icon: const Icon(
              Icons.account_balance_outlined,
              color: P2PTheme.foreground,
            ),
          ),
        ],
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.tab, required this.onChanged});
  final _P2PTab tab;
  final ValueChanged<_P2PTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        P2PTheme.lg,
        0,
        P2PTheme.lg,
        P2PTheme.sm,
      ),
      child: Row(
        children: [
          _TabChip(
            label: 'Marketplace',
            selected: tab == _P2PTab.marketplace,
            onTap: () => onChanged(_P2PTab.marketplace),
          ),
          const SizedBox(width: P2PTheme.sm),
          _TabChip(
            label: 'My orders',
            selected: tab == _P2PTab.orders,
            onTap: () => onChanged(_P2PTab.orders),
          ),
        ],
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: const BorderRadius.all(Radius.circular(999)),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            gradient: selected ? P2PTheme.brandGradient : null,
            color: selected ? null : P2PTheme.surface,
            borderRadius: const BorderRadius.all(Radius.circular(999)),
            border: Border.all(
              color: selected ? Colors.transparent : P2PTheme.border,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: selected ? Colors.white : P2PTheme.mutedForeground,
            ),
          ),
        ),
      ),
    );
  }
}

class _BalanceBanner extends StatelessWidget {
  const _BalanceBanner({
    required this.balance,
    required this.onSell,
    required this.canSell,
  });

  final int balance;
  final VoidCallback onSell;
  final bool canSell;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(
        P2PTheme.lg,
        0,
        P2PTheme.lg,
        P2PTheme.sm,
      ),
      padding: const EdgeInsets.all(P2PTheme.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1B0E20), Color(0xFF20121A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: P2PTheme.cardRadius,
        border: Border.all(color: P2PTheme.borderStrong),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Your balance', style: P2PTheme.meta),
                const SizedBox(height: 2),
                Text(
                  '${p2pFormatInt(balance)} credits',
                  style: P2PTheme.amount.copyWith(fontSize: 24),
                ),
              ],
            ),
          ),
          P2PPrimaryButton(
            label: canSell ? 'Sell credits' : 'Set up selling',
            icon: canSell ? Icons.sell_outlined : Icons.lock_open_outlined,
            expand: false,
            onPressed: onSell,
          ),
        ],
      ),
    );
  }
}
