/// Tappable stats row (Posts / Followers / Following / Views) for the modern
/// profile header.
///
/// Pure presentational: it renders the counts supplied in a [ProfileCountsView]
/// and forwards taps via typed callbacks. The host decides what each stat does
/// (open the connections modal, jump to the Posts tab, etc.). Counts are
/// formatted with the shared [compactCount] helper for 1.2K / 3.4M parity.
library;

import 'package:flutter/material.dart';

import '../parity/profile_tokens.dart';
import '../parity/profile_view_models.dart';

/// Which stat a tap targeted.
enum ProfileStat { posts, followers, following, views }

/// Horizontal row of stat columns separated by hairline dividers. Views is
/// shown only when [showViews] and the count is > 0 so the row stays honest.
class ProfileStatsRow extends StatelessWidget {
  const ProfileStatsRow({
    super.key,
    required this.counts,
    required this.onTap,
    this.showViews = true,
  });

  final ProfileCountsView counts;
  final ValueChanged<ProfileStat> onTap;
  final bool showViews;

  @override
  Widget build(BuildContext context) {
    final includeViews = showViews && counts.views > 0;
    final columns = <Widget>[
      _StatColumn(
        value: counts.posts,
        label: 'Posts',
        onTap: () => onTap(ProfileStat.posts),
      ),
      _StatColumn(
        value: counts.followers,
        label: 'Followers',
        onTap: () => onTap(ProfileStat.followers),
      ),
      _StatColumn(
        value: counts.following,
        label: 'Following',
        onTap: () => onTap(ProfileStat.following),
      ),
      if (includeViews)
        _StatColumn(
          value: counts.views,
          label: 'Views',
          onTap: () => onTap(ProfileStat.views),
        ),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ProfileSpacing.sm,
        vertical: ProfileSpacing.md,
      ),
      decoration: BoxDecoration(
        color: ProfileColors.cardTranslucent,
        borderRadius: ProfileRadii.card,
        border: Border.all(color: ProfileColors.border),
      ),
      child: Row(
        children: [
          for (var i = 0; i < columns.length; i++) ...[
            if (i > 0) const _StatDivider(),
            Expanded(child: columns[i]),
          ],
        ],
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({
    required this.value,
    required this.label,
    required this.onTap,
  });

  final int value;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: ProfileRadii.tile,
      child: InkWell(
        onTap: onTap,
        borderRadius: ProfileRadii.tile,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: ProfileSpacing.xs),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                compactCount(value),
                style: ProfileTextStyles.statValue,
              ),
              const SizedBox(height: 2),
              Text(label, style: ProfileTextStyles.statLabel),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 34,
      color: ProfileColors.border,
    );
  }
}
