import 'dart:async';

import 'package:flutter/material.dart';

import '../data/gift_models.dart';
import 'gift_asset_view.dart';

class GiftActivationOverlay extends StatelessWidget {
  const GiftActivationOverlay({super.key, required this.gift});

  final GiftCatalogItem gift;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: const Key('gift-activation-overlay'),
      color: const Color(0xD9000000),
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                colors: switch (gift.tier) {
                  GiftTier.basic => const [
                    Color(0x6635C6C3),
                    Colors.transparent,
                  ],
                  GiftTier.premium => const [
                    Color(0x669B8AFB),
                    Colors.transparent,
                  ],
                  GiftTier.exclusive => const [
                    Color(0x66FFD56A),
                    Colors.transparent,
                  ],
                },
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                GiftAssetView(
                  gift: gift,
                  state: GiftVisualState.send,
                  size: 250,
                ),
                const SizedBox(height: 18),
                Text(
                  gift.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> showGiftActivationOverlay(
  BuildContext context, {
  required GiftCatalogItem gift,
}) async {
  unawaited(
    Future<void>.delayed(const Duration(milliseconds: 2800), () {
      if (context.mounted &&
          Navigator.of(context, rootNavigator: true).canPop()) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    }),
  );
  await showGeneralDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (_, _, _) => GiftActivationOverlay(gift: gift),
    transitionBuilder: (_, animation, _, child) => FadeTransition(
      opacity: animation,
      child: ScaleTransition(
        scale: Tween(begin: .8, end: 1.0).animate(animation),
        child: child,
      ),
    ),
  );
}
