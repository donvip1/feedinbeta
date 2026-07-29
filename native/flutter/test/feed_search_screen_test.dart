import 'dart:async';

import 'package:feedin/src/data/local/local_feed_repository_contract.dart';
import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/search/feed_search_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('search renders Posts, People, and Hashtags results', (
    tester,
  ) async {
    final repository = _SearchFeedRepository(
      handler: (_) async => const FeedSearchResults(
        posts: [
          FeedPost(
            id: 'post-1',
            userId: 'person-1',
            authorName: 'Ada',
            body: 'Building #flutter search',
            meta: '@ada',
            createdAtMillis: 1,
          ),
        ],
        people: [
          FeedSearchPerson(
            userId: 'person-1',
            displayName: 'Ada Lovelace',
            handle: 'ada',
          ),
        ],
        hashtags: [FeedSearchHashtag(tag: 'flutter', postCount: 1)],
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: FeedSearchScreen(
          feedRepository: repository,
          onOpenPerson: (_) {},
          onOpenPost: (_) {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'flutter');
    await tester.pump(const Duration(milliseconds: 301));
    await tester.pump();

    expect(repository.queries, ['flutter']);
    expect(find.text('Building #flutter search'), findsOneWidget);

    await tester.tap(find.text('People'));
    await tester.pumpAndSettle();
    expect(find.text('Ada Lovelace'), findsOneWidget);
    expect(find.text('@ada'), findsOneWidget);

    await tester.tap(find.text('Hashtags'));
    await tester.pumpAndSettle();
    expect(find.text('#flutter'), findsOneWidget);
    expect(find.text('1 post'), findsOneWidget);
  });

  testWidgets('stale search result cannot replace the latest query', (
    tester,
  ) async {
    final first = Completer<FeedSearchResults>();
    final second = Completer<FeedSearchResults>();
    final repository = _SearchFeedRepository(
      handler: (query) => query == 'first' ? first.future : second.future,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: FeedSearchScreen(
          feedRepository: repository,
          onOpenPerson: (_) {},
          onOpenPost: (_) {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), 'first');
    await tester.pump(const Duration(milliseconds: 301));
    await tester.enterText(find.byType(TextField), 'second');
    await tester.pump(const Duration(milliseconds: 301));

    second.complete(
      const FeedSearchResults(
        people: [
          FeedSearchPerson(
            userId: 'new',
            displayName: 'Latest result',
            handle: 'latest',
          ),
        ],
      ),
    );
    await tester.pump();
    first.complete(
      const FeedSearchResults(
        people: [
          FeedSearchPerson(
            userId: 'old',
            displayName: 'Stale result',
            handle: 'stale',
          ),
        ],
      ),
    );
    await tester.pump();

    await tester.tap(find.text('People'));
    await tester.pumpAndSettle();
    expect(find.text('Latest result'), findsOneWidget);
    expect(find.text('Stale result'), findsNothing);
  });

  testWidgets('people result forwards the selected user', (tester) async {
    FeedSearchPerson? selected;
    final repository = _SearchFeedRepository(
      handler: (_) async => const FeedSearchResults(
        people: [
          FeedSearchPerson(
            userId: 'person-42',
            displayName: 'Grace Hopper',
            handle: 'grace',
          ),
        ],
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: FeedSearchScreen(
          feedRepository: repository,
          onOpenPerson: (person) => selected = person,
          onOpenPost: (_) {},
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), 'grace');
    await tester.pump(const Duration(milliseconds: 301));
    await tester.pump();
    await tester.tap(find.text('People'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Grace Hopper'));

    expect(selected?.userId, 'person-42');
  });
}

class _SearchFeedRepository implements LocalFeedRepositoryContract {
  _SearchFeedRepository({required this.handler});

  final Future<FeedSearchResults> Function(String query) handler;
  final List<String> queries = <String>[];

  @override
  Future<FeedSearchResults> search(String query, {int limit = 30}) {
    queries.add(query);
    return handler(query);
  }

  @override
  Future<FeedComment> addComment(
    String postId,
    String body, {
    String? parentCommentId,
  }) => throw UnimplementedError();

  @override
  Future<bool> toggleCommentLike(String commentId, {required bool liked}) =>
      throw UnimplementedError();

  @override
  Future<void> deleteComment(String commentId) => throw UnimplementedError();

  @override
  Future<FeedPost> createQuoteRefeed(String postId, String quote) =>
      throw UnimplementedError();

  @override
  Future<List<FeedPost>> loadSavedPosts() async => const [];

  @override
  Future<void> deletePost(String postId) async {}

  @override
  Future<List<FeedPost>> loadPosts() async => const [];

  @override
  Future<FeedPaginationResult> loadMorePosts() => throw UnimplementedError();

  @override
  Future<List<FeedPost>> loadPostsByUser(String userId) async => const [];

  @override
  Future<List<FeedComment>> loadComments(String postId) async => const [];

  @override
  Future<List<LiveFeedItem>> loadLiveItems() async => const [];

  @override
  Future<int> pendingActionCount() async => 0;

  @override
  Future<void> queueComment(String postId, String body) async {}

  @override
  Future<void> queueLike(String postId) async {}

  @override
  Future<void> queueRefeed(String postId) async {}

  @override
  Future<void> queueSave(String postId) async {}

  @override
  Future<void> queueShare(String postId) async {}

  @override
  Future<FeedRefreshResult> refresh() async =>
      const FeedRefreshResult(posts: [], usedRemote: false);

  @override
  Future<bool> toggleLike(String postId, {required bool liked}) async => !liked;

  @override
  Future<bool> toggleRefeed(String postId, {required bool refeeded}) async =>
      !refeeded;

  @override
  Future<bool> toggleSave(String postId, {required bool saved}) async => !saved;
}
