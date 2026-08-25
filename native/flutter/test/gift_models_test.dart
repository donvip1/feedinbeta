import 'package:feedin/src/features/gifts/data/gift_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses tier, server price, and animation manifest', () {
    final gift = GiftCatalogItem.fromJson({
      'id': 'gift-1',
      'key': 'galaxy-rocket',
      'name': 'Galaxy Rocket',
      'tier': 'exclusive',
      'credit_cost': 300,
      'poster_url': 'procedural://galaxy-rocket/poster',
      'idle_url': 'procedural://galaxy-rocket/idle',
      'preview_url': 'procedural://galaxy-rocket/preview',
      'send_url': 'procedural://galaxy-rocket/send',
      'asset_version': 4,
      'asset_hashes': {'poster': 'abc'},
      'fallback_asset_key': 'galaxy-rocket',
    });

    expect(gift.tier, GiftTier.exclusive);
    expect(gift.creditCost, 300);
    expect(gift.assets.sendUrl, 'procedural://galaxy-rocket/send');
    expect(gift.assets.version, 4);
    expect(gift.isCompatible(clientVersion: 1), isTrue);
  });

  test('unknown tier and malformed price degrade safely', () {
    final gift = GiftCatalogItem.fromJson({
      'id': 'gift-2',
      'key': 'fallback',
      'name': 'Fallback',
      'tier': 'future',
      'credit_cost': 'bad',
    });

    expect(gift.tier, GiftTier.basic);
    expect(gift.creditCost, 0);
    expect(gift.assets.fallbackAssetKey, 'fallback');
    expect(gift.isCompatible(clientVersion: 1), isTrue);
  });

  test('maps stable send failures', () {
    expect(
      GiftFailure.fromCode('INSUFFICIENT_CREDITS'),
      isA<InsufficientCredits>(),
    );
    expect(GiftFailure.fromCode('GIFT_NOT_AVAILABLE'), isA<GiftUnavailable>());
    expect(
      GiftFailure.fromCode('POST_NOT_GIFT_ELIGIBLE'),
      isA<IneligiblePost>(),
    );
    expect(GiftFailure.fromCode('TIMEOUT_RECONCILE'), isA<GiftTimeout>());
  });

  test('parses authoritative settlement and receipt fields', () {
    final result = GiftSendResult.fromJson({
      'gift_record_id': 'gift-record-1',
      'balance_after': 70,
      'recipient_balance_after': 124,
      'notification_id': 'notification-1',
      'recipient_credit_value': 24,
      'platform_fee_credits': 6,
      'assets': {'key': 'golden-star'},
    }, giftKey: 'golden-star');

    expect(result.balanceAfter, 70);
    expect(result.recipientBalanceAfter, 124);
    expect(result.notificationId, 'notification-1');
    expect(result.recipientCreditValue, 24);
    expect(result.platformFeeCredits, 6);
  });
}
