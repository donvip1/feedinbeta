import 'package:supabase_flutter/supabase_flutter.dart';
import 'promotion_models.dart';

class PromotionRepository {
  const PromotionRepository({required this.isConfigured});
  final bool isConfigured;

  Future<int> fetchCreditBalance() async {
    if (!isConfigured) return 500;
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return 0;
    final row = await Supabase.instance.client
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();
    return (row?['balance'] as num?)?.toInt() ?? 0;
  }

  Future<List<PromotionPlan>> fetchPlans() async {
    if (!isConfigured) return _demoPlans;
    try {
      final rows = await Supabase.instance.client
          .from('promotion_plans')
          .select()
          .eq('is_active', true)
          .order('display_order');
      return rows
          .map((row) => PromotionPlan.fromJson(Map<String, dynamic>.from(row)))
          .toList();
    } catch (_) {
      return _demoPlans;
    }
  }

  Future<PromotionCampaign> promote({
    required String postId,
    required PromotionPlan plan,
    required PromotionTargeting targeting,
    required String idempotencyKey,
  }) async {
    if (!isConfigured) {
      return PromotionCampaign(
        id: idempotencyKey,
        plan: plan,
        postId: postId,
        cost: plan.creditCost,
        estimatedReach: plan.estimatedReach,
      );
    }
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
      final json = Map<String, dynamic>.from(raw as Map);
      if (json['success'] == false) {
        throw PromotionFailure(
          '${json['code'] ?? 'promotion_failed'}',
          '${json['message'] ?? 'Promotion could not be started.'}',
        );
      }
      return PromotionCampaign.fromJson(
        json['campaign'] is Map
            ? Map<String, dynamic>.from(json['campaign'])
            : json,
        plan,
      );
    } on PromotionFailure {
      rethrow;
    } catch (error) {
      throw PromotionFailure('network_error', error.toString());
    }
  }

  static const _demoPlans = [
    PromotionPlan(
      id: 'starter',
      key: 'starter',
      version: 1,
      name: 'Starter Boost',
      creditCost: 25,
      duration: Duration(hours: 12),
      estimatedReach: PromotionReach(min: 500, max: 750),
      description: 'A focused pulse for a fresh post',
    ),
    PromotionPlan(
      id: 'basic',
      key: 'basic',
      version: 1,
      name: 'Growth Boost',
      creditCost: 50,
      duration: Duration(hours: 24),
      estimatedReach: PromotionReach(min: 1500, max: 2250),
      description: 'Steady reach with smart distribution',
    ),
    PromotionPlan(
      id: 'pro',
      key: 'pro',
      version: 1,
      name: 'Pro Boost',
      creditCost: 100,
      duration: Duration(hours: 72),
      estimatedReach: PromotionReach(min: 5000, max: 7500),
      description: 'The best balance of reach and control',
      capabilities: {'age': true, 'interests': true},
    ),
    PromotionPlan(
      id: 'premium',
      key: 'premium',
      version: 1,
      name: 'Premium Boost',
      creditCost: 200,
      duration: Duration(hours: 168),
      estimatedReach: PromotionReach(min: 15000, max: 22500),
      description: 'Maximum momentum for important launches',
      capabilities: {'age': true, 'interests': true, 'location': true},
    ),
  ];
}
