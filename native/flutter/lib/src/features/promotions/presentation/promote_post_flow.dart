import 'package:flutter/material.dart';
import '../../feed/feed_post.dart';
import '../data/promotion_models.dart';
import '../data/promotion_repository.dart';

class PromotePostFlow extends StatefulWidget {
  const PromotePostFlow({
    super.key,
    required this.post,
    required this.repository,
    this.currentCredits,
  });
  final FeedPost post;
  final PromotionRepository repository;
  final int? currentCredits;
  @override
  State<PromotePostFlow> createState() => _PromotePostFlowState();
}

class _PromotePostFlowState extends State<PromotePostFlow> {
  int step = 0;
  List<PromotionPlan> plans = const [];
  PromotionPlan? selected;
  PromotionTargeting targeting = const PromotionTargeting();
  bool loading = true, submitting = false;
  int credits = 0;
  final interests = const [
    'Technology',
    'Gaming',
    'Music',
    'Sports',
    'Fashion',
    'Food',
    'Travel',
    'Fitness',
    'Art',
    'Business',
    'Education',
    'Wellness',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await widget.repository.fetchPlans();
    final balance =
        widget.currentCredits ?? await widget.repository.fetchCreditBalance();
    if (!mounted) return;
    setState(() {
      plans = result;
      selected = result.firstWhere(
        (p) => p.key == 'pro',
        orElse: () => result.first,
      );
      credits = balance;
      loading = false;
    });
  }

  void _next() {
    if (step < 3) setState(() => step++);
  }

  void _back() {
    if (step == 0) {
      Navigator.pop(context);
    } else {
      setState(() => step--);
    }
  }

