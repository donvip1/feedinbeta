import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/feed/feed_item.dart';
import '../../features/feed/feed_post.dart';

/// One page of ranked feed from the server engine.
class FeedEngineResult {
  const FeedEngineResult({required this.items, required this.hasMore});

  final List<FeedItem> items;
  final bool hasMore;
}

/// Client for the `feed-engine` Supabase Edge Function — the same ranked,
/// de-duplicated, ad-injected feed the web app uses.
///
/// The function handles ordering (new-before-old, no-repeat per cycle),
/// personalization/ranking, and ad insertion server-side; this source just
/// invokes it (the Supabase client attaches the user's access token) and maps
/// the JSON into [FeedItem]s. It throws on any failure so the repository can
/// fall back to the plain reverse-chron path.
class FeedEngineRemoteDataSource {
  const FeedEngineRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  static const _functionName = 'feed-engine';

  Future<FeedEngineResult> fetchFeed({
    int limit = 20,
    int offset = 0,
    String mediaFilter = 'all',
    required String sessionId,
    required bool isNewSession,
  }) async {
    if (!isConfigured) {
      return const FeedEngineResult(items: [], hasMore: false);
    }

    final client = Supabase.instance.client;
    // Anonymous/demo users have no session; the engine requires auth, so let the
    // caller fall back rather than 401.
    if (client.auth.currentSession == null) {
      throw StateError('feed-engine requires an authenticated session.');
    }

    final response = await client.functions.invoke(
      _functionName,
      body: {
        'limit': limit,
        'offset': offset,
        'mediaFilter': mediaFilter,
        'includeAds': true,
        'adFrequency': 5,
        'sessionId': sessionId,
        'isNewSession': isNewSession,
      },
    );

    final data = response.data;
    if (data is! Map) {
      throw StateError('Unexpected feed-engine response: ${data.runtimeType}');
    }
    final map = Map<String, Object?>.from(data);
    final rawItems = (map['posts'] as List?) ?? const [];
    final hasMore = map['hasMore'] == true;

    final items = <FeedItem>[];
    for (final raw in rawItems) {
      if (raw is! Map) continue;
      final json = Map<String, Object?>.from(raw);
      if (FeedAd.isAdJson(json)) {
        final ad = FeedAd.fromJson(json);
        if (ad.isValid) items.add(FeedAdItem(ad));
      } else {
        items.add(FeedPostItem(_postFromEngineJson(json)));
      }
    }

    return FeedEngineResult(items: items, hasMore: hasMore);
  }

  /// Maps the engine's post JSON (snake_case, `user_id`, ISO `created_at`,
  /// nested `profiles`, `is_promoted`/`is_trending`/`is_new_post`) into the
  /// app's [FeedPost]. Mirrors the enrichment in `FeedRemoteDataSource` but for
  /// the engine's field names.
  static FeedPost _postFromEngineJson(Map<String, Object?> json) {
    final original = json['original_post'];
    final originalPost = original is Map
        ? _postFromEngineJson(Map<String, Object?>.from(original))
        : null;
    return FeedPost.fromRemoteRow(
      Map<String, dynamic>.from(json),
      originalPost: originalPost,
    );
  }
}
