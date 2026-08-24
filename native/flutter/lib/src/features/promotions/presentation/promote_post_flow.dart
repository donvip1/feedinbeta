import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../feed/feed_post.dart';
import '../data/promotion_models.dart';
import '../data/promotion_repository.dart';

enum PromotionStep { plans, targeting, preview, confirm }

class PromotePostFlow extends StatefulWidget {
  const PromotePostFlow({
    super.key,
    required this.post,
    required this.repository,
  });
  final FeedPost post;
  final PromotionRepository repository;

  @override
  State<PromotePostFlow> createState() => _PromotePostFlowState();
}

class _PromotePostFlowState extends State<PromotePostFlow> {
  static const _uuid = Uuid();
  late final Future<List<PromotionPlan>> _plans = widget.repository
      .fetchPlans();
  PromotionStep _step = PromotionStep.plans;
  PromotionPlan? _selected;
  PromotionTargeting _targeting = const PromotionTargeting();
  bool _submitting = false;
  String? _error;

  void _continue() {
    if (_step == PromotionStep.plans && _selected == null) return;
    final next = _step.index + 1;
    if (next < PromotionStep.values.length) {
      setState(() => _step = PromotionStep.values[next]);
    }
  }

  Future<void> _confirm() async {
    final plan = _selected;
    if (plan == null || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final campaign = await widget.repository.promotePost(
        postId: widget.post.displayedPost.id,
        plan: plan,
        targeting: _targeting,
        idempotencyKey: _uuid.v4(),
      );
      if (!mounted) return;
      if (Navigator.of(context).canPop()) Navigator.of(context).pop(campaign);
    } on PromotionFailure catch (failure) {
      if (!mounted) return;
      setState(() => _error = failure.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1116),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F1116),
        foregroundColor: Colors.white,
        title: const Text('Promote post'),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            _Progress(step: _step),
            Expanded(child: _body()),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFFF8B9A)),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  key: _step == PromotionStep.confirm
                      ? const Key('promotion-confirm-button')
                      : null,
                  onPressed: _step == PromotionStep.confirm
                      ? (_submitting ? null : _confirm)
                      : (_step == PromotionStep.plans && _selected == null
                            ? null
                            : _continue),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF35C6C3),
                    foregroundColor: const Color(0xFF061313),
                  ),
                  child: Text(
                    _step == PromotionStep.confirm
                        ? (_submitting ? 'Creating...' : 'Confirm promotion')
                        : 'Continue',
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body() => switch (_step) {
    PromotionStep.plans => FutureBuilder<List<PromotionPlan>>(
      future: _plans,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        final plans = snapshot.data ?? const [];
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Choose a plan', style: _heading),
            const SizedBox(height: 12),
            for (final plan in plans)
              _PlanTile(
                plan: plan,
                selected: _selected?.id == plan.id,
                onTap: () => setState(() => _selected = plan),
              ),
          ],
        );
      },
    ),
    PromotionStep.targeting => _TargetingStep(
      plan: _selected!,
      targeting: _targeting,
      onChanged: (value) => setState(() => _targeting = value),
    ),
    PromotionStep.preview => _PreviewStep(post: widget.post.displayedPost),
    PromotionStep.confirm => _ConfirmStep(
      plan: _selected!,
      targeting: _targeting,
    ),
  };
}

const _heading = TextStyle(
  color: Colors.white,
  fontSize: 20,
  fontWeight: FontWeight.w800,
);

class _Progress extends StatelessWidget {
  const _Progress({required this.step});
  final PromotionStep step;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
    child: Row(
      children: [
        for (var index = 0; index < PromotionStep.values.length; index++)
          Expanded(
            child: Container(
              height: 4,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              color: index <= step.index
                  ? const Color(0xFF35C6C3)
                  : const Color(0xFF30343C),
            ),
          ),
      ],
    ),
  );
}

class _PlanTile extends StatelessWidget {
  const _PlanTile({
    required this.plan,
    required this.selected,
    required this.onTap,
  });
  final PromotionPlan plan;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      onTap: onTap,
      tileColor: const Color(0xFF1A1D23),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(7),
        side: BorderSide(
          color: selected ? const Color(0xFF35C6C3) : const Color(0xFF343944),
        ),
      ),
      title: Text(
        plan.name,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
      subtitle: Text(
        '${plan.estimatedReach.min}-${plan.estimatedReach.max} estimated reach · ${plan.duration.inHours}h',
        style: const TextStyle(color: Color(0xFFA8AFBA)),
      ),
      trailing: Text(
        '${plan.creditCost} C',
        style: const TextStyle(
          color: Color(0xFFFFD56A),
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
  );
}

class _TargetingStep extends StatelessWidget {
  const _TargetingStep({
    required this.plan,
    required this.targeting,
    required this.onChanged,
  });
  final PromotionPlan plan;
  final PromotionTargeting targeting;
  final ValueChanged<PromotionTargeting> onChanged;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Text('Targeting', style: _heading),
      const SizedBox(height: 8),
      const Text(
        'Automatic targeting uses engagement signals to find likely viewers.',
        style: TextStyle(color: Color(0xFFA8AFBA)),
      ),
      const SizedBox(height: 16),
      SegmentedButton<String>(
        segments: const [
          ButtonSegment(value: 'automatic', label: Text('Automatic')),
          ButtonSegment(value: 'global', label: Text('Global')),
        ],
        selected: {targeting.mode},
        onSelectionChanged: (value) =>
            onChanged(PromotionTargeting(mode: value.first)),
      ),
      if (plan.capabilities.location) ...[
        const SizedBox(height: 18),
        TextField(
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            labelText: 'Location (optional)',
            border: OutlineInputBorder(),
          ),
          onChanged: (value) => onChanged(
            PromotionTargeting(mode: targeting.mode, location: value),
          ),
        ),
      ],
    ],
  );
}

class _PreviewStep extends StatelessWidget {
  const _PreviewStep({required this.post});
  final FeedPost post;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Text('Preview', style: _heading),
      const SizedBox(height: 14),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1D23),
          borderRadius: BorderRadius.circular(7),
          border: Border.all(color: const Color(0xFF343944)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    post.authorName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const Text(
                  'Promoted',
                  style: TextStyle(
                    color: Color(0xFFFFD56A),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(post.body, style: const TextStyle(color: Colors.white70)),
          ],
        ),
      ),
    ],
  );
}

class _ConfirmStep extends StatelessWidget {
  const _ConfirmStep({required this.plan, required this.targeting});
  final PromotionPlan plan;
  final PromotionTargeting targeting;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Text('Confirm', style: _heading),
      const SizedBox(height: 14),
      _summary('Plan', plan.name),
      _summary('Cost', '${plan.creditCost} credits'),
      _summary('Duration', '${plan.duration.inHours} hours'),
      _summary(
        'Estimated reach',
        '${plan.estimatedReach.min}-${plan.estimatedReach.max}',
      ),
      _summary('Targeting', targeting.mode),
    ],
  );
  Widget _summary(String label, String value) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label, style: const TextStyle(color: Color(0xFFA8AFBA))),
    trailing: Text(
      value,
      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
    ),
  );
}
