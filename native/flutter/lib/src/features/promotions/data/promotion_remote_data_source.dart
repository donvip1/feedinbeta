import 'package:supabase_flutter/supabase_flutter.dart';

import 'promotion_models.dart';
import 'promotion_repository.dart';

class PromotionRemoteDataSource implements PromotionRepository {
  const PromotionRemoteDataSource({required this.isConfigured});

  factory PromotionRemoteDataSource.autoDetect() {
    try {
      Supabase.instance.client;
      return const PromotionRemoteDataSource(isConfigured: true);
    } catch (_) {
      return const PromotionRemoteDataSource(isConfigured: false);
    }
  }

  final bool isConfigured;

  @override
  Future<List<PromotionPlan>> fetchPlans() async {
    if (!isConfigured) return const [];
    try {
      final rows = await Supabase.instance.client
          .from('promotion_plans')
          .select(
            'id, key, name, version, credit_cost, duration_hours, '
            'estimated_reach_min, estimated_reach_max, '
            'targeting_capabilities, display_order',
          )
          .eq('is_active', true)
          .order('display_order');
      return [
        for (final row in rows.whereType<Map>())
          PromotionPlan.fromJson(Map<String, dynamic>.from(row)),
      ];
    } on PostgrestException catch (error) {
      throw PromotionFailure.fromCode(error.message);
    }
  }

  @override
  Future<PromotionCampaign> promotePost({
    required String postId,
    required PromotionPlan plan,
    required PromotionTargeting targeting,
    required String idempotencyKey,
  }) async {
    if (!isConfigured) throw const PromotionPlanUnavailable();
    try {
      final raw = await Supabase.instance.client.rpc(
        'promote_post',
        params: {
          'p_post_id': postId,
          'p_plan_id': plan.id,
          'p_plan_version': plan.version,
          'p_targeting': targeting.toJson(),
          'p_idempotency_key': idempotencyKey,
        },
      );
      if (raw is! Map) throw UnknownPromotionFailure('INVALID_RESPONSE');
      return PromotionCampaign.fromJson(Map<String, dynamic>.from(raw));
    } on PostgrestException catch (error) {
      throw PromotionFailure.fromCode(error.message);
    }
  }
}
