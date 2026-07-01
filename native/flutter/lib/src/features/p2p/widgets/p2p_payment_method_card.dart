import 'package:flutter/material.dart';

import '../data/p2p_models.dart';
import '../p2p_config.dart';
import '../p2p_theme.dart';
import 'p2p_common.dart';

/// Saved payout method row, ported from the web `PaymentMethodCard`. Shows the
/// bank + masked account number, a default badge, and set-default / delete
/// actions.
class P2PPaymentMethodCard extends StatelessWidget {
  const P2PPaymentMethodCard({
    super.key,
    required this.method,
    required this.onSetDefault,
    required this.onDelete,
    this.isBusy = false,
  });

  final P2PPaymentMethod method;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    final country = P2PConfig.countryByCode(method.countryCode);
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: P2PTheme.lg,
        vertical: P2PTheme.sm,
      ),
      padding: const EdgeInsets.all(P2PTheme.lg),
      decoration: BoxDecoration(
        color: P2PTheme.card,
        borderRadius: P2PTheme.cardRadius,
        border: Border.all(
          color: method.isDefault ? P2PTheme.primary : P2PTheme.border,
          width: method.isDefault ? 1.4 : 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: P2PTheme.primary.withValues(alpha: 0.12),
              borderRadius: P2PTheme.chipRadius,
            ),
            child: const Icon(
              Icons.account_balance,
              size: 20,
              color: P2PTheme.primary,
            ),
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
                        method.bankName ?? 'Bank account',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: P2PTheme.cardTitle,
                      ),
                    ),
                    if (method.isDefault) ...[
                      const SizedBox(width: 6),
                      const P2PChip(
                        label: 'Default',
                        color: P2PTheme.primary,
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                if (method.accountName != null)
                  Text(method.accountName!, style: P2PTheme.muted),
                Text(
                  method.maskedAccountNumber,
                  style: P2PTheme.muted.copyWith(
                    fontFeatures: const [],
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: P2PTheme.sm),
                Wrap(
                  spacing: P2PTheme.sm,
                  children: [
                    P2PChip(
                      label: country?.name ?? method.countryCode,
                      icon: Icons.public,
                    ),
                    if (country != null) P2PChip(label: country.currency),
                  ],
                ),
              ],
            ),
          ),
          Column(
            children: [
              if (!method.isDefault)
                IconButton(
                  tooltip: 'Set default',
                  onPressed: isBusy ? null : onSetDefault,
                  icon: const Icon(
                    Icons.star_outline,
                    size: 20,
                    color: P2PTheme.mutedForeground,
                  ),
                ),
              IconButton(
                tooltip: 'Delete',
                onPressed: isBusy ? null : onDelete,
                icon: const Icon(
                  Icons.delete_outline,
                  size: 20,
                  color: P2PTheme.danger,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
