import 'promotion_models.dart';

abstract interface class PromotionRepository {
  Future<List<PromotionPlan>> fetchPlans();
  Future<PromotionCampaign> promotePost({
    required String postId,
    required PromotionPlan plan,
    required PromotionTargeting targeting,
    required String idempotencyKey,
  });
}
