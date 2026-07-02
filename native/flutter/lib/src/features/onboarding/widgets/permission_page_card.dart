import 'package:flutter/material.dart';

import '../permission_flow_controller.dart';

/// One full-page onboarding card: illustration, title, why-copy and the
/// Allow / Not now actions. When the step is permanently denied it swaps the
/// primary action for an "Open Settings" deep link, and it renders inline
/// loading + error states while a request is in flight or has failed.
///
/// Purely presentational — all state comes in via props and all intent goes
/// out via callbacks, so it needs no controller reference and is trivial to
/// preview or golden-test.
class PermissionPageCard extends StatelessWidget {
  const PermissionPageCard({
    super.key,
    required this.step,
    required this.outcome,
    required this.isRequesting,
    required this.needsSettings,
    required this.errorMessage,
    required this.onAllow,
    required this.onSkip,
    required this.onOpenSettings,
    required this.onRetry,
  });

  final PermissionOnboardingStep step;

  /// Aggregate outcome for the step, or null if not yet decided.
  final PermissionOutcome? outcome;

  final bool isRequesting;
  final bool needsSettings;
  final String? errorMessage;

  final VoidCallback onAllow;
  final VoidCallback onSkip;
  final VoidCallback onOpenSettings;
  final VoidCallback onRetry;

  IconData get _icon {
    switch (step.id) {
      case OnboardingStepId.notifications:
        return Icons.notifications_active_outlined;
      case OnboardingStepId.microphoneCamera:
        return Icons.videocam_outlined;
      case OnboardingStepId.contacts:
        return Icons.contacts_outlined;
      case OnboardingStepId.photos:
        return Icons.photo_library_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Spacer(flex: 2),
          _Illustration(icon: _icon, color: colors.primary),
          const SizedBox(height: 40),
          Text(
            step.title,
            textAlign: TextAlign.center,
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          Text(
            step.rationale,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colors.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          if (outcome != null) ...[
            const SizedBox(height: 20),
            Center(child: _OutcomeChip(outcome: outcome!)),
          ],
          if (errorMessage != null) ...[
            const SizedBox(height: 16),
            _ErrorBanner(message: errorMessage!, onRetry: onRetry),
          ],
          const Spacer(flex: 3),
          _Actions(
            step: step,
            isRequesting: isRequesting,
            needsSettings: needsSettings,
            onAllow: onAllow,
            onSkip: onSkip,
            onOpenSettings: onOpenSettings,
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _Illustration extends StatelessWidget {
  const _Illustration({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 132,
        height: 132,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withValues(alpha: 0.12),
        ),
        child: Icon(icon, size: 60, color: color),
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.step,
    required this.isRequesting,
    required this.needsSettings,
    required this.onAllow,
    required this.onSkip,
    required this.onOpenSettings,
  });

  final PermissionOnboardingStep step;
  final bool isRequesting;
  final bool needsSettings;
  final VoidCallback onAllow;
  final VoidCallback onSkip;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final primary = needsSettings
        ? FilledButton.icon(
            onPressed: isRequesting ? null : onOpenSettings,
            icon: const Icon(Icons.settings_outlined, size: 20),
            label: const Text('Open Settings'),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          )
        : FilledButton(
            onPressed: isRequesting ? null : onAllow,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: isRequesting
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  )
                : Text(step.allowLabel),
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        primary,
        const SizedBox(height: 8),
        TextButton(
          onPressed: isRequesting ? null : onSkip,
          style: TextButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          child: Text(step.skipLabel),
        ),
      ],
    );
  }
}

class _OutcomeChip extends StatelessWidget {
  const _OutcomeChip({required this.outcome});

  final PermissionOutcome outcome;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    late final IconData icon;
    late final String label;
    late final Color color;
    switch (outcome) {
      case PermissionOutcome.granted:
        icon = Icons.check_circle_outline;
        label = 'Allowed';
        color = Colors.green;
      case PermissionOutcome.denied:
        icon = Icons.info_outline;
        label = 'Not allowed — you can enable it later';
        color = colors.onSurfaceVariant;
      case PermissionOutcome.permanentlyDenied:
        icon = Icons.lock_outline;
        label = 'Blocked — change it in Settings';
        color = colors.error;
      case PermissionOutcome.skipped:
        icon = Icons.schedule_outlined;
        label = 'Skipped for now';
        color = colors.onSurfaceVariant;
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context)
                .textTheme
                .labelLarge
                ?.copyWith(color: color),
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: colors.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, size: 20, color: colors.onErrorContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: colors.onErrorContainer),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