  Future<void> _submit() async {
    final plan = selected;
    if (plan == null) return;
    if (credits < plan.creditCost) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You need more credits for this plan.')),
      );
      return;
    }
    setState(() => submitting = true);
    try {
      final campaign = await widget.repository.promote(
        postId: widget.post.displayedPost.id,
        plan: plan,
        targeting: targeting,
        idempotencyKey:
            '${DateTime.now().microsecondsSinceEpoch}-${widget.post.id}',
      );
      if (!mounted) return;
      Navigator.pop(context, PromotionCreated(campaign.id));
    } on PromotionFailure catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = selected;
    return Scaffold(
      backgroundColor: const Color(0xFF070A12),
      appBar: AppBar(
        title: const Text(
          'Promote post',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        leading: IconButton(
          onPressed: _back,
          icon: const Icon(Icons.arrow_back),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                '$credits credits',
                style: const TextStyle(
                  color: Color(0xFFFF3D9A),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Column(
                children: [
                  _Progress(step: step),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: KeyedSubtree(
                        key: ValueKey(step),
                        child: _body(step, plan),
                      ),
                    ),
                  ),
                  _Footer(
                    step: step,
                    plan: plan,
                    submitting: submitting,
                    onBack: _back,
                    onNext: step == 3 ? _submit : _next,
                  ),
                ],
              ),
            ),
    );
  }

  Widget _body(int index, PromotionPlan? plan) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
    child: switch (index) {
      0 => _plans(),
      1 => _targeting(plan),
      2 => _preview(),
      _ => _confirm(plan),
    },
  );
  Widget _plans() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _Heading(
        title: 'Choose your momentum',
        subtitle:
            'Pick a delivery plan. Reach and pricing are managed securely by feedIn.',
      ),
      ...plans.map((plan) {
        final active = selected?.id == plan.id;
        return GestureDetector(
          onTap: () => setState(() => selected = plan),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: active ? const Color(0xFF211329) : const Color(0xFF101521),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: active
                    ? const Color(0xFFFF3D9A)
                    : const Color(0xFF202A3D),
                width: active ? 1.5 : 1,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: active
                        ? const Color(0xFFFF3D9A)
                        : const Color(0xFF1B2233),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(_icon(plan.key), color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              plan.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 17,
                              ),
                            ),
                          ),
                          Text(
                            '${plan.creditCost}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 20,
                            ),
                          ),
                          const SizedBox(width: 3),
                          const Text(
                            'credits',
                            style: TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        plan.description,
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          const Icon(
                            Icons.visibility_outlined,
                            size: 15,
                            color: Color(0xFF94A3B8),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '${plan.estimatedReach.label} reach',
                            style: const TextStyle(
                              color: Color(0xFFCBD5E1),
                              fontSize: 12,
                            ),
                          ),
                          const Spacer(),
                          const Icon(
                            Icons.schedule,
                            size: 15,
                            color: Color(0xFF94A3B8),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            _duration(plan.duration),
                            style: const TextStyle(
                              color: Color(0xFFCBD5E1),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      if (active)
                        const Padding(
                          padding: EdgeInsets.only(top: 12),
                          child: Row(
                            children: [
                              Icon(
                                Icons.check_circle,
                                size: 16,
                                color: Color(0xFFFF3D9A),
                              ),
                              SizedBox(width: 6),
                              Text(
                                'Selected plan',
                                style: TextStyle(
                                  color: Color(0xFFFF3D9A),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    ],
  );
  Widget _targeting(PromotionPlan? plan) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _Heading(
        title: 'Find your audience',
        subtitle:
            'Use a few signals, then let delivery optimize toward meaningful engagement.',
      ),
      _Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Age range',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              '${targeting.ageMin}–${targeting.ageMax}+',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
            RangeSlider(
              values: RangeValues(
                targeting.ageMin.toDouble(),
                targeting.ageMax.toDouble(),
              ),
              min: 13,
              max: 65,
              onChanged: plan?.supportsAge == true
                  ? (v) => setState(
                      () => targeting = PromotionTargeting(
                        ageMin: v.start.round(),
                        ageMax: v.end.round(),
                        interests: targeting.interests,
                        worldwide: targeting.worldwide,
                        scheduleAt: targeting.scheduleAt,
                      ),
                    )
                  : null,
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      _Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Interests',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const Spacer(),
                Text(
                  '${targeting.interests.length}/5',
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: interests.map((interest) {
                final active = targeting.interests.contains(interest);
                return FilterChip(
                  label: Text(interest),
                  selected: active,
                  onSelected:
                      plan?.supportsInterests == true &&
                          (active || targeting.interests.length < 5)
                      ? (_) => setState(
                          () => targeting = PromotionTargeting(
                            ageMin: targeting.ageMin,
                            ageMax: targeting.ageMax,
                            interests: active
                                ? targeting.interests
                                      .where((i) => i != interest)
                                      .toList()
                                : [...targeting.interests, interest],
                            worldwide: targeting.worldwide,
                            scheduleAt: targeting.scheduleAt,
                          ),
                        )
                      : null,
                );
              }).toList(),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      _Panel(
        child: Column(
          children: [
            _Toggle(
              icon: Icons.public,
              title: 'Worldwide delivery',
              subtitle: 'Expand beyond your local audience',
              value: targeting.worldwide,
              onChanged: (v) => setState(
                () => targeting = PromotionTargeting(
                  ageMin: targeting.ageMin,
                  ageMax: targeting.ageMax,
                  interests: targeting.interests,
                  worldwide: v,
                  scheduleAt: targeting.scheduleAt,
                ),
              ),
            ),
            const Divider(height: 24),
            _Toggle(
              icon: Icons.auto_awesome,
              title: 'Smart optimization',
              subtitle: 'Automatically find people likely to engage',
              value: true,
              onChanged: (_) {},
            ),
          ],
        ),
      ),
    ],
  );
  Widget _preview() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _Heading(
        title: 'Preview your placement',
        subtitle:
            'This is how your post will appear as a clearly labeled promoted recommendation.',
      ),
      _PreviewCard(post: widget.post.displayedPost),
    ],
  );
  Widget _confirm(PromotionPlan? plan) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _Heading(
        title: 'Ready to launch?',
        subtitle: 'Review your campaign before credits are reserved.',
      ),
      _Panel(
        child: Column(
          children: [
            _Summary(label: 'Plan', value: plan?.name ?? '-'),
            _Summary(
              label: 'Duration',
              value: plan == null ? '-' : _duration(plan.duration),
            ),
            _Summary(
              label: 'Audience',
              value: targeting.worldwide ? 'Worldwide' : 'Targeted',
            ),
            _Summary(
              label: 'Signals',
              value: targeting.interests.isEmpty
                  ? 'Automatic optimization'
                  : targeting.interests.join(', '),
            ),
            const Divider(height: 28),
            _Summary(
              label: 'Estimated reach',
              value: plan?.estimatedReach.label ?? '-',
              strong: true,
            ),
            _Summary(
              label: 'Total',
              value: '${plan?.creditCost ?? 0} credits',
              strong: true,
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      _Panel(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.shield_outlined, color: Color(0xFFFF3D9A)),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Your campaign is delivered with frequency controls and a Promoted disclosure. The feed ranking system remains responsible for final delivery.',
                style: TextStyle(
                  color: Color(0xFFCBD5E1),
                  height: 1.4,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    ],
  );
  IconData _icon(String key) => switch (key) {
    'starter' => Icons.bolt,
    'basic' => Icons.insights,
    'pro' => Icons.rocket_launch,
    _ => Icons.auto_awesome,
  };
  String _duration(Duration d) => d.inDays >= 1
      ? '${d.inDays} day${d.inDays == 1 ? '' : 's'}'
      : '${d.inHours} hours';
}

class _Progress extends StatelessWidget {
  const _Progress({required this.step});
  final int step;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
    child: Row(
      children: List.generate(
        4,
        (i) => Expanded(
          child: Container(
            margin: EdgeInsets.only(right: i == 3 ? 0 : 5),
            height: 4,
            decoration: BoxDecoration(
              color: i <= step
                  ? const Color(0xFFFF3D9A)
                  : const Color(0xFF202A3D),
              borderRadius: BorderRadius.circular(5),
            ),
          ),
        ),
      ),
    ),
  );
}

class _Heading extends StatelessWidget {
  const _Heading({required this.title, required this.subtitle});
  final String title, subtitle;
  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 27),
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
          style: const TextStyle(color: Color(0xFF94A3B8), height: 1.35),
        ),
      ],
    ),
  );
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext c) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: const Color(0xFF101521),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFF202A3D)),
    ),
    child: child,
  );
}

