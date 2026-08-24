import 'package:feedin/src/features/feed/feed_post.dart';
import 'package:feedin/src/features/promotions/data/promotion_models.dart';
import 'package:feedin/src/features/promotions/data/promotion_repository.dart';
import 'package:feedin/src/features/promotions/presentation/promote_post_flow.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('walks plans, targeting, preview, and confirm', (tester) async {
    final repository = _FakePromotionRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: PromotePostFlow(
          post: const FeedPost(
            id: 'post-1',
            userId: 'creator-1',
            authorName: 'Creator',
            body: 'Promote this post',
            meta: '@creator',
            createdAtMillis: 1,
          ),
          repository: repository,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Starter Boost'), findsOneWidget);
    await tester.tap(find.text('Starter Boost'));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Targeting'), findsWidgets);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Promoted'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Confirm promotion'), findsOneWidget);
    await tester.tap(find.byKey(const Key('promotion-confirm-button')));
    await tester.pump();

    expect(repository.promoteCount, 1);
  });
}

class _FakePromotionRepository implements PromotionRepository {
  int promoteCount = 0;

  final plan = const PromotionPlan(
    id: 'plan-1',
    key: 'starter',
    name: 'Starter Boost',
    version: 1,
    creditCost: 25,
    duration: Duration(hours: 12),
    estimatedReach: PromotionReach(min: 500, max: 750),
    capabilities: PromotionCapabilities(),
  );

  @override
  Future<List<PromotionPlan>> fetchPlans() async => [plan];

  @override
  Future<PromotionCampaign> promotePost({
    required String postId,
    required PromotionPlan plan,
    required PromotionTargeting targeting,
    required String idempotencyKey,
  }) async {
    promoteCount++;
    return PromotionCampaign(
      id: 'campaign-1',
      postId: postId,
      planName: plan.name,
      endsAt: DateTime(2026, 8, 15),
    );
  }
}
