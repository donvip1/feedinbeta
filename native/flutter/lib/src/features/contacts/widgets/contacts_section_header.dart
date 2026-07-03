import 'package:flutter/material.dart';

import '../contacts_theme.dart';

/// An uppercase muted section label with an optional count pill, used to head
/// the "On feedIn" and "Invite to feedIn" lists.
class ContactsSectionHeader extends StatelessWidget {
  const ContactsSectionHeader({super.key, required this.label, this.count});

  final String label;
  final int? count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ContactsSpacing.lg + ContactsSpacing.md,
        ContactsSpacing.lg,
        ContactsSpacing.lg,
        ContactsSpacing.sm,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label.toUpperCase(),
              style: ContactsTextStyles.sectionLabel,
            ),
          ),
          if (count != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: const BoxDecoration(
                color: ContactsColors.mutedSoft,
                borderRadius: ContactsRadii.chip,
              ),
              child: Text(
                '$count',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: ContactsColors.mutedForeground,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
