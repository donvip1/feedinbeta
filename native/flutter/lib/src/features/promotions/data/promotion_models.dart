import '../../feed/feed_post.dart';

class PromotionReach {
  const PromotionReach({required this.min, required this.max});
  final int min;
  final int max;
  String get label => '${_format(min)}–${_format(max)}';
  static String _format(int value) => value >= 1000
      ? '${(value / 1000).toStringAsFixed(value % 1000 == 0 ? 0 : 1)}K'
      : '$value';
}

class PromotionPlan {
  const PromotionPlan({
    required this.id,
    required this.key,
    required this.version,
    required this.name,
    required this.creditCost,
    required this.duration,
    required this.estimatedReach,
    this.capabilities = const {},
    this.description = '',
  });
  final String id;
  final String key;
  final int version;
  final String name;
  final int creditCost;
  final Duration duration;
  final PromotionReach estimatedReach;
  final Map<String, bool> capabilities;
  final String description;
  bool get supportsInterests => capabilities['interests'] ?? true;
  bool get supportsAge => capabilities['age'] ?? true;
  bool get supportsLocation => capabilities['location'] ?? false;
  factory PromotionPlan.fromJson(Map<String, dynamic> json) => PromotionPlan(
    id: '${json['id']}',
    key: '${json['key'] ?? json['slug']}',
    version: (json['version'] as num?)?.toInt() ?? 1,
    name: '${json['name']}',
    creditCost: (json['credit_cost'] as num?)?.toInt() ?? 0,
    duration: Duration(hours: (json['duration_hours'] as num?)?.toInt() ?? 24),
    estimatedReach: PromotionReach(
      min: (json['estimated_reach_min'] as num?)?.toInt() ?? 0,
      max: (json['estimated_reach_max'] as num?)?.toInt() ?? 0,
    ),
    capabilities:
        (json['targeting_capabilities'] as Map?)?.map(
          (k, v) => MapEntry('$k', v == true),
        ) ??
        const {},
    description: '${json['description'] ?? ''}',
  );
}

class PromotionTargeting {
  const PromotionTargeting({
    this.ageMin = 18,
    this.ageMax = 45,
    this.interests = const [],
    this.worldwide = true,
    this.scheduleAt,
  });
  final int ageMin;
  final int ageMax;
  final List<String> interests;
  final bool worldwide;
  final DateTime? scheduleAt;
  Map<String, dynamic> toJson() => {
    'age_min': ageMin,
    'age_max': ageMax,
    'interests': interests,
    'worldwide': worldwide,
    if (scheduleAt != null)
      'schedule_at': scheduleAt!.toUtc().toIso8601String(),
  };
}

class PromotionCampaign {
  const PromotionCampaign({
    required this.id,
    required this.plan,
    required this.postId,
    required this.cost,
    required this.estimatedReach,
    this.state = 'active',
  });
  final String id;
  final PromotionPlan plan;
  final String postId;
  final int cost;
  final PromotionReach estimatedReach;
  final String state;
  factory PromotionCampaign.fromJson(
    Map<String, dynamic> json,
    PromotionPlan plan,
  ) => PromotionCampaign(
    id: '${json['id'] ?? json['campaign_id']}',
    plan: plan,
    postId: '${json['post_id']}',
    cost: (json['credit_cost'] as num?)?.toInt() ?? plan.creditCost,
    estimatedReach: PromotionReach(
      min:
          (json['estimated_reach_min'] as num?)?.toInt() ??
          plan.estimatedReach.min,
      max:
          (json['estimated_reach_max'] as num?)?.toInt() ??
          plan.estimatedReach.max,
    ),
    state: '${json['state'] ?? 'active'}',
  );
}

class PromotionCreated {
  const PromotionCreated(this.campaignId);
  final String campaignId;
}

class PromotionFailure implements Exception {
  const PromotionFailure(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => message;
}

extension PromotionPostPreview on FeedPost {
  FeedPost get promotionPreviewPost => displayedPost;
}
