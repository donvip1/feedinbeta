import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/feed/immersive/comment_sheet.dart';

void main() {
  const post = FeedPost(
    id: 'post-1',
    userId: 'author',
    authorName: 'Author',
    body: 'Post body',
    meta: '@author',
    createdAtMillis: 1,
    commentsCount: 1,
  );
  const root = FeedComment(
    id: 'comment-1',
    userId: 'owner-1',
    authorName: 'Grace',
    authorHandle: '@grace',
    content: 'First comment',
    createdAtMillis: 1,
  );

  testWidgets('comment sheet is draggable and exposes threaded actions', (
    tester,
  ) async {
    String? parentId;
    var openedUser = '';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CommentSheet(
            post: post,
            comments: const [root],
            currentUserId: 'owner-1',
            onSubmit: (body, parentCommentId) async {
              parentId = parentCommentId;
              return FeedComment(
                id: 'reply-1',
                userId: 'viewer',
                authorName: 'Viewer',
                authorHandle: '@viewer',
                content: body,
                createdAtMillis: 2,
                parentCommentId: parentCommentId,
              );
            },
            onToggleLike: (comment, liked) async => !liked,
            onDelete: (_) async {},
            onOpenUserProfile: (userId) => openedUser = userId,
          ),
        ),
      ),
    );

    expect(find.byType(DraggableScrollableSheet), findsOneWidget);
    expect(find.text('Reply'), findsOneWidget);
    expect(find.text('Delete'), findsOneWidget);

    await tester.tap(find.text('Grace'));
    expect(openedUser, 'owner-1');

    await tester.tap(find.text('Reply'));
    await tester.pump();
    expect(find.text('Replying to Grace'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('comment-composer')),
      'A threaded reply',
    );
    await tester.tap(find.bySemanticsLabel('Send comment'));
    await tester.pumpAndSettle();

    expect(parentId, 'comment-1');
    // Replies are collapsed by default; expand the thread to reveal the reply.
    await tester.tap(find.byKey(const Key('comment-toggle-comment-1')));
    await tester.pumpAndSettle();
    expect(find.text('A threaded reply'), findsOneWidget);
  });

  testWidgets('header and count callback include replies after submission', (
    tester,
  ) async {
    const reply = FeedComment(
      id: 'reply-existing',
      userId: 'viewer',
      authorName: 'Viewer',
      authorHandle: '@viewer',
      content: 'Existing reply',
      createdAtMillis: 2,
      parentCommentId: 'comment-1',
    );
    final deltas = <int>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CommentSheet(
            post: post,
            comments: const [root, reply],
            currentUserId: 'viewer',
            onSubmit: (body, parentCommentId) async => FeedComment(
              id: 'reply-new',
              userId: 'viewer',
              authorName: 'Viewer',
              authorHandle: '@viewer',
              content: body,
              createdAtMillis: 3,
              parentCommentId: parentCommentId,
            ),
            onToggleLike: (comment, liked) async => !liked,
            onDelete: (_) async {},
            onOpenUserProfile: (_) {},
            onCountChanged: deltas.add,
          ),
        ),
      ),
    );

    expect(find.text('2 Comments'), findsOneWidget);
    await tester.tap(find.text('Reply'));
    await tester.enterText(
      find.byKey(const Key('comment-composer')),
      'New reply',
    );
    await tester.tap(find.bySemanticsLabel('Send comment'));
    await tester.pumpAndSettle();

    expect(find.text('3 Comments'), findsOneWidget);
    expect(deltas, [1]);
  });

  testWidgets('reply-to-reply preserves exact parent and emoji inserts', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    const child = FeedComment(
      id: 'reply-1',
      userId: 'owner-2',
      authorName: 'Lin',
      authorHandle: '@lin',
      content: 'Nested once',
      createdAtMillis: 2,
      parentCommentId: 'comment-1',
    );
    String? parentId;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CommentSheet(
            post: post,
            comments: const [root, child],
            currentUserId: 'viewer',
            onSubmit: (body, selectedParentId) async {
              parentId = selectedParentId;
              return FeedComment(
                id: 'reply-2',
                userId: 'viewer',
                authorName: 'Viewer',
                authorHandle: '@viewer',
                content: body,
                createdAtMillis: 3,
                parentCommentId: selectedParentId,
              );
            },
            onToggleLike: (comment, liked) async => !liked,
            onDelete: (_) async {},
            onOpenUserProfile: (_) {},
          ),
        ),
      ),
    );

    // Expand the root thread so the nested reply (and its Reply button) show.
    await tester.tap(find.byKey(const Key('comment-toggle-comment-1')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('comment-reply-reply-1')));
    await tester.tap(find.byKey(const Key('comment-reply-reply-1')));
    await tester.tap(find.byKey(const Key('comment-emoji-button')));
    await tester.pump();
    expect(find.byKey(const Key('comment-emoji-picker')), findsOneWidget);
    await tester.tap(find.byKey(const Key('comment-emoji-🔥')));
    await tester.enterText(
      find.byKey(const Key('comment-composer')),
      'Deep reply 🔥',
    );
    await tester.tap(find.bySemanticsLabel('Send comment'));
    await tester.pumpAndSettle();

    expect(parentId, 'reply-1');
    // reply-1's own replies collapse by default; expand to reveal reply-2.
    await tester.tap(find.byKey(const Key('comment-toggle-reply-1')));
    await tester.pumpAndSettle();
    expect(find.text('Deep reply 🔥'), findsOneWidget);
    expect(find.byKey(const Key('comment-thread-reply-2')), findsOneWidget);
  });

  testWidgets('deleting a root removes its full descendant subtree', (
    tester,
  ) async {
    const child = FeedComment(
      id: 'reply-1',
      userId: 'owner-1',
      authorName: 'Grace',
      authorHandle: '@grace',
      content: 'Child',
      createdAtMillis: 2,
      parentCommentId: 'comment-1',
    );
    const grandchild = FeedComment(
      id: 'reply-2',
      userId: 'owner-1',
      authorName: 'Grace',
      authorHandle: '@grace',
      content: 'Grandchild',
      createdAtMillis: 3,
      parentCommentId: 'reply-1',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CommentSheet(
            post: post,
            comments: const [root, child, grandchild],
            currentUserId: 'owner-1',
            onSubmit: (_, _) => throw UnimplementedError(),
            onToggleLike: (comment, liked) async => !liked,
            onDelete: (_) async {},
            onOpenUserProfile: (_) {},
          ),
        ),
      ),
    );

    await tester.tap(find.text('Delete').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();

    expect(find.text('First comment'), findsNothing);
    expect(find.text('Child'), findsNothing);
    expect(find.text('Grandchild'), findsNothing);
  });

  testWidgets('deleting a root reports every removed descendant', (
    tester,
  ) async {
    const child = FeedComment(
      id: 'reply-1',
      userId: 'owner-1',
      authorName: 'Grace',
      authorHandle: '@grace',
      content: 'Child',
      createdAtMillis: 2,
      parentCommentId: 'comment-1',
    );
    final deltas = <int>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CommentSheet(
            post: post,
            comments: const [root, child],
            currentUserId: 'owner-1',
            onSubmit: (_, _) => throw UnimplementedError(),
            onToggleLike: (comment, liked) async => !liked,
            onDelete: (_) async {},
            onOpenUserProfile: (_) {},
            onCountChanged: deltas.add,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Delete').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();

    expect(deltas, [-2]);
  });

  testWidgets('comment likes update optimistically', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CommentSheet(
            post: post,
            comments: const [root],
            currentUserId: 'viewer',
            onSubmit: (_, _) => throw UnimplementedError(),
            onToggleLike: (comment, liked) async => !liked,
            onDelete: (_) async {},
            onOpenUserProfile: (_) {},
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('comment-like-comment-1')));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.favorite_rounded), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
  });
}
