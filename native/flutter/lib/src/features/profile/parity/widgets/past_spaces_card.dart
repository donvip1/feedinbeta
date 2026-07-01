/// "Past Spaces" section — a user's ended live spaces with optional replays.
///
/// Ports the web `PastSpaces.tsx` list: a "Past Spaces (n)" header over a
/// column of rows. Each row shows a 56px cover (or a mic-icon placeholder with
/// a play overlay when a recording exists), the title, and a meta line with the
/// relative end time, duration and viewer count. Rows with a replay get a
/// "Replay" pill. Tapping a row invokes [onOpenSpace] with the space id.
///
/// Pure presentational: renders a [PastSpacesView] and forwards taps. No repo
/// or Supabase access — the host resolves rows via
/// `ProfileSectionsRemoteDataSource`. Renders nothing when there is no content
/// (matches the web, which returns null when the list is empty).
///
/// Web parity references:
///   - src/components/profile/PastSpaces.tsx (header, rows, cover/mic
///     placeholder, replay pill, duration + viewer meta, relative time)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';

/// The whole Past Spaces section. Stateless — state lives in the view.
class PastSpacesCard extends StatelessWidget {
  const PastSpacesCard({
    super.key,
    required this.view,
    required this.onOpenSpace,
  });

  final PastSpacesView view;

  /// Called with a space id when a row is tapped.
  final ValueChanged<String> onOpenSpace;

  @override
  Widget build(BuildContext context) {
    // Web hides the whole section while loading or when empty.
    if (view.isLoading || !view.hasContent) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.mic, size: 18, color: ProfileColors.primary),
            const SizedBox(width: ProfileSpacing.sm),
            Text(
              'Past Spaces (${view.spaces.length})',
              style: ProfileTextStyles.sectionTitle,
            ),
          ],
        ),
        const SizedBox(height: ProfileSpacing.md),
        for (var i = 0; i < view.spaces.length; i++) ...[
          if (i > 0) const SizedBox(height: ProfileSpacing.md),
          _PastSpaceRow(
            space: view.spaces[i],
            onTap: () => onOpenSpace(view.spaces[i].id),
          ),
        ],
      ],
    );
  }
}

class _PastSpaceRow extends StatelessWidget {
  const _PastSpaceRow({required this.space, required this.onTap});

  final PastSpaceView space;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: ProfileColors.card,
      borderRadius: ProfileRadii.card,
      child: InkWell(
        onTap: onTap,
        borderRadius: ProfileRadii.card,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: ProfileRadii.card,
            border: Border.all(color: ProfileColors.border),
          ),
          padding: const EdgeInsets.all(ProfileSpacing.md),
          child: Row(
            children: [
              _Cover(space: space),
              const SizedBox(width: ProfileSpacing.md),
              Expanded(child: _Details(space: space)),
              if (space.hasRecording) ...[
                const SizedBox(width: ProfileSpacing.sm),
                const _ReplayPill(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// 56px rounded cover. Falls back to a centered mic icon; a play overlay is
/// drawn over either state when the space has a recording (web parity).
class _Cover extends StatelessWidget {
  const _Cover({required this.space});

  final PastSpaceView space;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: ProfileRadii.card,
      child: SizedBox(
        width: 56,
        height: 56,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (space.hasCover)
              Image.network(
                space.coverImageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const _MicPlaceholder(),
              )
            else
              const _MicPlaceholder(),
            if (space.hasRecording) ...[
              const ColoredBox(color: ProfileColors.videoScrim),
              const Center(
                child: Icon(
                  Icons.play_arrow,
                  size: 20,
                  color: ProfileColors.primaryForeground,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MicPlaceholder extends StatelessWidget {
  const _MicPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: ProfileColors.muted,
      child: Center(
        child: Icon(Icons.mic, size: 24, color: ProfileColors.mutedForeground),
      ),
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.space});

  final PastSpaceView space;

  @override
  Widget build(BuildContext context) {
    final metaParts = <Widget>[];
    if (space.endedAtMillis != null) {
      metaParts.add(
        _MetaBit(
          icon: Icons.schedule,
          label: relativeTimeShort(space.endedAtMillis!),
        ),
      );
    }
    if (space.durationLabel != null) {
      metaParts.add(_MetaBit(label: space.durationLabel!));
    }
    metaParts.add(
      _MetaBit(icon: Icons.people_alt, label: compactCount(space.viewerCount)),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          space.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: ProfileTextStyles.rowName,
        ),
        const SizedBox(height: 4),
        Wrap(
          spacing: ProfileSpacing.md,
          runSpacing: 2,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: metaParts,
        ),
      ],
    );
  }
}

/// One meta bit in the row's second line (optional leading icon + label).
class _MetaBit extends StatelessWidget {
  const _MetaBit({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 12, color: ProfileColors.mutedForeground),
          const SizedBox(width: 4),
        ],
        Text(label, style: ProfileTextStyles.tinyPill),
      ],
    );
  }
}

/// Uppercase primary/10 "Replay" pill shown on rows that have a recording.
class _ReplayPill extends StatelessWidget {
  const _ReplayPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: ProfileColors.primaryFaint,
        borderRadius: ProfileRadii.chip,
      ),
      child: const Text(
        'REPLAY',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.4,
          color: ProfileColors.primary,
        ),
      ),
    );
  }
}
