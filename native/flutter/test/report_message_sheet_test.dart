import 'package:feedin/src/features/messages/chat/widgets/report_message_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('returns the selected report reason and trimmed description', (
    tester,
  ) async {
    ReportMessageDraft? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => FilledButton(
              onPressed: () async {
                result = await showReportMessageSheet(context);
              },
              child: const Text('Open report'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open report'));
    await tester.pumpAndSettle();

    final submitFinder = find.byKey(const ValueKey('report-submit'));
    expect(tester.widget<FilledButton>(submitFinder).onPressed, isNull);

    await tester.tap(find.byKey(const ValueKey('report-reason-hate_speech')));
    await tester.pump();

    final descriptionFinder = find.byKey(const ValueKey('report-description'));
    await tester.ensureVisible(descriptionFinder);
    await tester.enterText(descriptionFinder, '  threatening language  ');
    await tester.ensureVisible(submitFinder);
    await tester.tap(submitFinder);
    await tester.pumpAndSettle();

    expect(result?.reasonValue, 'hate_speech');
    expect(result?.description, 'threatening language');
  });
}
