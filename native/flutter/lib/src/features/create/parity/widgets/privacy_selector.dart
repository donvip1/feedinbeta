import 'package:flutter/material.dart';

import '../create_tokens.dart';
import '../create_view_models.dart';

/// Horizontal [Wrap] of four selectable privacy pills — one per [PostPrivacy]
/// value (everyone / friends / followers / onlyMe) — matching the
/// `privacyOptions` row in the web `PostDetails.tsx`.
///
/// Each pill is a fully-rounded chip with an icon + label. The selected pill
/// uses the brand primary fill with [CreateColors.primaryForeground]; the rest
/// use the muted surface with [CreateColors.mutedForeground]. Tapping a pill
/// invokes [onChanged] with its value. The widget is purely presentational and
/// holds no state — it renders exactly what [value] dictates.
///
/// This replaces the legacy 3-state Public/Followers/Private cycle entirely.
class PrivacySelector extends StatelessWidget {
  const PrivacySelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  /// The currently-selected privacy option (drives which pill is highlighted).
  final PostPrivacy value;

  /// Called with the tapped pill's [PostPrivacy] value.
  final ValueChanged<PostPrivacy> onChanged;

  /// Web parity icon mapping for each privacy option:
  ///   everyone  -> Globe      (Icons.public)
  ///   friends   -> Users      (Icons.group_outlined)
  ///   followers -> UserCheck  (Icons.person_outline)
  ///   onlyMe    -> Lock       (Icons.lock_outline)
  static IconData _iconFor(PostPrivacy privacy) {
    switch (privacy) {
      case PostPrivacy.everyone:
        return Icons.public;
      case PostPrivacy.friends:
        return Icons.group_outlined;
      case PostPrivacy.followers:
        return Icons.person_outline;
      case PostPrivacy.onlyMe:
        return Icons.lock_outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: CreateSpacing.sm,
      runSpacing: CreateSpacing.sm,
      children: [
        for (final option in PostPrivacy.values)
          _PrivacyPill(
            privacy: option,
            isSelected: option == value,
            onTap: () => onChanged(option),
          ),
      ],
    );
  }
}

/// A single rounded privacy pill. Private to this file so [PrivacySelector]
/// stays the only public surface.
class _PrivacyPill extends StatelessWidget {
  const _PrivacyPill({
    required this.privacy,
    required this.isSelected,
    required this.onTap,
  });

  final PostPrivacy privacy;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color iconColor = isSelected
        ? CreateColors.primaryForeground
        : CreateColors.mutedForeground;
    final TextStyle labelStyle = isSelected
        ? CreateTextStyles.pillLabelSelected
        : CreateTextStyles.pillLabel;

    return Material(
      type: MaterialType.transparency,
      borderRadius: CreateRadii.chip,
      child: InkWell(
        onTap: onTap,
        borderRadius: CreateRadii.chip,
        // An animated fill (gradient when selected) gives the pill a smoother
        // selection transition than a hard color swap, matching the web feel.
        child: AnimatedContainer(
          duration: CreateMotion.fast,
          curve: CreateMotion.emphasized,
          padding: const EdgeInsets.symmetric(
            horizontal: CreateSpacing.md,
            vertical: CreateSpacing.sm,
          ),
          decoration: BoxDecoration(
            gradient: isSelected ? CreateGradients.primaryAction : null,
            color: isSelected ? null : CreateColors.muted,
            borderRadius: CreateRadii.chip,
            boxShadow: isSelected ? CreateShadows.pink : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                PrivacySelector._iconFor(privacy),
                size: 16,
                color: iconColor,
              ),
              const SizedBox(width: CreateSpacing.xs + 2),
              Text(privacy.label, style: labelStyle),
            ],
          ),
        ),
      ),
    );
  }
}
