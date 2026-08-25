import 'package:feedin/src/features/gifts/data/gift_models.dart';
import 'package:feedin/src/features/gifts/presentation/gift_activation_overlay.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('activation overlay identifies the sent gift', (tester) async {
    final gift = GiftCatalogItem(
      id: 'gift-rocket',
      key: 'galaxy-rocket',
      name: 'Galaxy Rocket',
      tier: GiftTier.exclusive,
      creditCost: 300,
      assets: GiftAssetManifest.fallback('galaxy-rocket'),
      minimumClientVersion: 1,
      displayOrder: 130,
    );

    await tester.pumpWidget(
      MaterialApp(home: GiftActivationOverlay(gift: gift)),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.byKey(const Key('gift-activation-overlay')), findsOneWidget);
    expect(find.text('Galaxy Rocket'), findsOneWidget);
  });
}
