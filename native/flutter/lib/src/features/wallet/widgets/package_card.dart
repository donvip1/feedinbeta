import 'package:flutter/material.dart';

import '../data/currency_models.dart';
import '../data/wallet_models.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

/// Purchasable credit-package card (web `wallet/PackageCard.tsx`).
///
/// Renders the package name, the total credits (base + bonus), price + per-credit
/// tag, a bonus badge, a tier accent (starter / pro / premium / reseller), and a
/// "Buy Now" CTA that starts the server-owned checkout.
class WalletPackageCard extends StatelessWidget {
  const WalletPackageCard({
    super.key,
    required this.package,
    required this.onPurchase,
    required this.displayPrice,
    this.busy = false,
  });

  final CreditPackage package;
  final VoidCallback onPurchase;
  final CurrencyDisplayPrice displayPrice;
  final bool busy;

  /// Default "use credits for" perks (mirrors the web `DEFAULT_CREDIT_FEATURES`
  /// fallback). Purely presentational — the live `credit_packages` table has no
  /// per-package feature list, so we show the standard credit uses.
  static const List<(IconData, String)> _defaultFeatures = [
    (Icons.image_rounded, 'AI Image Generation'),
    (Icons.chat_bubble_rounded, 'AI Chat & Writing'),
    (Icons.card_giftcard_rounded, 'Send Gifts to Creators'),
    (Icons.trending_up_rounded, 'Promote Your Posts'),
  ];

  Gradient? get _accentGradient {
    if (package.isReseller) return WalletGradients.reseller;
    if (package.isPremium) return WalletGradients.premium;
    return null;
  }

  Color get _accentColor {
    if (package.isReseller) return WalletColors.tierReseller;
    if (package.isPremium) return WalletColors.tierPremium;
    if (package.isPopular) return WalletColors.tierPro;
    return WalletColors.mutedForeground;
  }

  @override
  Widget build(BuildContext context) {
    final symbol = currencySymbol(package.currency);
    final perCreditText = '$symbol${package.pricePerCredit.toStringAsFixed(4)}';

    return Container(
      width: WalletSpacing.packageCardWidth,
      decoration: BoxDecoration(
        color: WalletColors.card,
        borderRadius: WalletRadii.card,
        border: Border.all(
          color: _accentColor.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Badge row (popular / premium / reseller + bonus).
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                if (package.isPopular ||
                    package.isPremium ||
                    package.isReseller)
                  _Pill(
                    label: package.isReseller
                        ? 'For Resellers'
                        : package.isPremium
                        ? 'Best Value'
                        : 'Popular',
                    icon: Icons.auto_awesome_rounded,
                    gradient: _accentGradient ?? WalletGradients.action,
                  ),
                const Spacer(),
                if (package.bonusPercent > 0)
                  _Pill(
                    label: '+${package.bonusPercent}% Bonus',
                    icon: Icons.card_giftcard_rounded,
                    gradient: WalletGradients.bonus,
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: _accentColor.withValues(alpha: 0.16),
                        borderRadius: WalletRadii.inner,
                      ),
                      child: Icon(
                        package.isReseller
                            ? Icons.groups_rounded
                            : package.isPremium
                            ? Icons.workspace_premium_rounded
                            : package.isPopular
                            ? Icons.star_rounded
                            : Icons.bolt_rounded,
                        color: _accentColor,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: WalletSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(package.name, style: WalletTextStyles.cardTitle),
                          Text(
                            package.isReseller
                                ? 'Bulk purchase for resale'
                                : 'One-time purchase',
                            style: WalletTextStyles.rowMuted,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: WalletSpacing.md),
                // Credits block.
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: WalletColors.background,
                    borderRadius: WalletRadii.inner,
                    border: Border.all(color: WalletColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            formatCredits(package.totalCredits),
                            style: WalletTextStyles.packageCredits,
                          ),
                          const SizedBox(width: 6),
                          const Text(
                            'credits',
                            style: WalletTextStyles.rowMuted,
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Text(
                            'Base ${formatCredits(package.credits)}',
                            style: WalletTextStyles.rowMuted,
                          ),
                          if (package.bonusCredits > 0) ...[
                            const SizedBox(width: WalletSpacing.md),
                            Icon(
                              Icons.card_giftcard_rounded,
                              size: 12,
                              color: WalletColors.success,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '+${formatCredits(package.bonusCredits)} bonus',
                              style: WalletTextStyles.rowMuted.copyWith(
                                color: WalletColors.success,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: WalletSpacing.md),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          displayPrice.primaryLabel,
                          style: WalletTextStyles.price,
                        ),
                        Text(
                          displayPrice.canonicalLabel ?? package.currency,
                          style: WalletTextStyles.rowMuted.copyWith(
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(perCreditText, style: WalletTextStyles.rowTitle),
                        Text(
                          'per credit',
                          style: WalletTextStyles.rowMuted.copyWith(
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: WalletSpacing.md),
                // "Use credits for" perks (web PackageCard features list).
                const Divider(color: WalletColors.border, height: 1),
                const SizedBox(height: WalletSpacing.md),
                Text(
                  'USE CREDITS FOR',
                  style: WalletTextStyles.rowMuted.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    for (final (icon, label) in _defaultFeatures)
                      SizedBox(
                        width: (WalletSpacing.packageCardWidth - 32 - 12) / 2,
                        child: Row(
                          children: [
                            const Icon(
                              Icons.check_rounded,
                              size: 13,
                              color: WalletColors.success,
                            ),
                            const SizedBox(width: 5),
                            Icon(
                              icon,
                              size: 13,
                              color: WalletColors.mutedForeground,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                label,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: WalletTextStyles.rowMuted.copyWith(
                                  fontSize: 11.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                if (package.isReseller) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(
                        Icons.check_rounded,
                        size: 13,
                        color: WalletColors.tierReseller,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Eligible for P2P reselling',
                        style: WalletTextStyles.rowMuted.copyWith(
                          fontSize: 11.5,
                          color: WalletColors.tierReseller,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: WalletSpacing.lg),
                WalletPrimaryButton(
                  label: 'Buy Now',
                  icon: Icons.shopping_cart_checkout_rounded,
                  busy: busy,
                  gradient: _accentGradient ?? WalletGradients.action,
                  onPressed: onPurchase,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.icon,
    required this.gradient,
  });
  final String label;
  final IconData icon;
  final Gradient gradient;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: WalletRadii.chip,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: WalletColors.primaryForeground),
          const SizedBox(width: 4),
          Text(label, style: WalletTextStyles.badge),
        ],
      ),
    );
  }
}
