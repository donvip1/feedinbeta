import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps versioned feed identity fields from a remote row', () {
    final post = FeedPost.fromRemoteRow({
      'id': 'post-1',
      'user_id': 'user-1',
      'content': 'Hello',
      'created_at': '2026-08-14T12:00:00Z',
      'author_display_name': 'Ada',
      'author_username': 'ada',
      'author_avatar_url': 'https://example.com/ada.webp',
      'author_verified': true,
      'author_badge_tier': 'premium',
      'visibility': 'followers',
      'viewer_is_following': true,
      'comments_count': 7,
      'media_urls': ['photo.webp'],
      'media_types': ['image'],
    });

    expect(post.authorName, 'Ada');
    expect(post.authorHandle, '@ada');
    expect(post.isAuthorVerified, isTrue);
    expect(post.authorBadgeTier, FeedAuthorBadgeTier.premium);
    expect(post.visibility, FeedPostVisibility.followers);
    expect(post.viewerIsFollowing, isTrue);
    expect(post.commentsCount, 7);
    expect(post.isPhotoOnly, isTrue);
  });

  test('maps the nested profile shape returned by feed-engine', () {
    final post = FeedPost.fromRemoteRow({
      'id': 'post-engine',
      'user_id': 'user-engine',
      'created_at': '2026-08-14T12:00:00Z',
      'profiles': {
        'display_name': 'Engine Creator',
        'username': 'engine_creator',
        'avatar_url': 'https://example.com/engine.webp',
        'is_verified': true,
        'plan_tier': 'pro',
      },
      'privacy': 'only_me',
    });

    expect(post.authorName, 'Engine Creator');
    expect(post.authorHandle, '@engine_creator');
    expect(post.isAuthorVerified, isTrue);
    expect(post.authorBadgeTier, FeedAuthorBadgeTier.pro);
    expect(post.visibility, FeedPostVisibility.private);
  });

  test('unknown optional identity values degrade safely', () {
    final post = FeedPost.fromRemoteRow({
      'id': 'post-2',
      'user_id': 'user-2',
      'created_at': 'invalid',
      'author_username': 'user',
      'author_badge_tier': 'unknown',
      'visibility': 'unknown',
    });

    expect(post.authorName, 'user');
    expect(post.authorBadgeTier, FeedAuthorBadgeTier.none);
    expect(post.visibility, FeedPostVisibility.public);
  });
}
