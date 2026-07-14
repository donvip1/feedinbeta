import 'package:flutter/material.dart';

import '../data/wallet_models.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

/// Hero balance card (web `wallet/BalanceCard.tsx`).
///
/// Shows the big credit balance, its ≈USD value, lifetime in/out stats, an
/// optional current-tier label, and the three primary actions (Send / Buy /
/// Withdraw). Rendered on a brand gradient to match the dark-premium look.
class WalletBalanceCard extends StatelessWidget {
  const WalletBalanceCard({
    super.key,
    required this.balance,
    required this.onSend,
    required this.onBuy,
    this.onWithdraw,
    this.tierName,
  });

  final CreditBalance balance;
  final VoidCallback onSend;
  final VoidCallback onBuy;
  final VoidCallback? onWithdraw;
  final String? tierName;

  @override
  Widget build(BuildContext context) {
    return WalletCard(
      gradient: WalletGradients.balance,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'BALANCE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: Color(0xCCFFFFFF),
                  ),
                ),
              ),
              if (tierName != null && tierName!.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x33FFFFFF),
                    borderRadius: WalletRadii.chip,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.workspace_premium_rounded,
                        size: 13,
                        color: WalletColors.primaryForeground,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        tierName!,
                        style: WalletTextStyles.badge.copyWith(fontSize: 11),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: WalletSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Icon(
                Icons.monetization_on_rounded,
                color: WalletColors.primaryForeground,
                size: 30,
              ),
              const SizedBox(width: 8),
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    formatCredits(balance.balance),
                    style: WalletTextStyles.balanceValue,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '≈ ${formatMoney(balance.approxUsd, 'USD')}',
            style: WalletTextStyles.balanceSub,
          ),
          const SizedBox(height: WalletSpacing.lg),
          Row(
            children: [
              _Stat(
                label: 'In',
                value: '+${formatCredits(balance.lifetimeEarned)}',
              ),
              const SizedBox(width: WalletSpacing.xl),
              _Stat(
                label: 'Out',
                value: '−${formatCredits(balance.lifetimeSpent)}',
              ),
            ],
          ),
          const SizedBox(height: WalletSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _GhostAction(
                  icon: Icons.send_rounded,
                  label: 'Send',
                  onTap: onSend,
                ),
              ),
              const SizedBox(width: WalletSpacing.sm),
              Expanded(
                child: _GhostAction(
                  icon: Icons.credit_card_rounded,
                  label: 'Buy',
                  filled: true,
                  onTap: onBuy,
                ),
              ),
              if (onWithdraw != null) ...[
                const SizedBox(width: WalletSpacing.sm),
                Expanded(
                  child: _GhostAction(
                    icon: Icons.account_balance_rounded,
                    label: 'Payout',
                    onTap: onWithdraw!,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          '$label ',
          style: const TextStyle(fontSize: 13, color: Color(0xCCFFFFFF)),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: WalletColors.primaryForeground,
          ),
        ),
      ],
    );
  }
}

class _GhostAction extends StatelessWidget {
  const _GhostAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: WalletRadii.inner,
        onTap: onTap,
        child: Container(
          height: 40,
          decoration: BoxDecoration(
            color: filled
                ? WalletColors.primaryForeground
                : const Color(0x1FFFFFFF),
            borderRadius: WalletRadii.inner,
            border: filled ? null : Border.all(color: const Color(0x33FFFFFF)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: filled
                    ? WalletColors.primary
                    : WalletColors.primaryForeground,
              ),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: filled
                        ? WalletColors.primary
                        : WalletColors.primaryForeground,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
