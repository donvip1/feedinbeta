import 'package:flutter/material.dart';

import '../create_tokens.dart';

/// Stateless bottom action row for the post composer.
///
/// Encapsulates the Post-button validation/state machine so the composer panel
/// doesn't have to. Layout is a single [Row]:
///   [Draft]  ──Spacer──  [ Post ]
///
/// Button behaviour (web parity — derived purely from props, no internal state):
///   * `onSaveDraft != null`  -> leading `TextButton.icon` ("Draft"), disabled
///     while [isSubmitting].
///   * [isSubmitting]         -> primary pill shows a 16px white spinner +
///     "Posting..." and ignores taps.
///   * `!isSubmitting && !canSubmit` -> primary pill at 0.5 opacity, `onTap`
///     null (no caption and no media).
///   * [canSubmit]            -> primary pill at full opacity, `onTap` = [onSubmit].
class PostActionBar extends StatelessWidget {
  const PostActionBar({
    super.key,
    required this.canSubmit,
    required this.isSubmitting,
    required this.onSubmit,
    this.onSaveDraft,
  });

  /// Whether the post is in a submittable state (caption, media, or both).
  /// Ignored while [isSubmitting] is true.
  final bool canSubmit;

  /// True while a submit is in flight: spinner + "Posting...", taps ignored.
  final bool isSubmitting;

  /// Fired when the primary pill is tapped in the enabled state.
  final VoidCallback onSubmit;

  /// When non-null, renders the leading "Draft" button. Disabled while
  /// submitting.
  final VoidCallback? onSaveDraft;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (onSaveDraft != null)
          TextButton.icon(
            onPressed: isSubmitting ? null : onSaveDraft,
            icon: const Icon(
              Icons.save_outlined,
              size: 18,
              color: CreateColors.mutedForeground,
            ),
            label: const Text('Draft'),
            style: TextButton.styleFrom(
              foregroundColor: CreateColors.mutedForeground,
              disabledForegroundColor: CreateColors.mutedForeground,
              textStyle: CreateTextStyles.pillLabel,
              padding: const EdgeInsets.symmetric(
                horizontal: CreateSpacing.md,
                vertical: CreateSpacing.sm,
              ),
              shape: const RoundedRectangleBorder(
                borderRadius: CreateRadii.chip,
              ),
            ),
          ),
        const Spacer(),
        _PostPill(
          canSubmit: canSubmit,
          isSubmitting: isSubmitting,
          onSubmit: onSubmit,
        ),
      ],
    );
  }
}

/// The primary "Post" pill. Opacity + label + tap-handler are all derived from
/// props so the parent ([PostActionBar]) stays stateless.
class _PostPill extends StatelessWidget {
  const _PostPill({
    required this.canSubmit,
    required this.isSubmitting,
    required this.onSubmit,
  });

  final bool canSubmit;
  final bool isSubmitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    // Enabled only when not submitting AND submittable. Submitting and the
    // disabled (empty-caption) state both swallow taps.
    final bool isEnabled = canSubmit && !isSubmitting;

    // Reduced opacity is the web disabled styling; submitting renders at full
    // opacity (the spinner conveys the busy state).
    final double opacity = (!isSubmitting && !canSubmit) ? 0.5 : 1.0;

    final pill = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: CreateSpacing.xl,
        vertical: CreateSpacing.md,
      ),
      decoration: const BoxDecoration(
        gradient: CreateGradients.primaryAction,
        borderRadius: CreateRadii.chip,
      ),
      child: isSubmitting ? _buildSubmittingLabel() : _buildIdleLabel(),
    );

    return Opacity(
      opacity: opacity,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: isEnabled ? onSubmit : null,
          borderRadius: CreateRadii.chip,
          child: pill,
        ),
      ),
    );
  }

  Widget _buildIdleLabel() {
    return const Text('Post', style: CreateTextStyles.buttonLabel);
  }

  Widget _buildSubmittingLabel() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: const [
        SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(
              CreateColors.primaryForeground,
            ),
          ),
        ),
        SizedBox(width: CreateSpacing.sm),
        Text('Posting...', style: CreateTextStyles.buttonLabel),
      ],
    );
  }
}
