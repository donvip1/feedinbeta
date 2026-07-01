/// "Details" cards — Purpose chips + Marital Status.
///
/// Ports the web Profile.tsx "Details Section": translucent `bg-card/50` cards,
/// one titled "Purpose" holding a wrap of primary-tinted chips, and one titled
/// "Marital Status" holding a single muted line. Each card is rendered only
/// when its data is present, matching the web conditionals.
///
/// Pure presentational: takes a resolved [ProfileDetailsView]. Renders nothing
/// when the view has neither purpose nor marital status.
///
/// Web parity references:
///   - src/pages/Profile.tsx ("Details Section": Purpose card + chips, Marital
///     Status card)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';

/// The Details block: a vertical stack of the Purpose and Marital Status cards.
class ProfileDetailsCards extends StatelessWidget {
  const ProfileDetailsCards({super.key, required this.view});

  final ProfileDetailsView view;

  @override
  Widget build(BuildContext context) {
    if (view.isEmpty) return const SizedBox.shrink();

    final cards = <Widget>[];
    if (view.hasPurpose) {
      cards.add(_PurposeCard(labels: view.purposeChips));
    }
    if (view.hasMaritalStatus) {
      cards.add(_MaritalStatusCard(status: view.maritalStatus!));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(height: ProfileSpacing.lg),
          cards[i],
        ],
      ],
    );
  }
}

/// Translucent card shell shared by the Details cards (web `bg-card/50 p-5`).
class _DetailsCard extends StatelessWidget {
  const _DetailsCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ProfileColors.cardTranslucent,
        borderRadius: ProfileRadii.card,
        border: Border.all(color: ProfileColors.border),
      ),
      padding: const EdgeInsets.all(ProfileSpacing.lg + 4), // web p-5 (20)
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: ProfileTextStyles.sectionTitle),
          const SizedBox(height: ProfileSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _PurposeCard extends StatelessWidget {
  const _PurposeCard({required this.labels});

  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    return _DetailsCard(
      title: 'Purpose',
      child: Wrap(
        spacing: ProfileSpacing.sm,
        runSpacing: ProfileSpacing.sm,
        children: [for (final label in labels) _PurposeChip(label: label)],
      ),
    );
  }
}

/// Primary-tinted chip (web `bg-primary/10 text-primary`).
class _PurposeChip extends StatelessWidget {
  const _PurposeChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: ProfileColors.primaryFaint,
        borderRadius: ProfileRadii.chip,
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: ProfileColors.primary,
        ),
      ),
    );
  }
}

class _MaritalStatusCard extends StatelessWidget {
  const _MaritalStatusCard({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return _DetailsCard(
      title: 'Marital Status',
      child: Text(status, style: ProfileTextStyles.rowMuted),
    );
  }
}
