import 'package:flutter/material.dart';

import '../data/p2p_models.dart';
import '../p2p_config.dart';
import '../p2p_theme.dart';
import 'p2p_common.dart';

/// A summary row for one transaction in the "My Orders" list. Shows the
/// counterparty, amount, a status pill, and whether the user is buying/selling.
class P2PTransactionCard extends StatelessWidget {
  const P2PTransactionCard({
    super.key,
    required this.transaction,
    required this.currentUserId,
    required this.onTap,
  });

  final P2PTransaction transaction;
  final String currentUserId;
  final VoidCallback onTap;

  bool get _isBuyer => transaction.buyerId == currentUserId;

  @override
  Widget build(BuildContext context) {
    final counterparty = _isBuyer ? transaction.seller : transaction.buyer;
    final counterpartyName = counterparty?.label ?? (_isBuyer ? 'Seller' : 'Buyer');
    final country = P2PConfig.supportedCountries.firstWhere(
      (c) => c.currency == transaction.currency,
      orElse: () => const P2PCountry(
        code: '',
        name: '',
        currency: 'USD',
        symbol: '\$',
      ),
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: P2PTheme.cardRadius,
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(
            horizontal: P2PTheme.lg,
            vertical: P2PTheme.sm,
          ),
          padding: const EdgeInsets.all(P2PTheme.lg),
          decoration: BoxDecoration(
            color: P2PTheme.card,
            borderRadius: P2PTheme.cardRadius,
            border: Border.all(color: P2PTheme.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  P2PAvatar(
                    label: counterpartyName,
                    avatarUrl: counterparty?.avatarUrl,
                    size: 36,
                  ),
                  const SizedBox(width: P2PTheme.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                counterpartyName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: P2PTheme.cardTitle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            P2PChip(
                              label: _isBuyer ? 'Buying' : 'Selling',
                              color: _isBuyer
                                  ? P2PTheme.info
                                  : P2PTheme.brandPink,
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          p2pTimeAgo(transaction.createdAtMillis),
                          style: P2PTheme.meta,
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        p2pFormatInt(transaction.creditsAmount),
                        style: P2PTheme.cardTitle,
                      ),
                      Text(
                        p2pFormatMoney(
                          transaction.price,
                          symbol: country.symbol,
                        ),
                        style: P2PTheme.meta,
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: P2PTheme.md),
              Row(
                children: [
                  P2PStatusPill(status: transaction.status),
                  const Spacer(),
                  if (transaction.escrowLocked)
                    const P2PChip(
                      label: 'In escrow',
                      icon: Icons.lock_outline,
                      color: P2PTheme.success,
                    ),
                  const SizedBox(width: P2PTheme.sm),
                  const Icon(
                    Icons.chevron_right,
                    size: 18,
                    color: P2PTheme.faintForeground,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Colored pill for a transaction status label.
class P2PStatusPill extends StatelessWidget {
  const P2PStatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (color, label) = _describe(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: const BorderRadius.all(Radius.circular(999)),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          color: color,
          letterSpacing: 0.2,
        ),
      ),
    );
  }

  static (Color, String) _describe(String status) {
    switch (status) {
      case 'pending':
        return (P2PTheme.warning, 'Awaiting payment');
      case 'proof_submitted':
        return (P2PTheme.info, 'Proof submitted');
      case 'completed':
        return (P2PTheme.success, 'Completed');
      case 'disputed':
        return (P2PTheme.danger, 'Disputed');
      case 'cancelled':
        return (P2PTheme.faintForeground, 'Cancelled');
      case 'refunded':
        return (P2PTheme.faintForeground, 'Refunded');
      default:
        return (P2PTheme.mutedForeground, status.replaceAll('_', ' '));
    }
  }
}
