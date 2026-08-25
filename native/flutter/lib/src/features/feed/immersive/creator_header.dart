import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import 'feed_immersive_theme.dart';

class CreatorHeader extends StatelessWidget {
  const CreatorHeader({
    super.key,
    required this.authorName,
    required this.handle,
    required this.avatarUrl,
    required this.isVerified,
    required this.badgeTier,
    required this.metadata,
    required this.onProfileTap,
    this.onFollow,
  });

  final String authorName;
  final String handle;
  final String? avatarUrl;
  final bool isVerified;
  final FeedAuthorBadgeTier badgeTier;
  final String metadata;
  final VoidCallback onProfileTap;
  final VoidCallback? onFollow;

  @override
  Widget build(BuildContext context) {
    final initial = authorName.trim().isEmpty
        ? '?'
        : authorName.trim().characters.first.toUpperCase();
    final imageUrl = avatarUrl?.trim();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        CircleAvatar(
          key: const Key('feed-author-avatar'),
          radius: 21,
          backgroundColor: FeedImmersiveTheme.glassSurfaceStrong,
          foregroundImage: imageUrl != null && imageUrl.isNotEmpty
              ? NetworkImage(imageUrl)
              : null,
          child: Text(
            initial,
            style: const TextStyle(
              color: FeedImmersiveTheme.onMedia,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Semantics(
                      button: true,
                      label: 'Open $authorName profile',
                      child: InkWell(
                        key: const Key('feed-author-profile'),
                        onTap: () {
                          HapticFeedback.selectionClick();
                          onProfileTap();
                        },
                        borderRadius: BorderRadius.circular(6),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Text(
                            authorName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: FeedImmersiveTheme.authorName,
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (isVerified) ...[
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.verified_rounded,
                      size: 16,
                      color: Color(0xFF35C6C3),
                    ),
                  ],
                  if (badgeTier != FeedAuthorBadgeTier.none) ...[
                    const SizedBox(width: 6),
                    _TierBadge(tier: badgeTier),
                  ],
                  if (onFollow != null) ...[
                    const SizedBox(width: 4),
                    TextButton(
                      key: const Key('feed-author-follow'),
                      onPressed: onFollow,
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF35C6C3),
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        minimumSize: const Size(0, 28),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Follow'),
                    ),
                  ],
                ],
              ),
              if (handle.trim().isNotEmpty)
                Text(
                  handle.trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: FeedImmersiveTheme.handle,
                ),
              if (metadata.trim().isNotEmpty)
                Text(
                  metadata.trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: FeedImmersiveTheme.inkMuted,
                    fontSize: 11,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TierBadge extends StatelessWidget {
  const _TierBadge({required this.tier});

  final FeedAuthorBadgeTier tier;

  @override
  Widget build(BuildContext context) {
    final premium = tier == FeedAuthorBadgeTier.premium;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: premium ? const Color(0x2EEDA94A) : const Color(0x2635C6C3),
        border: Border.all(
          color: premium ? const Color(0xFFEDA94A) : const Color(0xFF35C6C3),
        ),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
        child: Text(
          premium ? 'Premium' : 'Pro',
          style: TextStyle(
            color: premium ? const Color(0xFFFFD277) : const Color(0xFF7DE5E2),
            fontSize: 9,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
