import 'package:feedin/src/features/promotions/data/promotion_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses remote plan pricing, duration, reach, and capabilities', () {
    final plan = PromotionPlan.fromJson({
      'id': 'plan-1',
      'key': 'premium',
      'name': 'Premium Boost',
      'version': 3,
      'credit_cost': 200,
      'duration_hours': 168,
      'estimated_reach_min': 15000,
      'estimated_reach_max': 22500,
      'targeting_capabilities': {
        'age': true,
        'interests': true,
        'location': true,
      },
    });

    expect(plan.creditCost, 200);
    expect(plan.duration, const Duration(days: 7));
    expect(plan.estimatedReach.min, 15000);
    expect(plan.capabilities.location, isTrue);
  });

  test('maps stale plan and eligibility failures', () {
    expect(
      PromotionFailure.fromCode('PLAN_VERSION_STALE'),
      isA<StalePromotionPlan>(),
    );
    expect(
      PromotionFailure.fromCode('POST_NOT_PROMOTABLE'),
      isA<PostNotPromotable>(),
    );
    expect(
      PromotionFailure.fromCode('INSUFFICIENT_CREDITS'),
      isA<PromotionInsufficientCredits>(),
    );
  });
}
