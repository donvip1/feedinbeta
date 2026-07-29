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
    expect(find.text('A threaded reply'), findsOneWidget);
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
