/// Role + plan badge chips rendered under the profile name.
///
/// Ports the web `RolePlanBadge.tsx` ROLE_CONFIG / PLAN_CONFIG chips into a
/// pure presentational widget. The web component fetches the role/plan and a
/// viewer-is-admin gate itself; here the host resolves all of that upstream and
/// passes a [ProfileBadgeSet]. Role visibility honors
/// [ProfileBadgeSet.showRole] via [ProfileBadgeSet.visibleRole] (own profile or
/// viewer-is-admin). Renders nothing when neither chip is present.
///
/// Web parity references:
///   - src/components/profile/RolePlanBadge.tsx (labels, icons, gradients,
///     `text-[10px]`, shadow-md, gap-1.5, flex-wrap, compact px sizing)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';

/// Horizontal wrap of up to two brand-gradient chips: an optional admin role
/// chip followed by an optional subscription plan chip.
class RolePlanBadges extends StatelessWidget {
  const RolePlanBadges({
    super.key,
    required this.badges,
    this.compact = false,
  });

  /// Resolved badge bundle; role visibility already gated upstream.
  final ProfileBadgeSet badges;

  /// Web `compact` flag: tighter padding + smaller icons.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final role = badges.visibleRole;
    final plan = badges.plan;
    if (role == null && plan == null) return const SizedBox.shrink();

    return Wrap(
      spacing: 6, // web gap-1.5
      runSpacing: 6,
      children: [
        if (role != null)
          _BadgeChip(
            gradient: _roleGradient(role),
            icon: _roleIcon(role),
            label: _roleLabel(role),
            compact: compact,
          ),
        if (plan != null)
          _BadgeChip(
            gradient: _planGradient(plan),
            icon: _planIcon(plan),
            label: _planLabel(plan),
            compact: compact,
          ),
      ],
    );
  }

  // --- Role mapping (web ROLE_CONFIG). ---
  static String _roleLabel(RoleBadgeKind role) {
    switch (role) {
      case RoleBadgeKind.superAdmin:
        return 'Full Access';
      case RoleBadgeKind.developer:
        return 'Developer';
      case RoleBadgeKind.admin:
        return 'Admin';
      case RoleBadgeKind.moderator:
        return 'Moderator';
    }
  }

  static IconData _roleIcon(RoleBadgeKind role) {
    switch (role) {
      case RoleBadgeKind.superAdmin:
        return Icons.workspace_premium; // Crown
      case RoleBadgeKind.developer:
        return Icons.code; // Code
      case RoleBadgeKind.admin:
        return Icons.shield; // Shield
      case RoleBadgeKind.moderator:
        return Icons.star; // Star
    }
  }

  static LinearGradient _roleGradient(RoleBadgeKind role) {
    switch (role) {
      case RoleBadgeKind.superAdmin:
        return ProfileGradients.roleSuperAdmin;
      case RoleBadgeKind.developer:
        return ProfileGradients.roleDeveloper;
      case RoleBadgeKind.admin:
        return ProfileGradients.roleAdmin;
      case RoleBadgeKind.moderator:
        return ProfileGradients.roleModerator;
    }
  }

  // --- Plan mapping (web PLAN_CONFIG). ---
  static String _planLabel(PlanBadgeKind plan) {
    switch (plan) {
      case PlanBadgeKind.premium:
        return 'Premium';
      case PlanBadgeKind.pro:
        return 'Pro';
      case PlanBadgeKind.popular:
        return 'Popular';
    }
  }

  static IconData _planIcon(PlanBadgeKind plan) {
    switch (plan) {
      case PlanBadgeKind.premium:
        return Icons.workspace_premium; // Crown
      case PlanBadgeKind.pro:
        return Icons.auto_awesome; // Sparkles
      case PlanBadgeKind.popular:
        return Icons.bolt; // Zap
    }
  }

  static LinearGradient _planGradient(PlanBadgeKind plan) {
    switch (plan) {
      case PlanBadgeKind.premium:
        return ProfileGradients.planPremium;
      case PlanBadgeKind.pro:
        return ProfileGradients.planPro;
      case PlanBadgeKind.popular:
        return ProfileGradients.planPopular;
    }
  }
}

/// A single rounded brand-gradient badge chip (icon + label). Private so
/// [RolePlanBadges] remains the only public surface.
class _BadgeChip extends StatelessWidget {
  const _BadgeChip({
    required this.gradient,
    required this.icon,
    required this.label,
    required this.compact,
  });

  final LinearGradient gradient;
  final IconData icon;
  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    // web compact: px-1.5 py-0 + 10px icon; default: px-2 py-0.5 + 12px icon.
    final EdgeInsets padding = compact
        ? const EdgeInsets.symmetric(horizontal: 6, vertical: 1)
        : const EdgeInsets.symmetric(horizontal: 8, vertical: 2);
    final double iconSize = compact ? 10 : 12;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: ProfileRadii.chip,
        boxShadow: ProfileShadows.badge,
      ),
      child: Padding(
        padding: padding,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: iconSize, color: ProfileColors.primaryForeground),
            const SizedBox(width: 2), // web mr-0.5
            Text(label, style: ProfileTextStyles.badge),
          ],
        ),
      ),
    );
  }
}
