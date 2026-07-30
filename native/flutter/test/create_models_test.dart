import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/create/post_draft.dart';
import 'package:feedin/src/features/feed/feed_post.dart';

void main() {
  test('post draft preserves Camera Studio filter preset', () {
    const draft = PostDraft(
      id: 'draft-1',
      content: 'Filtered photo',
      createdAtMillis: 1,
      mediaPath: '/tmp/photo.jpg',
      mediaType: 'image',
      mediaFilterId: 'vintage',
    );

    final decoded = PostDraft.fromJson(draft.toJson());

    expect(decoded.mediaFilterId, 'vintage');
    expect(decoded.mediaPath, '/tmp/photo.jpg');
  });

  test('feed post preserves published media filter preset', () {
    const post = FeedPost(
      id: 'post-1',
      userId: 'user-1',
      authorName: 'Creator',
      body: 'Filtered photo',
      meta: '@creator',
      createdAtMillis: 1,
      mediaUrl: 'https://example.com/photo.webp',
      mediaType: 'image',
      mediaFilterId: 'cool',
    );

    final decoded = FeedPost.fromJson(post.toJson());

    expect(decoded.mediaFilterId, 'cool');
    expect(decoded.mediaUrl, post.mediaUrl);
  });
}
