import 'package:flutter/material.dart';

import '../contacts_theme.dart';

/// A compact pill button used as the trailing action on contact rows
/// (Follow / Following / Invite / Add). Filled+gradient when [filled], outlined
/// otherwise; shows a small spinner while [busy].
class ContactActionButton extends StatelessWidget {
  const ContactActionButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.filled = true,
    this.busy = false,
  });

  final String label;
  final IconData? icon;

  /// Null disables the button (rendered dimmed).
  final VoidCallback? onTap;

  /// Gradient-filled (primary) vs outlined (secondary) appearance.
  final bool filled;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !busy;
    final fg = filled
        ? ContactsColors.primaryForeground
        : ContactsColors.foreground;

    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (busy)
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(fg),
            ),
          )
        else if (icon != null) ...[
          Icon(icon, size: 15, color: fg),
        ],
        if ((busy || icon != null)) const SizedBox(width: ContactsSpacing.xs),
        Text(
          label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: fg),
        ),
      ],
    );

    final decoration = filled
        ? const BoxDecoration(
            gradient: ContactsGradients.primary,
            borderRadius: ContactsRadii.chip,
          )
        : BoxDecoration(
            color: ContactsColors.cardElevated,
            borderRadius: ContactsRadii.chip,
            border: Border.all(color: ContactsColors.border),
          );

    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: DecoratedBox(
        decoration: decoration,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: ContactsRadii.chip,
            onTap: enabled ? onTap : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ContactsSpacing.md,
                vertical: ContactsSpacing.sm,
              ),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}
