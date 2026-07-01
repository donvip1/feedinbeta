import 'package:flutter/material.dart';

import '../data/p2p_models.dart';
import '../p2p_config.dart';
import '../p2p_theme.dart';
import 'p2p_common.dart';

/// Marketplace listing row. Mirrors the web `P2PListingCard`: seller + amount +
/// local price header, a meta row (rate / escrow), and a Buy action that is
/// disabled for the user's own listing.
class P2PListingCard extends StatelessWidget {
  const P2PListingCard({
    super.key,
    required this.listing,
    required this.isOwnListing,
    required this.onBuy,
    this.isProcessing = false,
  });

  final P2PListing listing;
  final bool isOwnListing;
  final VoidCallback onBuy;
  final bool isProcessing;

  @override
  Widget build(BuildContext context) {
    final country = P2PConfig.supportedCountries.firstWhere(
      (c) => c.currency == listing.currency,
      orElse: () => const P2PCountry(
        code: '',
        name: '',
        currency: 'USD',
        symbol: '\$',
      ),
    );
    final sellerName = listing.seller?.label ?? 'Seller';

    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: P2PTheme.lg,
        vertical: P2PTheme.sm,
      ),
      padding: const EdgeInsets.all(P2PTheme.lg),
      decoration: BoxDecoration(
        color: P2PTheme.card,
        borderRadius: P2PTheme.cardRadius,
        border: Border.all(color: P2PTheme.border),
        boxShadow: P2PTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              P2PAvatar(
                label: sellerName,
                avatarUrl: listing.seller?.avatarUrl,
                size: 40,
              ),
              const SizedBox(width: P2PTheme.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sellerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: P2PTheme.cardTitle,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      p2pTimeAgo(listing.createdAtMillis),
                      style: P2PTheme.meta,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    p2pFormatInt(listing.creditsAmount),
                    style: P2PTheme.amount,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    p2pFormatMoney(listing.price, symbol: country.symbol),
                    style: P2PTheme.muted,
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: P2PTheme.md),
          Wrap(
            spacing: P2PTheme.sm,
            runSpacing: P2PTheme.xs,
            children: [
              if (listing.creditsPerUnit > 0)
                P2PChip(
                  label:
                      '${p2pFormatInt(listing.creditsPerUnit)}/${country.symbol.isEmpty ? '\$' : country.symbol} rate',
                ),
              P2PChip(label: listing.currency, icon: Icons.public),
              const P2PChip(
                label: 'Escrow',
                icon: Icons.lock_outline,
                color: P2PTheme.success,
              ),
            ],
          ),
          const SizedBox(height: P2PTheme.md),
          SizedBox(
            width: double.infinity,
            child: _BuyButton(
              isOwnListing: isOwnListing,
              isProcessing: isProcessing,
              onBuy: onBuy,
            ),
          ),
        ],
      ),
    );
  }
}

class _BuyButton extends StatelessWidget {
  const _BuyButton({
    required this.isOwnListing,
    required this.isProcessing,
    required this.onBuy,
  });

  final bool isOwnListing;
  final bool isProcessing;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    if (isOwnListing) {
      return Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: P2PTheme.surface,
          borderRadius: P2PTheme.chipRadius,
          border: Border.all(color: P2PTheme.border),
        ),
        child: const Text(
          'Your listing',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: P2PTheme.mutedForeground,
          ),
        ),
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: P2PTheme.chipRadius,
        onTap: isProcessing ? null : onBuy,
        child: Container(
          height: 40,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            gradient: P2PTheme.brandGradient,
            borderRadius: P2PTheme.chipRadius,
          ),
          child: isProcessing
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text(
                  'Buy',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
        ),
      ),
    );
  }
}
