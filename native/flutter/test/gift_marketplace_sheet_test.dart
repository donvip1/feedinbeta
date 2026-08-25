import 'dart:async';

import 'package:feedin/src/features/gifts/data/gift_models.dart';
import 'package:feedin/src/features/gifts/data/gift_repository.dart';
import 'package:feedin/src/features/gifts/presentation/gift_marketplace_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows tier panels, previews, and sends only once', (
    tester,
  ) async {
    final repository = _FakeGiftRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showGiftMarketplaceSheet(
                context,
                postId: 'post-1',
                repository: repository,
                playActivation: false,
              ),
              child: const Text('Gift'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Gift'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Basic'), findsOneWidget);
    expect(find.text('Premium'), findsOneWidget);
    expect(find.text('Exclusive'), findsOneWidget);
    expect(find.text('Pulse Heart'), findsOneWidget);
    expect(find.text('10'), findsWidgets);

    await tester.tap(find.byKey(const Key('gift-card-pulse-heart')));
    await tester.pump();
    await tester.tap(find.byKey(const Key('gift-send-button')));
    await tester.tap(find.byKey(const Key('gift-send-button')));
    await tester.pump();
    expect(repository.sendCount, 1);
    repository.completeSend();
    await tester.pump(const Duration(milliseconds: 350));

    expect(repository.sendCount, 1);
    expect(repository.lastPostId, 'post-1');
  });
}

class _FakeGiftRepository implements GiftRepository {
  int sendCount = 0;
  String? lastPostId;
  final _sendCompleter = Completer<GiftSendResult>();

  final gift = GiftCatalogItem(
    id: 'gift-1',
    key: 'pulse-heart',
    name: 'Pulse Heart',
    tier: GiftTier.basic,
    creditCost: 10,
    assets: GiftAssetManifest.fallback('pulse-heart'),
    minimumClientVersion: 1,
    displayOrder: 10,
  );

  @override
  Future<List<GiftCatalogItem>> fetchPostGifts() async => [gift];

  @override
  Future<GiftSendResult> sendPostGift({
    required String giftId,
    required String postId,
    required String idempotencyKey,
  }) async {
    sendCount++;
    lastPostId = postId;
    return _sendCompleter.future;
  }

  void completeSend() => _sendCompleter.complete(
    GiftSendResult(
      giftRecordId: 'sent-1',
      balanceAfter: 90,
      recipientBalanceAfter: 108,
      notificationId: 'notification-1',
      recipientCreditValue: 8,
      platformFeeCredits: 2,
      assets: gift.assets,
    ),
  );
}
