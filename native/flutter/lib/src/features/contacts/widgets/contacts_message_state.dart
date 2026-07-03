import 'package:flutter/material.dart';

import '../contacts_theme.dart';

/// A full-bleed centered state (icon bubble + title + body + optional action),
/// reused for the permission-denied, empty, no-match and error states so they
/// look consistent. Wrapped in a scroll view so it can host a RefreshIndicator.
class ContactsMessageState extends StatelessWidget {
  const ContactsMessageState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.primaryLabel,
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(ContactsSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 84,
                      height: 84,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: ContactsColors.primaryFaint,
                        boxShadow: ContactsShadows.glow,
                      ),
                      child: Container(
                        width: 60,
                        height: 60,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: ContactsGradients.primary,
                          boxShadow: ContactsShadows.pink,
                        ),
                        child: Icon(
                          icon,
                          size: 28,
                          color: ContactsColors.primaryForeground,
                        ),
                      ),
                    ),
                    const SizedBox(height: ContactsSpacing.lg),
                    Text(title, style: ContactsTextStyles.emptyTitle),
                    const SizedBox(height: ContactsSpacing.sm),
                    Text(
                      body,
                      textAlign: TextAlign.center,
                      style: ContactsTextStyles.emptyBody,
                    ),
                    if (primaryLabel != null && onPrimary != null) ...[
                      const SizedBox(height: ContactsSpacing.lg),
                      _PrimaryButton(label: primaryLabel!, onTap: onPrimary!),
                    ],
                    if (secondaryLabel != null && onSecondary != null) ...[
                      const SizedBox(height: ContactsSpacing.sm),
                      TextButton(
                        onPressed: onSecondary,
                        child: Text(
                          secondaryLabel!,
                          style: const TextStyle(
                            color: ContactsColors.mutedForeground,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: ContactsRadii.tile,
      child: InkWell(
        onTap: onTap,
        borderRadius: ContactsRadii.tile,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ContactsSpacing.xl,
            vertical: ContactsSpacing.md,
          ),
          decoration: const BoxDecoration(
            gradient: ContactsGradients.primary,
            borderRadius: ContactsRadii.tile,
            boxShadow: ContactsShadows.pink,
          ),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: ContactsColors.primaryForeground,
            ),
          ),
        ),
      ),
    );
  }
}
