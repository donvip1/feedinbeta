import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/create/parity/create_view_models.dart';
import 'package:feedin/src/features/create/post_draft.dart';
import 'package:feedin/src/features/feed/feed_post.dart';

void main() {
  test('composer media item keeps its filter through copyWith', () {
    const item = ComposerMediaItem(
      id: 'media-1',
      path: '/tmp/photo.jpg',
      kind: CreateMediaKind.image,
      filterId: 'warm',
    );

    final updated = item.copyWith(path: '/tmp/photo-edited.jpg');

    expect(updated.filterId, 'warm');
  });

  test('post draft preserves ordered media filter presets', () {
    const draft = PostDraft(
      id: 'draft-multi',
      content: 'Filtered gallery',
      createdAtMillis: 1,
      mediaPaths: ['/tmp/one.jpg', '/tmp/two.jpg'],
      mediaTypes: ['image', 'image'],
      mediaFilterIds: ['warm', 'cool'],
      mediaFilterId: 'warm',
    );

    final decoded = PostDraft.fromJson(draft.toJson());

    expect(decoded.mediaFilterIds, ['warm', 'cool']);
    expect(decoded.mediaFilterId, 'warm');
  });

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

  test('feed post preserves ordered and legacy media filter presets', () {
    const post = FeedPost(
      id: 'post-multi',
      userId: 'user-1',
      authorName: 'Creator',
      body: 'Filtered gallery',
      meta: '@creator',
      createdAtMillis: 1,
      mediaUrls: [
        'https://example.com/one.webp',
        'https://example.com/two.webp',
      ],
      mediaTypes: ['image', 'image'],
      mediaFilterIds: ['warm', 'cool'],
      mediaFilterId: 'warm',
    );

    final decoded = FeedPost.fromJson(post.toJson());

    expect(decoded.mediaFilterIds, ['warm', 'cool']);
    expect(decoded.mediaFilterId, 'warm');
  });
}
