import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('normalizes image-only multi-media posts', () {
    const post = FeedPost(
      id: 'photos',
      userId: 'u',
      authorName: 'A',
      body: '',
      meta: '',
      createdAtMillis: 1,
      mediaUrls: ['one.jpg', 'two.jpg'],
      mediaTypes: ['image', 'image'],
      mediaFilterIds: ['warm', 'cool'],
    );

    expect(post.normalizedMedia.map((item) => item.filterId), ['warm', 'cool']);
    expect(post.isPhotoOnly, isTrue);
    expect(post.hasVideoMedia, isFalse);
  });

  test('classifies video-only and mixed posts outside Photos', () {
    const video = FeedPost(
      id: 'video',
      userId: 'u',
      authorName: 'A',
      body: '',
      meta: '',
      createdAtMillis: 1,
      mediaUrl: 'clip.mp4',
      mediaType: 'video',
    );
    const mixed = FeedPost(
      id: 'mixed',
      userId: 'u',
      authorName: 'A',
      body: '',
      meta: '',
      createdAtMillis: 1,
      mediaUrls: ['one.jpg', 'clip.mp4'],
      mediaTypes: ['image', 'video'],
      mediaFilterIds: ['cool', 'original'],
    );

    expect(video.hasVideoMedia, isTrue);
    expect(video.isPhotoOnly, isFalse);
    expect(mixed.hasVideoMedia, isTrue);
    expect(mixed.isPhotoOnly, isFalse);
  });

  test('legacy singular media and filter normalize together', () {
    const post = FeedPost(
      id: 'legacy',
      userId: 'u',
      authorName: 'A',
      body: '',
      meta: '',
      createdAtMillis: 1,
      mediaUrl: 'one.jpg',
      mediaType: 'image',
      mediaFilterId: 'vintage',
    );

    expect(post.normalizedMedia.single.url, 'one.jpg');
    expect(post.normalizedMedia.single.filterId, 'vintage');
    expect(post.isPhotoOnly, isTrue);
  });

  test(
    'refeed serialization preserves original post and viewer engagement',
    () {
      const original = FeedPost(
        id: 'original',
        userId: 'author',
        authorName: 'Original Author',
        body: 'Original caption',
        meta: '@original',
        createdAtMillis: 10,
        mediaUrl: 'https://example.com/photo.jpg',
        mediaType: 'image',
      );
      const refeed = FeedPost(
        id: 'refeed',
        userId: 'sharer',
        authorName: 'Sharer',
        body: '',
        meta: '@sharer',
        createdAtMillis: 20,
        postType: 'refeed',
        originalPostId: 'original',
        originalPost: original,
        viewerHasLiked: true,
        viewerHasSaved: true,
        viewerHasRefeeded: true,
      );

      final decoded = FeedPost.fromJson(refeed.toJson());

      expect(decoded.originalPostId, 'original');
      expect(decoded.displayedPost.id, 'original');
      expect(decoded.displayedPost.mediaType, 'image');
      expect(decoded.viewerHasLiked, isTrue);
      expect(decoded.viewerHasSaved, isTrue);
      expect(decoded.viewerHasRefeeded, isTrue);
    },
  );
}
