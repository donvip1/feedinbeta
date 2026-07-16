import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
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
