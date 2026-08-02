import 'package:flutter/material.dart';

import '../../../core/realtime/incoming_message_resolver.dart';
import 'feed_immersive_theme.dart';

/// Tappable incoming-message banner rendered above the immersive Feed
/// chrome. Stays visible while the Feed chrome is hidden so a viewer
/// never misses a message just because the chrome auto-hid.
class IncomingFeedMessageBannerView extends StatelessWidget {
  const IncomingFeedMessageBannerView({
    super.key,
    required this.banner,
    required this.onTap,
  });

  final IncomingFeedMessageBanner banner;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: FeedImmersiveTheme.glassSurfaceStrong,
            borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
            border: Border.all(color: FeedImmersiveTheme.glassBorder),
            boxShadow: FeedImmersiveTheme.floatingShadow,
          ),
          child: Row(
            children: [
              _BannerAvatar(url: banner.avatarUrl, fallback: banner.senderName),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      banner.senderName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: FeedImmersiveTheme.authorName,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      banner.preview,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: FeedImmersiveTheme.caption,
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: FeedImmersiveTheme.onMedia,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BannerAvatar extends StatelessWidget {
  const _BannerAvatar({required this.url, required this.fallback});

  final String? url;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    final initial = fallback.isNotEmpty ? fallback.characters.first : '?';
    if (url == null || url!.isEmpty) {
      return CircleAvatar(
        radius: 18,
        backgroundColor: FeedImmersiveTheme.brandPink,
        child: Text(
          initial,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
    }
    return ClipOval(
      child: Image.network(
        url!,
        width: 36,
        height: 36,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => CircleAvatar(
          radius: 18,
          backgroundColor: FeedImmersiveTheme.brandPink,
          child: Text(
            initial,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }
}