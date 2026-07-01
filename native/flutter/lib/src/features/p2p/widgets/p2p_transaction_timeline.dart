import 'package:flutter/material.dart';

import '../data/p2p_models.dart';
import '../p2p_theme.dart';

enum _StepState { completed, current, pending, error }

class _TimelineStep {
  const _TimelineStep({
    required this.label,
    required this.description,
    required this.state,
  });
  final String label;
  final String description;
  final _StepState state;
}

/// Vertical progress timeline for a transaction, ported from the web
/// `P2PTransactionTimeline`. Derives the step states from the transaction
/// status and whether the viewer is the buyer.
class P2PTransactionTimeline extends StatelessWidget {
  const P2PTransactionTimeline({
    super.key,
    required this.transaction,
    required this.isBuyer,
  });

  final P2PTransaction transaction;
  final bool isBuyer;

  List<_TimelineStep> _buildSteps() {
    final status = transaction.status;
    final steps = <_TimelineStep>[
      const _TimelineStep(
        label: 'Transaction created',
        description: 'Credits locked in escrow',
        state: _StepState.completed,
      ),
      _TimelineStep(
        label: isBuyer ? 'Make payment' : 'Waiting for payment',
        description: isBuyer
            ? 'Pay the seller and upload proof'
            : 'Buyer makes payment and uploads proof',
        state: status == 'pending'
            ? _StepState.current
            : const ['proof_submitted', 'completed', 'disputed'].contains(status)
            ? _StepState.completed
            : _StepState.pending,
      ),
      _TimelineStep(
        label: 'Proof submitted',
        description: 'Payment proof uploaded for verification',
        state: status == 'proof_submitted'
            ? _StepState.current
            : status == 'completed'
            ? _StepState.completed
            : _StepState.pending,
      ),
      _TimelineStep(
        label: isBuyer ? 'Seller confirms' : 'Confirm receipt',
        description: isBuyer
            ? 'Seller verifies payment and releases credits'
            : 'Verify payment and release credits',
        state: status == 'completed' ? _StepState.completed : _StepState.pending,
      ),
      _TimelineStep(
        label: 'Transaction complete',
        description: 'Credits transferred to buyer',
        state: status == 'completed' ? _StepState.completed : _StepState.pending,
      ),
    ];

    if (status == 'disputed') {
      final index = steps.indexWhere(
        (s) => s.state == _StepState.current || s.state == _StepState.pending,
      );
      steps.insert(
        index > 0 ? index : 2,
        const _TimelineStep(
          label: 'Dispute opened',
          description: 'Transaction under moderator review',
          state: _StepState.error,
        ),
      );
    }

    if (status == 'cancelled' || status == 'refunded') {
      final index = steps.indexWhere((s) => s.state != _StepState.completed);
      if (index > 0) {
        steps[index] = _TimelineStep(
          label: status == 'refunded'
              ? 'Transaction refunded'
              : 'Transaction cancelled',
          description: 'Credits refunded to seller',
          state: _StepState.error,
        );
        steps.removeRange(index + 1, steps.length);
      }
    }

    return steps;
  }

  @override
  Widget build(BuildContext context) {
    final steps = _buildSteps();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++)
          _StepRow(step: steps[i], isLast: i == steps.length - 1),
      ],
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.step, required this.isLast});

  final _TimelineStep step;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _visuals(step.state);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: color),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: step.state == _StepState.completed
                        ? P2PTheme.success.withValues(alpha: 0.35)
                        : P2PTheme.border,
                  ),
                ),
            ],
          ),
          const SizedBox(width: P2PTheme.md),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : P2PTheme.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    step.label,
                    style: P2PTheme.body.copyWith(
                      fontWeight: FontWeight.w700,
                      color: step.state == _StepState.pending
                          ? P2PTheme.faintForeground
                          : P2PTheme.foreground,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(step.description, style: P2PTheme.meta),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static (IconData, Color) _visuals(_StepState state) {
    switch (state) {
      case _StepState.completed:
        return (Icons.check_circle, P2PTheme.success);
      case _StepState.current:
        return (Icons.schedule, P2PTheme.primary);
      case _StepState.error:
        return (Icons.warning_amber_rounded, P2PTheme.danger);
      case _StepState.pending:
        return (Icons.circle_outlined, P2PTheme.faintForeground);
    }
  }
}
