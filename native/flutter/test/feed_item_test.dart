import 'package:feedin/src/features/feed/feed_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FeedAd.isAdJson', () {
    test('detects ad items by the is_ad discriminator', () {
      expect(FeedAd.isAdJson({'is_ad': true, 'ad_id': 'a1'}), isTrue);
    });

    test('treats posts (no is_ad / false) as not ads', () {
      expect(FeedAd.isAdJson({'id': 'p1'}), isFalse);
      expect(FeedAd.isAdJson({'is_ad': false, 'id': 'p1'}), isFalse);
    });
  });

  group('FeedAd.fromJson', () {
    test('maps the engine ad shape', () {
      final ad = FeedAd.fromJson({
        'is_ad': true,
        'ad_id': 'ad-123',
        'title': 'Big Sale',
        'description': 'Half off everything',
        'media_url': 'https://cdn/ad.jpg',
        'media_type': 'image',
        'click_url': 'https://brand.example',
        'advertiser_name': 'BrandCo',
      });
      expect(ad.adId, 'ad-123');
      expect(ad.title, 'Big Sale');
      expect(ad.mediaUrl, 'https://cdn/ad.jpg');
      expect(ad.clickUrl, 'https://brand.example');
      expect(ad.advertiserName, 'BrandCo');
      expect(ad.isValid, isTrue);
    });

    test('falls back to a Sponsored title and is invalid without media', () {
      final ad = FeedAd.fromJson({'is_ad': true, 'ad_id': 'ad-1'});
      expect(ad.title, 'Sponsored');
      expect(ad.isValid, isFalse); // no media_url
    });
  });

  group('FeedItem keys', () {
    test('post and ad items have distinct, stable keys', () {
      const post = FeedAd(adId: 'x', title: 't', mediaUrl: 'm');
      expect(FeedAdItem(post).key, 'ad-x');
    });
  });
}
