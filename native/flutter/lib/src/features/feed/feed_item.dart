import 'feed_post.dart';

/// A single item in the ranked feed returned by the server `feed-engine`: either
/// an organic post or an injected sponsored ad. The immersive pager renders each
/// variant with a different card.
sealed class FeedItem {
  const FeedItem();

  /// Stable key for widget identity / dedupe.
  String get key;
}

/// An organic post item wrapping the existing [FeedPost] model.
class FeedPostItem extends FeedItem {
  const FeedPostItem(this.post);

  final FeedPost post;

  @override
  String get key => 'post-${post.id}';
}

/// An injected sponsored ad item.
class FeedAdItem extends FeedItem {
  const FeedAdItem(this.ad);

  final FeedAd ad;

  @override
  String get key => 'ad-${ad.adId}';
}

/// A sponsored ad served by `feed-engine` (`insert_ads` → `feed_ads`). Mirrors
/// the web `FeedAd` shape (`useFeedEngine.tsx`).
class FeedAd {
  const FeedAd({
    required this.adId,
    required this.title,
    required this.mediaUrl,
    this.description,
    this.mediaType = 'image',
    this.clickUrl,
    this.advertiserName,
  });

  final String adId;
  final String title;
  final String mediaUrl;
  final String? description;
  final String mediaType;
  final String? clickUrl;
  final String? advertiserName;

  /// The engine tags ad items with `"is_ad": true`; everything else is a post.
  static bool isAdJson(Map<String, Object?> json) => json['is_ad'] == true;

  factory FeedAd.fromJson(Map<String, Object?> json) {
    String? text(String key) {
      final value = json[key]?.toString();
      return (value != null && value.isNotEmpty) ? value : null;
    }

    return FeedAd(
      adId: json['ad_id']?.toString() ?? '',
      title: text('title') ?? 'Sponsored',
      mediaUrl: json['media_url']?.toString() ?? '',
      description: text('description'),
      mediaType: text('media_type') ?? 'image',
      clickUrl: text('click_url'),
      advertiserName: text('advertiser_name'),
    );
  }

  bool get isValid => adId.isNotEmpty && mediaUrl.isNotEmpty;
}
