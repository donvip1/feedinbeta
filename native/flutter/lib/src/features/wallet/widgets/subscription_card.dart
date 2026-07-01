import 'package:flutter/material.dart';

import '../data/wallet_models.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

/// Subscription plan card (web `wallet/SubscriptionCard.tsx`).
class WalletSubscriptionCard extends StatelessWidget {
  const WalletSubscriptionCard({
    super.key,
    required this.tier,
    required this.onSubscribe,
    this.isCurrent = false,
    this.busy = false,
  });

  final SubscriptionTier tier;
  final VoidCallback onSubscribe;
  final bool isCurrent;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final popular = tier.isPopular;
    return Container(
      width: WalletSpacing.packageCardWidth,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: popular ? WalletColors.primaryFaint : WalletColors.card,
        borderRadius: WalletRadii.card,
        border: Border.all(
          color: isCurrent
              ? WalletColors.success
              : popular
              ? WalletColors.primary
              : WalletColors.border,
          width: isCurrent || popular ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: popular
                      ? WalletColors.primarySoft
                      : WalletColors.mutedHover,
                  borderRadius: WalletRadii.tile,
                ),
                child: Icon(
                  Icons.workspace_premium_rounded,
                  size: 20,
                  color: popular
                      ? WalletColors.primary
                      : WalletColors.mutedForeground,
                ),
              ),
              const SizedBox(width: WalletSpacing.sm),
              Expanded(
                child: Text(tier.name, style: WalletTextStyles.cardTitle),
              ),
              if (popular)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    gradient: WalletGradients.action,
                    borderRadius: WalletRadii.chip,
                  ),
                  child: const Text(
                    'Most Popular',
                    style: WalletTextStyles.badge,
                  ),
                )
              else if (isCurrent)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: WalletColors.success,
                    borderRadius: WalletRadii.chip,
                  ),
                  child: const Text('Current', style: WalletTextStyles.badge),
                ),
            ],
          ),
          const SizedBox(height: WalletSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                formatMoney(tier.priceMajor, tier.currency),
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: WalletColors.foreground,
                ),
              ),
              const SizedBox(width: 4),
              const Text('/mo', style: WalletTextStyles.rowMuted),
            ],
          ),
          if (tier.description != null && tier.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(tier.description!, style: WalletTextStyles.rowMuted),
          ],
          const SizedBox(height: WalletSpacing.md),
          for (final feature in tier.features) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.check_rounded,
                    size: 16,
                    color: WalletColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(feature, style: WalletTextStyles.rowMuted),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: WalletSpacing.sm),
          if (isCurrent)
            WalletSecondaryButton(
              label: 'Current Plan',
              icon: Icons.check_circle_rounded,
              onPressed: null,
            )
          else
            WalletPrimaryButton(
              label: 'Subscribe Now',
              icon: Icons.workspace_premium_rounded,
              busy: busy,
              onPressed: onSubscribe,
            ),
        ],
      ),
    );
  }
}
