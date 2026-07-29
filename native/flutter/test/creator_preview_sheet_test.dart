import 'package:feedin/src/features/feed/immersive/creator_preview_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('follow state updates without closing creator preview', (
    tester,
  ) async {
    var toggles = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => showCreatorPreview(
                  context,
                  heroTag: 'creator',
                  name: 'Ada',
                  handle: '@ada',
                  onToggleFollow: () async {
                    toggles++;
                    return true;
                  },
                ),
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Follow Creator'), findsOneWidget);

    await tester.tap(find.text('Follow Creator'));
    await tester.pumpAndSettle();

    expect(toggles, 1);
    expect(find.text('Following'), findsOneWidget);
    expect(find.text('Ada'), findsOneWidget);
  });

  testWidgets('View Profile closes preview and invokes route callback', (
    tester,
  ) async {
    var openedProfile = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => showCreatorPreview(
                  context,
                  heroTag: 'creator',
                  name: 'Grace',
                  onViewProfile: () => openedProfile = true,
                ),
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View Profile'));
    await tester.pumpAndSettle();

    expect(openedProfile, isTrue);
    expect(find.text('Grace'), findsNothing);
  });
}
