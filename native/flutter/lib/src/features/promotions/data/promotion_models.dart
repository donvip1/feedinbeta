class PromotionReach {
  const PromotionReach({required this.min, required this.max});
  final int min;
  final int max;
}

class PromotionCapabilities {
  const PromotionCapabilities({
    this.age = false,
    this.interests = false,
    this.location = false,
  });
  final bool age;
  final bool interests;
  final bool location;
}

class PromotionPlan {
  const PromotionPlan({
    required this.id,
    required this.key,
    required this.name,
    required this.version,
    required this.creditCost,
    required this.duration,
    required this.estimatedReach,
    required this.capabilities,
  });

  final String id;
  final String key;
  final String name;
  final int version;
  final int creditCost;
  final Duration duration;
  final PromotionReach estimatedReach;
  final PromotionCapabilities capabilities;

  factory PromotionPlan.fromJson(Map<String, dynamic> json) {
    final rawCapabilities = json['targeting_capabilities'];
    final capabilities = rawCapabilities is Map
        ? Map<String, dynamic>.from(rawCapabilities)
        : const <String, dynamic>{};
    return PromotionPlan(
      id: json['id']?.toString() ?? '',
      key: json['key']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Promotion',
      version: _int(json['version'], fallback: 1),
      creditCost: _int(json['credit_cost']),
      duration: Duration(hours: _int(json['duration_hours'])),
      estimatedReach: PromotionReach(
        min: _int(json['estimated_reach_min']),
        max: _int(json['estimated_reach_max']),
      ),
      capabilities: PromotionCapabilities(
        age: capabilities['age'] == true,
        interests: capabilities['interests'] == true,
        location: capabilities['location'] == true,
      ),
    );
  }
}

class PromotionTargeting {
  const PromotionTargeting({
    this.mode = 'automatic',
    this.ageRange,
    this.interests = const [],
    this.location,
  });
  final String mode;
  final String? ageRange;
  final List<String> interests;
  final String? location;

  Map<String, Object?> toJson() => {
    'mode': mode,
    if (ageRange != null) 'age': ageRange,
    if (interests.isNotEmpty) 'interests': interests,
    if (location != null && location!.trim().isNotEmpty)
      'location': location!.trim(),
  };
}

class PromotionCampaign {
  const PromotionCampaign({
    required this.id,
    required this.postId,
    required this.planName,
    required this.endsAt,
  });
  final String id;
  final String postId;
  final String planName;
  final DateTime endsAt;

  factory PromotionCampaign.fromJson(Map<String, dynamic> json) =>
      PromotionCampaign(
        id: json['id']?.toString() ?? '',
        postId: json['post_id']?.toString() ?? '',
        planName: json['plan_name']?.toString() ?? 'Promotion',
        endsAt:
            DateTime.tryParse(json['ends_at']?.toString() ?? '') ??
            DateTime.now(),
      );
}

sealed class PromotionFailure implements Exception {
  const PromotionFailure(this.message);
  final String message;

  static PromotionFailure fromCode(String code) => switch (code.trim()) {
    'PLAN_VERSION_STALE' => const StalePromotionPlan(),
    'POST_NOT_PROMOTABLE' => const PostNotPromotable(),
    'INSUFFICIENT_CREDITS' => const PromotionInsufficientCredits(),
    'PLAN_NOT_AVAILABLE' => const PromotionPlanUnavailable(),
    _ => UnknownPromotionFailure(code),
  };

  @override
  String toString() => message;
}

class StalePromotionPlan extends PromotionFailure {
  const StalePromotionPlan()
    : super('This plan changed. Review the latest price and reach.');
}

class PostNotPromotable extends PromotionFailure {
  const PostNotPromotable() : super('This post is not eligible for promotion.');
}

class PromotionInsufficientCredits extends PromotionFailure {
  const PromotionInsufficientCredits()
    : super('You need more credits for this promotion.');
}

class PromotionPlanUnavailable extends PromotionFailure {
  const PromotionPlanUnavailable()
    : super('This promotion plan is no longer available.');
}

class UnknownPromotionFailure extends PromotionFailure {
  UnknownPromotionFailure(String code)
    : super('Could not create the promotion${code.isEmpty ? '' : ' ($code)'}.');
}

int _int(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}
