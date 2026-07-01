import 'package:flutter/material.dart';

import '../data/wallet_models.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

/// Credit ledger with filter pills (web `wallet/TransactionList.tsx`).
class WalletTransactionList extends StatelessWidget {
  const WalletTransactionList({
    super.key,
    required this.transactions,
    required this.filter,
    required this.onFilterChanged,
  });

  final List<CreditTransaction> transactions;
  final TransactionFilter filter;
  final ValueChanged<TransactionFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final f in TransactionFilter.values) ...[
                _FilterPill(
                  label: f.label,
                  active: f == filter,
                  onTap: () => onFilterChanged(f),
                ),
                const SizedBox(width: WalletSpacing.sm),
              ],
            ],
          ),
        ),
        const SizedBox(height: WalletSpacing.md),
        if (transactions.isEmpty)
          WalletEmptyState(
            icon: Icons.receipt_long_rounded,
            title: filter == TransactionFilter.purchases
                ? 'No purchases yet'
                : 'No transactions found',
            subtitle: 'Your credit activity will appear here.',
          )
        else
          Column(
            children: [
              for (final tx in transactions) ...[
                _TransactionRow(tx: tx),
                const SizedBox(height: WalletSpacing.sm),
              ],
            ],
          ),
      ],
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.active,
    required this.onTap,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: WalletRadii.chip,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(
            color: active ? WalletColors.primary : WalletColors.mutedHover,
            borderRadius: WalletRadii.chip,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: active
                  ? WalletColors.primaryForeground
                  : WalletColors.mutedForeground,
            ),
          ),
        ),
      ),
    );
  }
}

class _TransactionRow extends StatelessWidget {
  const _TransactionRow({required this.tx});
  final CreditTransaction tx;

  @override
  Widget build(BuildContext context) {
    final isPurchase = tx.isPurchase;
    final positive = tx.amount > 0;
    final amountColor = isPurchase
        ? WalletColors.primary
        : positive
        ? WalletColors.success
        : WalletColors.destructive;
    final iconBg = isPurchase
        ? WalletColors.primarySoft
        : positive
        ? WalletColors.successFaint
        : WalletColors.destructiveFaint;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isPurchase ? WalletColors.primaryFaint : WalletColors.cardFaint,
        borderRadius: WalletRadii.inner,
        border: Border.all(
          color: isPurchase ? WalletColors.primarySoft : WalletColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(
              isPurchase
                  ? Icons.credit_card_rounded
                  : positive
                  ? Icons.south_west_rounded
                  : Icons.north_east_rounded,
              size: 17,
              color: amountColor,
            ),
          ),
          const SizedBox(width: WalletSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tx.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: WalletTextStyles.rowTitle,
                ),
                Text(
                  formatTimestamp(tx.createdAtMillis),
                  style: WalletTextStyles.rowMuted,
                ),
                if (tx.paymentReference != null &&
                    tx.paymentReference!.isNotEmpty)
                  Text(
                    'Ref: ${tx.paymentReference}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: WalletTextStyles.rowMuted.copyWith(
                      fontSize: 10,
                      color: WalletColors.mutedForeground.withValues(alpha: 0.7),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: WalletSpacing.sm),
          Text(
            '${positive ? '+' : ''}${formatCredits(tx.amount)}',
            style: WalletTextStyles.amount.copyWith(color: amountColor),
          ),
        ],
      ),
    );
  }
}
