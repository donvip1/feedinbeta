import 'package:flutter/material.dart';

import '../data/live_models.dart';
import '../live_theme.dart';

/// Bottom sheet for picking a gift to send in a live room, mirroring the web
/// `LiveGiftModal` gift grid. Resolves the [showLiveGiftSheet] future with the
/// chosen [LiveGiftOption], or null if dismissed.
///
/// Native has no `user_credits` balance surface wired here, so (unlike the web)
/// affordability is not gated client-side; the send path writes the gift row
/// directly (see [LiveRemoteDataSource.sendStreamGift]). The 15% platform-fee
/// copy is preserved for parity.
Future<LiveGiftOption?> showLiveGiftSheet(
  BuildContext context, {
  required String recipientName,
}) {
  return showModalBottomSheet<LiveGiftOption>(
    context: context,
    backgroundColor: LiveTheme.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(borderRadius: LiveTheme.sheetRadius),
    builder: (context) => _LiveGiftSheet(recipientName: recipientName),
  );
}

class _LiveGiftSheet extends StatelessWidget {
  const _LiveGiftSheet({required this.recipientName});

  final String recipientName;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: LiveTheme.onSurfaceFaint,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFFFFC24A), Color(0xFFFF7A45)],
                    ),
                    borderRadius: BorderRadius.all(Radius.circular(12)),
                  ),
                  child: const Icon(
                    Icons.card_giftcard_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Send a gift', style: LiveTheme.screenTitle),
                      const SizedBox(height: 2),
                      Text(
                        'To $recipientName',
                        style: LiveTheme.cardHost,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.82,
              children: [
                for (final gift in LiveGiftOption.catalog)
                  _GiftTile(
                    gift: gift,
                    onTap: () => Navigator.of(context).pop(gift),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              '15% platform fee applies. Recipient receives 85% of the amount.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: LiveTheme.onSurfaceFaint,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GiftTile extends StatelessWidget {
  const _GiftTile({required this.gift, required this.onTap});

  final LiveGiftOption gift;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: LiveTheme.surfaceRaised,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: LiveTheme.chipBorder),
        ),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(gift.emoji, style: const TextStyle(fontSize: 26)),
            const SizedBox(height: 4),
            Text(
              gift.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: LiveTheme.onSurfaceMuted,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 3),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: LiveTheme.brandPink.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '${gift.creditValue}',
                style: const TextStyle(
                  color: LiveTheme.brandPink,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
