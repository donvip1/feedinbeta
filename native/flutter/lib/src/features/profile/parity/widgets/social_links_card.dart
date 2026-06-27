/// "Social Links" card — brand-styled pills for a profile's external links.
///
/// Ports the web Profile.tsx "Social Links" block: a translucent card titled
/// "Social Links" with a wrap of brand-colored pills (Instagram, Twitter,
/// LinkedIn, Facebook, TikTok, YouTube, Website) rendered only for the networks
/// that have a URL. Pills are ordered to match the web markup.
///
/// Pure presentational: takes a resolved list of [SocialLinkVm] and an
/// [onOpen] callback invoked with the tapped URL. URL opening (or
/// copy-to-clipboard fallback) is the host's responsibility — no `url_launcher`
/// or repo access here. Renders nothing when [links] is empty (web hides the
/// whole card when no links exist).
///
/// Web parity references:
///   - src/pages/Profile.tsx ("Social Links" card markup, per-network colors)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';

/// Translucent card listing a profile's social links as brand pills.
class SocialLinksCard extends StatelessWidget {
  const SocialLinksCard({super.key, required this.links, required this.onOpen});

  /// Resolved links (already filtered to present URLs, in render order).
  final List<SocialLinkVm> links;

  /// Called with the tapped link's URL (host opens or copies it).
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    if (links.isEmpty) return const SizedBox.shrink();

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
          Row(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(Icons.link, size: 16, color: ProfileColors.foreground),
              SizedBox(width: ProfileSpacing.sm),
              Text('Social Links', style: ProfileTextStyles.sectionTitle),
            ],
          ),
          const SizedBox(height: ProfileSpacing.lg),
          Wrap(
            spacing: ProfileSpacing.sm,
            runSpacing: ProfileSpacing.sm,
            children: [
              for (final link in links)
                _SocialPill(link: link, onTap: () => onOpen(link.url)),
            ],
          ),
        ],
      ),
    );
  }
}

/// One brand-styled social pill (icon + label). Single-color networks render a
/// flat fill; Instagram and Website render gradients (web parity). TikTok uses
/// a white fill with black foreground.
class _SocialPill extends StatelessWidget {
  const _SocialPill({required this.link, required this.onTap});

  final SocialLinkVm link;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final gradient = _gradientFor(link.network);
    final fill = gradient == null ? _colorFor(link.network) : null;
    final fg = _foregroundFor(link.network);

    return Material(
      color: fill ?? Colors.transparent,
      borderRadius: ProfileRadii.tile, // web rounded-lg
      child: Ink(
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: ProfileRadii.tile,
          boxShadow: ProfileShadows.socialPill,
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: ProfileRadii.tile,
          child: Padding(
            // web px-4 py-2.5
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(_iconFor(link.network), size: 16, color: fg),
                const SizedBox(width: ProfileSpacing.sm),
                Text(
                  link.label,
                  style: ProfileTextStyles.socialPill.copyWith(color: fg),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static IconData _iconFor(SocialNetwork network) {
    switch (network) {
      case SocialNetwork.instagram:
        return Icons.camera_alt; // Instagram
      case SocialNetwork.twitter:
        return Icons.alternate_email; // Twitter
      case SocialNetwork.linkedin:
        return Icons.work; // LinkedIn
      case SocialNetwork.facebook:
        return Icons.facebook; // Facebook
      case SocialNetwork.tiktok:
        return Icons.mic; // web TikTok uses Mic icon
      case SocialNetwork.youtube:
        return Icons.smart_display; // YouTube
      case SocialNetwork.website:
        return Icons.link; // Website
    }
  }

  /// Flat fills for the single-color networks; null where a gradient is used.
  static Color? _colorFor(SocialNetwork network) {
    switch (network) {
      case SocialNetwork.twitter:
        return ProfileColors.socialTwitter;
      case SocialNetwork.linkedin:
        return ProfileColors.socialLinkedin;
      case SocialNetwork.facebook:
        return ProfileColors.socialFacebook;
      case SocialNetwork.tiktok:
        return ProfileColors.socialTiktokBg;
      case SocialNetwork.youtube:
        return ProfileColors.socialYoutube;
      case SocialNetwork.instagram:
      case SocialNetwork.website:
        return null; // gradient networks
    }
  }

  static LinearGradient? _gradientFor(SocialNetwork network) {
    switch (network) {
      case SocialNetwork.instagram:
        return ProfileGradients.socialInstagram;
      case SocialNetwork.website:
        return ProfileGradients.socialWebsite;
      case SocialNetwork.twitter:
      case SocialNetwork.linkedin:
      case SocialNetwork.facebook:
      case SocialNetwork.tiktok:
      case SocialNetwork.youtube:
        return null;
    }
  }

  /// TikTok uses black text/icon on its white fill; everything else is white.
  static Color _foregroundFor(SocialNetwork network) {
    return network == SocialNetwork.tiktok
        ? ProfileColors.socialTiktokFg
        : ProfileColors.primaryForeground;
  }
}