class _Toggle extends StatelessWidget {
  const _Toggle({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });
  final IconData icon;
  final String title, subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext c) => Row(
    children: [
      Icon(icon, color: const Color(0xFFFF3D9A)),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(
              subtitle,
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
          ],
        ),
      ),
      Switch(value: value, onChanged: onChanged),
    ],
  );
}

class _Summary extends StatelessWidget {
  const _Summary({
    required this.label,
    required this.value,
    this.strong = false,
  });
  final String label, value;
  final bool strong;
  @override
  Widget build(BuildContext c) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF94A3B8))),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontWeight: strong ? FontWeight.w900 : FontWeight.w700,
              color: strong ? const Color(0xFFFF3D9A) : Colors.white,
            ),
          ),
        ),
      ],
    ),
  );
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.step,
    required this.plan,
    required this.submitting,
    required this.onBack,
    required this.onNext,
  });
  final int step;
  final PromotionPlan? plan;
  final bool submitting;
  final VoidCallback onBack, onNext;
  @override
  Widget build(BuildContext c) => Container(
    padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
    decoration: const BoxDecoration(
      color: Color(0xF5070A12),
      border: Border(top: BorderSide(color: Color(0xFF202A3D))),
    ),
    child: Row(
      children: [
        if (step > 0) TextButton(onPressed: onBack, child: const Text('Back')),
        const Spacer(),
        FilledButton(
          onPressed: submitting ? null : onNext,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFFF3D9A),
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          ),
          child: submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(step == 3 ? 'Launch campaign' : 'Continue'),
        ),
      ],
    ),
  );
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({required this.post});
  final FeedPost post;
  @override
  Widget build(BuildContext c) {
    final media = post.normalizedMedia.firstOrNull;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0xFF101521),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFF202A3D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 19,
                  backgroundImage: post.avatarUrl?.isNotEmpty == true
                      ? NetworkImage(post.avatarUrl!)
                      : null,
                  child: post.avatarUrl?.isNotEmpty == true
                      ? null
                      : Text(post.authorName.characters.first.toUpperCase()),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.authorName,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        '@${post.authorHandle ?? post.meta}',
                        style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2B1830),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Promoted',
                    style: TextStyle(
                      color: Color(0xFFFF8CC3),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (media != null)
            AspectRatio(
              aspectRatio: 1,
              child: media.isVideo
                  ? Container(
                      color: Colors.black,
                      child: const Center(
                        child: Icon(
                          Icons.play_circle_fill,
                          size: 62,
                          color: Colors.white70,
                        ),
                      ),
                    )
                  : Image.network(
                      media.url,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const ColoredBox(color: Color(0xFF1B2233)),
                    ),
            ),
          if (post.body.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(post.body, style: const TextStyle(height: 1.4)),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                const Icon(
                  Icons.favorite_border,
                  size: 19,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(width: 5),
                Text('${post.likesCount}'),
                const SizedBox(width: 18),
                const Icon(
                  Icons.mode_comment_outlined,
                  size: 19,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(width: 5),
                Text('${post.commentsCount}'),
                const Spacer(),
                const Icon(
                  Icons.visibility_outlined,
                  size: 19,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(width: 5),
                Text('${post.viewsCount}'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
