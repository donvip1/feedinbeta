import 'dart:async';

import 'package:feedin/src/data/local/local_feed_repository_contract.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/state/post_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const post = FeedPost(
    id: 'post-1',
    userId: 'author-1',
    authorName: 'Ada',
    body: 'Hello',
    meta: '@ada',
    createdAtMillis: 1,
    likesCount: 4,
    commentsCount: 2,
    refeedsCount: 1,
  );

  test('Like updates optimistically and keeps confirmed state', () async {
    final repository = _PostRepository();
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final args = PostControllerArgs(post: post, repository: repository);
    final controller = container.read(postControllerProvider(args).notifier);

    final operation = controller.toggleLike();
    expect(container.read(postControllerProvider(args)).isLiked, isTrue);
    expect(container.read(postControllerProvider(args)).likesCount, 5);

    repository.likeCompleter.complete(true);
    await operation;
    final state = container.read(postControllerProvider(args));
    expect(state.isLiked, isTrue);
    expect(state.likesCount, 5);
    expect(state.likeBusy, isFalse);
  });

  test('Like restores exact state after failure', () async {
    final repository = _PostRepository();
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final args = PostControllerArgs(post: post, repository: repository);
    final controller = container.read(postControllerProvider(args).notifier);

    final operation = controller.toggleLike();
    repository.likeCompleter.completeError(StateError('offline'));
    await operation;

    final state = container.read(postControllerProvider(args));
    expect(state.isLiked, isFalse);
    expect(state.likesCount, 4);
    expect(state.likeBusy, isFalse);
    expect(state.statusMessage, 'Could not update the like.');
  });

  test('Duplicate Like taps share one repository command', () async {
    final repository = _PostRepository();
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final args = PostControllerArgs(post: post, repository: repository);
    final controller = container.read(postControllerProvider(args).notifier);

    final first = controller.toggleLike();
    final second = controller.toggleLike();
    expect(repository.likeCalls, 1);
    repository.likeCompleter.complete(true);
    await Future.wait([first, second]);
    expect(repository.likeCalls, 1);
  });

  test('More state persists for the post family', () {
    final repository = _PostRepository();
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final args = PostControllerArgs(post: post, repository: repository);

    container.read(postControllerProvider(args).notifier).toggleMore();
    expect(container.read(postControllerProvider(args)).isMoreExpanded, isTrue);
    expect(
      container
          .read(postControllerProvider(args).notifier)
          .state
          .isMoreExpanded,
      isTrue,
    );
  });

  test(
    'Comment count adjusts by reply-inclusive deltas without going negative',
    () {
      final repository = _PostRepository();
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final args = PostControllerArgs(post: post, repository: repository);
      final controller = container.read(postControllerProvider(args).notifier);

      controller.adjustCommentCount(3);
      expect(container.read(postControllerProvider(args)).commentsCount, 5);

      controller.adjustCommentCount(-10);
      expect(container.read(postControllerProvider(args)).commentsCount, 0);
    },
  );
}

class _PostRepository implements LocalFeedRepositoryContract {
  final likeCompleter = Completer<bool>();
  int likeCalls = 0;

  @override
  Future<bool> toggleLike(String postId, {required bool liked}) {
    likeCalls++;
    return likeCompleter.future;
  }

  @override
  Future<bool> toggleSave(String postId, {required bool saved}) async => !saved;

  @override
  Future<bool> toggleRefeed(String postId, {required bool refeeded}) async =>
      !refeeded;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
