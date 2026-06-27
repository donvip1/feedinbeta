/// Inline verified badge rendered right after a profile display name.
///
/// Ports the web `VerifiedBadge.tsx` rendering rules into a pure presentational
/// widget. The web component resolves a subscription tier name to one of two
/// PNG assets (`badge-premium.png` / `badge-pro.png`); since those PNGs are not
/// bundled in the native app yet, this widget renders a parity-styled icon
/// stand-in (a filled check inside a brand-tinted circle) sized to the same
/// 19/23/27px web `sm`/`md`/`lg` boxes. The host resolves the tier upstream and
/// passes a [VerifiedTier]; [VerifiedTier.none] renders nothing.
///
/// Web parity reference:
///   - src/components/profile/VerifiedBadge.tsx (sizeMap + premium/pro split)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';

/// Inline name-suffix verified badge. Renders nothing for
/// [VerifiedTier.none] so callers can drop it unconditionally after the name.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({
    super.key,
    required this.tier,
    this.size = BadgeSize.sm,
  });

  /// Resolved verified tier (none/pro/premium) decided upstream.
  final VerifiedTier tier;

  /// Render size matching the web sm/md/lg (19/23/27px) boxes.
  final BadgeSize size;

  /// Web `sizeMap`: sm 19, md 23, lg 27 (px).
  double get _diameter {
    switch (size) {
      case BadgeSize.sm:
        return 19;
      case BadgeSize.md:
        return 23;
      case BadgeSize.lg:
        return 27;
    }
  }

  /// Premium uses the brand-warm plan gradient; pro uses the brand primary.
  LinearGradient get _gradient {
    switch (tier) {
      case VerifiedTier.premium:
        return ProfileGradients.planPremium;
      case VerifiedTier.pro:
        return ProfileGradients.planPro;
      case VerifiedTier.none:
        return ProfileGradients.action;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (tier == VerifiedTier.none) return const SizedBox.shrink();
    final d = _diameter;
    return Container(
      width: d,
      height: d,
      decoration: BoxDecoration(
        gradient: _gradient,
        shape: BoxShape.circle,
        boxShadow: ProfileShadows.badge,
      ),
      alignment: Alignment.center,
      child: Icon(
        Icons.check,
        size: d * 0.62,
        color: ProfileColors.primaryForeground,
      ),
    );
  }
}
