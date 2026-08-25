import 'package:flutter/material.dart';

import '../data/wallet_gift_models.dart';
import '../wallet_presenter.dart';
import '../wallet_theme.dart';
import 'wallet_common.dart';

class WalletGiftsTab extends StatelessWidget {
  const WalletGiftsTab({
    super.key,
    required this.state,
    required this.received,
    required this.sent,
    required this.onRefresh,
  });

  final WalletLoadState state;
  final List<WalletGiftReceipt> received;
  final List<WalletGiftReceipt> sent;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    if (state == WalletLoadState.loading && received.isEmpty && sent.isEmpty) {
      return const WalletLoading();
    }
    if (state == WalletLoadState.error && received.isEmpty && sent.isEmpty) {
      return WalletEmptyState(
        icon: Icons.card_giftcard_rounded,
        title: 'Couldn\'t load gifts',
        subtitle: 'Check your connection and try again.',
        action: WalletSecondaryButton(
          label: 'Retry',
          icon: Icons.refresh_rounded,
          onPressed: onRefresh,
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const WalletSectionHeader(title: 'Received gifts'),
        const SizedBox(height: WalletSpacing.sm),
        if (received.isEmpty)
          const WalletEmptyState(
            icon: Icons.redeem_rounded,
            title: 'No gifts received yet',
            subtitle: 'Gifts from your posts and reels will appear here.',
          )
        else
          for (final gift in received) ...[
            _GiftRow(gift: gift, received: true),
            const SizedBox(height: WalletSpacing.sm),
          ],
        const SizedBox(height: WalletSpacing.lg),
        const WalletSectionHeader(title: 'Sent gifts'),
        const SizedBox(height: WalletSpacing.sm),
        if (sent.isEmpty)
          const WalletEmptyState(
            icon: Icons.send_rounded,
            title: 'No gifts sent yet',
            subtitle: 'Gifts you send to creators will appear here.',
          )
        else
          for (final gift in sent) ...[
            _GiftRow(gift: gift, received: false),
            const SizedBox(height: WalletSpacing.sm),
          ],
      ],
    );
  }
}

class _GiftRow extends StatelessWidget {
  const _GiftRow({required this.gift, required this.received});

  final WalletGiftReceipt gift;
  final bool received;

  @override
  Widget build(BuildContext context) {
    final refunded = gift.state == WalletGiftState.refunded;
    return WalletCard(
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: WalletColors.tokenFaint,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.auto_awesome_rounded,
              color: WalletColors.token,
            ),
          ),
          const SizedBox(width: WalletSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(gift.giftName, style: WalletTextStyles.rowTitle),
                Text(
                  received
                      ? 'From ${gift.senderLabel}'
                      : 'To ${gift.recipientLabel}',
                  style: WalletTextStyles.rowMuted,
                ),
                Text(
                  _timestamp(gift.createdAtMillis),
                  style: WalletTextStyles.rowMuted.copyWith(fontSize: 11),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                received
                    ? '+${gift.recipientCredits}'
                    : '-${gift.grossCredits}',
                style: WalletTextStyles.amount.copyWith(
                  color: received
                      ? WalletColors.success
                      : WalletColors.destructive,
                ),
              ),
              Text(
                refunded ? 'Refunded' : 'Converted',
                style: WalletTextStyles.rowMuted.copyWith(fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _timestamp(int millis) {
  if (millis <= 0) return 'Recently';
  final value = DateTime.fromMillisecondsSinceEpoch(millis).toLocal();
  return '${value.day}/${value.month}/${value.year}';
}
