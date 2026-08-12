import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/media/cached_image.dart';
import '../feed_item.dart';
import 'feed_immersive_theme.dart';

/// Full-screen sponsored card rendered inline in the immersive pager for a
/// [FeedAd] injected by the server feed engine. Mirrors the immersive post
/// layout (edge-to-edge media, bottom metadata) but is clearly badged
/// "Sponsored" and carries a CTA that opens the advertiser's link.
class SponsoredFeedCard extends StatelessWidget {
  const SponsoredFeedCard({
    super.key,
    required this.ad,
    required this.onCta,
  });

  final FeedAd ad;

  /// Invoked when the CTA (or card) is tapped — opens [FeedAd.clickUrl] and
  /// records a click impression. No-op safe if there is no link.
  final VoidCallback onCta;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final isVideo = ad.mediaType == 'video';
    return ColoredBox(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Media (video ads show their poster frame; tap opens the link).
          Positioned.fill(
            child: isVideo
                ? _AdVideoPoster(url: ad.mediaUrl)
                : CachedImage(
                    url: ad.mediaUrl,
                    fit: BoxFit.cover,
                    errorWidget: const ColoredBox(color: Color(0xFF11151F)),
                  ),
          ),
          // Legibility scrim toward the bottom.
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.center,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xCC000000)],
                ),
              ),
            ),
          ),
          // "Sponsored" chip, top-left.
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            child: const _SponsoredChip(),
          ),
          // Advertiser + caption + CTA, bottom.
          Positioned(
            left: 16,
            right: 16,
            bottom: bottomInset + 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (ad.advertiserName?.isNotEmpty == true)
                  Text(
                    ad.advertiserName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: FeedImmersiveTheme.authorName,
                  ),
                const SizedBox(height: 6),
                Text(
                  ad.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: FeedImmersiveTheme.onMedia,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    shadows: FeedImmersiveTheme.textShadow,
                  ),
                ),
                if (ad.description?.isNotEmpty == true) ...[
                  const SizedBox(height: 6),
                  Text(
                    ad.description!,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: FeedImmersiveTheme.onMediaMuted,
                      fontSize: 13.5,
                      height: 1.35,
                      shadows: FeedImmersiveTheme.textShadow,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                _CtaButton(onTap: onCta),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SponsoredChip extends StatelessWidget {
  const _SponsoredChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
        border: Border.all(color: FeedImmersiveTheme.glassBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(
            Icons.campaign_rounded,
            size: 14,
            color: FeedImmersiveTheme.onMedia,
          ),
          SizedBox(width: 5),
          Text(
            'Sponsored',
            style: TextStyle(
              color: FeedImmersiveTheme.onMedia,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _CtaButton extends StatelessWidget {
  const _CtaButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: FeedImmersiveTheme.brandGradient,
          borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
          boxShadow: FeedImmersiveTheme.brandGlow,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
            onTap: () {
              HapticFeedback.selectionClick();
              onTap();
            },
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 13),
              child: Center(
                child: Text(
                  'Learn More',
                  style: TextStyle(
                    color: FeedImmersiveTheme.onMedia,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A still poster for a video ad (no autoplay in the ad slot to keep it
/// lightweight). Uses the first frame via the network image; tapping opens the
/// link like the rest of the card.
class _AdVideoPoster extends StatelessWidget {
  const _AdVideoPoster({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        CachedImage(
          url: url,
          fit: BoxFit.cover,
          errorWidget: const ColoredBox(color: Color(0xFF11151F)),
        ),
        const Center(
          child: Icon(
            Icons.play_circle_fill_rounded,
            size: 64,
            color: Color(0xE6FFFFFF),
          ),
        ),
      ],
    );
  }
}
