import 'package:flutter/material.dart';

import '../data/p2p_models.dart';
import '../p2p_theme.dart';
import 'p2p_common.dart';

/// Compact eligibility summary shown at the top of the marketplace. Mirrors the
/// web `EligibilityBanner`: a "ready to trade" state or a "complete setup"
/// checklist with the reasons the user cannot yet sell.
class P2PEligibilityBanner extends StatelessWidget {
  const P2PEligibilityBanner({
    super.key,
    required this.eligibility,
    this.onAddPayment,
  });

  final P2PEligibility eligibility;
  final VoidCallback? onAddPayment;

  @override
  Widget build(BuildContext context) {
    if (eligibility.canTrade) {
      return Container(
        margin: const EdgeInsets.fromLTRB(
          P2PTheme.lg,
          0,
          P2PTheme.lg,
          P2PTheme.sm,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: P2PTheme.lg,
          vertical: P2PTheme.md,
        ),
        decoration: BoxDecoration(
          color: P2PTheme.card,
          borderRadius: P2PTheme.chipRadius,
          border: Border.all(color: P2PTheme.border),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.verified_outlined,
              size: 18,
              color: P2PTheme.success,
            ),
            const SizedBox(width: P2PTheme.sm),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(
                      text: 'Ready to trade',
                      style: TextStyle(
                        color: P2PTheme.foreground,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    TextSpan(
                      text: '  ·  Min ${eligibility.minTradeAmount}',
                      style: const TextStyle(
                        color: P2PTheme.mutedForeground,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (eligibility.completedTrades > 0)
              Text(
                '${eligibility.completedTrades} trades',
                style: P2PTheme.meta,
              ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(
        P2PTheme.lg,
        0,
        P2PTheme.lg,
        P2PTheme.sm,
      ),
      padding: const EdgeInsets.all(P2PTheme.lg),
      decoration: BoxDecoration(
        color: P2PTheme.card,
        borderRadius: P2PTheme.chipRadius,
        border: Border.all(color: P2PTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Complete setup to trade', style: P2PTheme.cardTitle),
          const SizedBox(height: P2PTheme.sm),
          ...eligibility.reasons.map(
            (reason) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 6, right: 8),
                    width: 5,
                    height: 5,
                    decoration: const BoxDecoration(
                      color: P2PTheme.warning,
                      shape: BoxShape.circle,
                    ),
                  ),
                  Expanded(child: Text(reason, style: P2PTheme.muted)),
                ],
              ),
            ),
          ),
          if (eligibility.requiresPaymentSetup && onAddPayment != null) ...[
            const SizedBox(height: P2PTheme.sm),
            P2PPrimaryButton(
              label: 'Add payment method',
              icon: Icons.add_card_outlined,
              expand: false,
              onPressed: onAddPayment,
            ),
          ],
        ],
      ),
    );
  }
}
