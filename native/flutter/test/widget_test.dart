import 'package:feedin/src/app/feedin_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('FEEDIN demo shell opens from auth gate', (tester) async {
    await tester.pumpWidget(const FeedinApp());

    expect(find.text('FEEDIN'), findsOneWidget);
    expect(find.text('Enter demo shell'), findsOneWidget);

    await tester.tap(find.text('Enter demo shell'));
    await tester.pumpAndSettle();

    expect(find.text('Local-first'), findsOneWidget);
    expect(find.text('Cross-platform'), findsOneWidget);
  });
}
