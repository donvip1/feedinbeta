import 'package:feedin/src/features/create/create_action_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('create sheet presents the four approved actions', (
    tester,
  ) async {
    CreateAction? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                selected = await showCreateActionSheet(context);
              },
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.text('Video'), findsOneWidget);
    expect(find.text('Take video or choose from gallery'), findsOneWidget);
    expect(find.text('Photo+'), findsOneWidget);
    expect(find.text('Share your thoughts'), findsOneWidget);
    expect(find.text('Story'), findsOneWidget);
    expect(find.text('Share for 24 hours'), findsOneWidget);
    expect(find.text('Go Live'), findsOneWidget);
    expect(find.text('Start a live stream or audio space'), findsOneWidget);

    await tester.tap(find.text('Photo+'));
    await tester.pumpAndSettle();
    expect(selected, CreateAction.photo);
  });

  testWidgets('live sheet presents video and audio choices', (tester) async {
    LiveCreateAction? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                selected = await showLiveCreateActionSheet(context);
              },
              child: const Text('Open live'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open live'));
    await tester.pumpAndSettle();

    expect(find.text('Video Live'), findsOneWidget);
    expect(find.text('Broadcast with camera and live chat'), findsOneWidget);
    expect(find.text('Audio Space'), findsOneWidget);
    expect(find.text('Host a live voice conversation'), findsOneWidget);

    await tester.tap(find.text('Audio Space'));
    await tester.pumpAndSettle();
    expect(selected, LiveCreateAction.audioSpace);
  });
}
