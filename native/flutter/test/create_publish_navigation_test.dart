import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/feed/feed_item.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/feed_shell.dart';

void main() {
  test('published video selects Videos and its filtered index', () {
    final items = [
      FeedPostItem(_post('photo', type: 'image')),
      FeedPostItem(_post('video', type: 'video')),
    ];

    final placement = locatePublishedPost(items, 'video');

    expect(placement.tabIndex, 0);
    expect(placement.pageIndex, 0);
    expect(placement.found, isTrue);
  });

  test('published photo selects Photos and its filtered index', () {
    final items = [
      FeedPostItem(_post('video', type: 'video')),
      FeedPostItem(_post('photo-1', type: 'image')),
      FeedPostItem(_post('photo-2', type: 'image')),
    ];

    final placement = locatePublishedPost(items, 'photo-2');

    expect(placement.tabIndex, 1);
    expect(placement.pageIndex, 1);
    expect(placement.found, isTrue);
  });

  test('missing published post falls back to Videos page zero', () {
    final placement = locatePublishedPost(const [], 'missing');

    expect(placement.tabIndex, 0);
    expect(placement.pageIndex, 0);
    expect(placement.found, isFalse);
  });
}

FeedPost _post(String id, {required String type}) => FeedPost(
  id: id,
  userId: 'u',
  authorName: 'A',
  body: '',
  meta: '',
  createdAtMillis: 1,
  mediaUrl: '$id.media',
  mediaType: type,
);
