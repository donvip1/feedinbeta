import 'package:feedin/src/data/remote/feed_engine_remote_data_source.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('feed-engine JSON author identity mapping', () {
    test('maps flat identity fields (verified, badge tier, follow, visibility)', () {
      final post = FeedEngineRemoteDataSource.postFromEngineJsonForTest({
        'id': 'post-1',
        'user_id': 'creator-1',
        'content': 'hi',
        'created_at': '2026-08-25T00:00:00.000Z',
        'author_verified': true,
        'author_badge_tier': 'premium',
        'viewer_is_following': true,
        'visibility': 'followers',
        'profiles': {
          'username': 'creator',
          'display_name': 'Creator',
          'avatar_url': 'https://x/a.png',
        },
      });

      expect(post.isAuthorVerified, isTrue);
      expect(post.authorBadgeTier, FeedAuthorBadgeTier.premium);
      expect(post.viewerIsFollowing, isTrue);
      expect(post.visibility, FeedPostVisibility.followers);
    });

    test('falls back to profiles.is_verified and defaults tier/visibility', () {
      final post = FeedEngineRemoteDataSource.postFromEngineJsonForTest({
        'id': 'post-2',
        'user_id': 'creator-2',
        'content': 'hi',
        'created_at': '2026-08-25T00:00:00.000Z',
        'profiles': {
          'username': 'creator2',
          'display_name': 'Creator Two',
          'is_verified': true,
        },
      });

      expect(post.isAuthorVerified, isTrue);
      expect(post.authorBadgeTier, FeedAuthorBadgeTier.none);
      expect(post.viewerIsFollowing, isFalse);
      expect(post.visibility, FeedPostVisibility.public);
    });

    test('maps only_me privacy to private and pro tier', () {
      final post = FeedEngineRemoteDataSource.postFromEngineJsonForTest({
        'id': 'post-3',
        'user_id': 'creator-3',
        'content': 'hi',
        'created_at': '2026-08-25T00:00:00.000Z',
        'author_badge_tier': 'pro',
        'visibility': 'only_me',
        'profiles': {'username': 'c3'},
      });

      expect(post.authorBadgeTier, FeedAuthorBadgeTier.pro);
      expect(post.visibility, FeedPostVisibility.private);
    });
  });

  group('FeedPost identity serialization', () {
    test('round-trips identity fields through fromJson/toJson', () {
      const post = FeedPost(
        id: 'p',
        userId: 'u',
        authorName: 'A',
        body: 'b',
        meta: '@a',
        createdAtMillis: 1,
        isAuthorVerified: true,
        authorBadgeTier: FeedAuthorBadgeTier.pro,
        visibility: FeedPostVisibility.followers,
        viewerIsFollowing: true,
      );

      final restored = FeedPost.fromJson(post.toJson());

      expect(restored.isAuthorVerified, isTrue);
      expect(restored.authorBadgeTier, FeedAuthorBadgeTier.pro);
      expect(restored.visibility, FeedPostVisibility.followers);
      expect(restored.viewerIsFollowing, isTrue);
    });

    test('defaults identity fields when JSON omits them', () {
      final restored = FeedPost.fromJson(const {
        'id': 'p',
        'userId': 'u',
        'authorName': 'A',
        'body': 'b',
        'meta': '@a',
        'createdAtMillis': 1,
      });

      expect(restored.isAuthorVerified, isFalse);
      expect(restored.authorBadgeTier, FeedAuthorBadgeTier.none);
      expect(restored.visibility, FeedPostVisibility.public);
      expect(restored.viewerIsFollowing, isFalse);
    });
  });
}
