import 'package:flutter/material.dart';

import '../data/wallet_models.dart';
import '../wallet_presenter.dart';
import '../wallet_theme.dart';
import 'transaction_list.dart';
import 'wallet_common.dart';

class WalletHistoryTab extends StatelessWidget {
  const WalletHistoryTab({
    super.key,
    required this.state,
    required this.transactions,
    required this.filter,
    required this.onFilterChanged,
    required this.onRetry,
  });

  final WalletLoadState state;
  final List<CreditTransaction> transactions;
  final TransactionFilter filter;
  final ValueChanged<TransactionFilter> onFilterChanged;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (state == WalletLoadState.loading && transactions.isEmpty) {
      return const WalletLoading();
    }
    if (state == WalletLoadState.error && transactions.isEmpty) {
      return WalletEmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Couldn\'t load transactions',
        subtitle: 'Check your connection and try again.',
        action: WalletSecondaryButton(
          label: 'Retry',
          icon: Icons.refresh_rounded,
          onPressed: onRetry,
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const WalletSectionHeader(title: 'Transaction history'),
        const SizedBox(height: WalletSpacing.sm),
        WalletTransactionList(
          transactions: transactions,
          filter: filter,
          onFilterChanged: onFilterChanged,
        ),
      ],
    );
  }
}
