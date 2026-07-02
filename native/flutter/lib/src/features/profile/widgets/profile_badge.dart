/// Small badge primitives for the modern profile header.
///
/// Two reusable pieces live here:
///  * [ProfileStatusDot] — the online-status dot that sits on the avatar ring.
///  * [ProfileVerifiedInline] — the inline verified/premium tick rendered right
///    after the display name, resolving the tier from a [UserProfile] via the
///    existing [ProfilePresenter] so callers don't repeat the plan logic.
///
/// Both are pure presentational widgets built on the shared profile tokens; no
/// repo or Supabase access. They intentionally reuse the parity
/// [VerifiedBadge]/[VerifiedTier] rather than reinventing badge rendering.
library;

import 'package:flutter/material.dart';

import '../parity/profile_presenter.dart';
import '../parity/profile_tokens.dart';
import '../parity/profile_view_models.dart';
import '../parity/widgets/verified_badge.dart';
import '../user_profile.dart';

/// A small filled status dot with a background-colored ring, sized to sit at
/// the corner of an avatar. Green when [online], muted otherwise.
class ProfileStatusDot extends StatelessWidget {
  const ProfileStatusDot({
    super.key,
    this.diameter = 20,
    this.ringColor = ProfileColors.background,
    this.online = true,
  });

  /// Outer diameter including the ring.
  final double diameter;

  /// Ring color — usually the surface the avatar sits on, so the dot reads as
  /// a cut-out.
  final Color ringColor;

  /// Drives the fill color (online -> emerald, offline -> muted).
  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        color: online ? ProfileColors.online : ProfileColors.mutedForeground,
        shape: BoxShape.circle,
        border: Border.all(color: ringColor, width: diameter * 0.18),
      ),
    );
  }
}

/// Inline verified/premium tick for placement right after the display name.
///
/// Resolves the tier from the profile's plan metadata (and legacy `isPremium`)
/// via [ProfilePresenter.verifiedTier]; renders nothing for
/// [VerifiedTier.none], so it can be dropped unconditionally after the name.
class ProfileVerifiedInline extends StatelessWidget {
  const ProfileVerifiedInline({
    super.key,
    required this.profile,
    this.size = BadgeSize.md,
  });

  final UserProfile profile;
  final BadgeSize size;

  @override
  Widget build(BuildContext context) {
    return VerifiedBadge(
      tier: ProfilePresenter.verifiedTier(profile),
      size: size,
    );
  }
}
