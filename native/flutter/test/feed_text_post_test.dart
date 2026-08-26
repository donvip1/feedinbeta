import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:flutter_test/flutter_test.dart';

/// The Photos tab now surfaces photo posts AND text-only posts (everything that
/// isn't a video). These getters are what `_filterPosts` keys off, so lock in
/// their classification for each post shape.
void main() {
  FeedPost post({
    List<String> urls = const [],
    List<String> types = const [],
  }) {
    return FeedPost(
      id: 'p',
      userId: 'u',
      authorName: 'A',
      body: 'hello world',
      meta: '@a',
      createdAtMillis: 1,
      mediaUrls: urls,
      mediaTypes: types,
    );
  }

  test('text-only post: isTextOnly, not photo, not video', () {
    final p = post();
    expect(p.isTextOnly, isTrue);
    expect(p.isPhotoOnly, isFalse);
    expect(p.hasVideoMedia, isFalse);
    // Photos-tab predicate is `!hasVideoMedia`, so a text post qualifies.
    expect(!p.hasVideoMedia, isTrue);
  });

  test('photo post: isPhotoOnly, not text, not video', () {
    final p = post(urls: ['https://x/a.jpg'], types: ['image']);
    expect(p.isTextOnly, isFalse);
    expect(p.isPhotoOnly, isTrue);
    expect(p.hasVideoMedia, isFalse);
    expect(!p.hasVideoMedia, isTrue); // also lands in the Photos tab
  });

  test('video post: hasVideoMedia, not text, not photo', () {
    final p = post(urls: ['https://x/a.mp4'], types: ['video']);
    expect(p.isTextOnly, isFalse);
    expect(p.isPhotoOnly, isFalse);
    expect(p.hasVideoMedia, isTrue);
    expect(!p.hasVideoMedia, isFalse); // excluded from the Photos tab
  });
}
