import 'package:feedin/src/data/remote/post_views_remote_data_source.dart';
import 'package:feedin/src/features/profile/parity/profile_presenter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ProfilePresenter.viewHistory', () {
    test('loading state renders the skeleton, not empty', () {
      const view = ProfilePresenter.viewHistoryLoading;
      expect(view.isLoading, isTrue);
      expect(view.isEmpty, isFalse);
    });

    test('maps ViewedPost rows into rows with author + caption', () {
      final view = ProfilePresenter.viewHistoryLoaded(const [
        ViewedPost(
          postId: 'post-1',
          viewedAtMillis: 1700000000000,
          content: 'Hello world',
          mediaUrl: 'https://cdn.example/post-1.jpg',
          authorId: 'author-1',
          authorName: 'Ada Lovelace',
          authorUsername: 'ada',
          authorAvatarUrl: 'https://cdn.example/ada.jpg',
        ),
      ]);

      expect(view.isLoading, isFalse);
      expect(view.items, hasLength(1));
      expect(view.canClear, isTrue);

      final item = view.items.single;
      expect(item.postId, 'post-1');
      expect(item.viewedAtMillis, 1700000000000);
      expect(item.contentOrFallback, 'Hello world');
      expect(item.mediaUrl, 'https://cdn.example/post-1.jpg');
      expect(item.author?.id, 'author-1');
      expect(item.author?.nameOrFallback, 'Ada Lovelace');
      expect(item.author?.usernameOrFallback, 'ada');
    });

    test('empty history suppresses the clear control', () {
      final view = ProfilePresenter.viewHistoryLoaded(const []);
      expect(view.isEmpty, isTrue);
      expect(view.canClear, isFalse);
    });

    test('captionless rows fall back to the No caption placeholder', () {
      final view = ProfilePresenter.viewHistoryLoaded(const [
        ViewedPost(postId: 'post-2', viewedAtMillis: 0),
      ]);
      expect(view.items.single.contentOrFallback, 'No caption');
      // Author id falls back to the post id when the author is unresolved.
      expect(view.items.single.author?.id, 'post-2');
    });
  });
}
