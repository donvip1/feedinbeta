import 'package:flutter/material.dart';

import '../feed_post.dart';
import 'audio_chip.dart';
import 'bottom_metadata.dart';
import 'caption_text.dart';
import 'creator_header.dart';
import 'feed_immersive_theme.dart';

/// The bottom-left text overlay of an immersive post: an optional re-share
/// attribution, the creator header, the expandable caption, an optional
/// location chip, and the pulsing audio chip.
///
/// Composition-only — it reads everything from [post] (the wrapper, so
/// re-shares resolve correctly) and forwards creator taps to [onCreatorTap].
class CaptionLayer extends StatelessWidget {
  const CaptionLayer({
    super.key,
    required this.post,
    this.onCreatorTap,
    this.onOriginalPostTap,
    this.onFollow,
  });

  final FeedPost post;
  final VoidCallback? onCreatorTap;
  final VoidCallback? onOriginalPostTap;
  final VoidCallback? onFollow;

  @override
  Widget build(BuildContext context) {
    final original = post.displayedPost;
    final visibleAuthor = post.isQuoteRefeed ? post : original;
    final handle = visibleAuthor.meta.trim();
    final hasLocation = original.location?.trim().isNotEmpty ?? false;
    final visibleCaption = post.isQuoteRefeed ? post.body : original.body;
    final hasCaption = visibleCaption.trim().isNotEmpty;

    return Semantics(
      container: true,
      label: 'Post by ${visibleAuthor.authorName}',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (post.isRefeed && !post.isQuoteRefeed) ...[
            OverlayBadge(
              icon: Icons.repeat_rounded,
              label: '${post.authorName} re-shared',
            ),
            const SizedBox(height: 10),
          ],
          CreatorHeader(
            authorName: visibleAuthor.authorName,
            handle: handle,
            avatarUrl: visibleAuthor.avatarUrl,
            isVerified: visibleAuthor.isAuthorVerified,
            badgeTier: visibleAuthor.authorBadgeTier,
            metadata: '${_relativeTime(visibleAuthor.createdAtMillis)} · Public${hasLocation ? ' · ${original.location!.trim()}' : ''}',
            onProfileTap: onCreatorTap ?? () {},
            onFollow: onFollow,
          ),
          if (hasCaption) ...[
            const SizedBox(height: 9),
            ExpandableCaption(
              key: Key('post-caption-${post.id}'),
              text: visibleCaption,
              collapsedLines: 2,
              linkColor: FeedImmersiveTheme.brandPink,
            ),
          ],
          if (post.isQuoteRefeed) ...[
            const SizedBox(height: 10),
            _QuotedOriginal(post: original, onTap: onOriginalPostTap),
          ],
          if (hasLocation) ...[
            const SizedBox(height: 11),
            OverlayBadge(
              icon: Icons.place_rounded,
              label: original.location!.trim(),
            ),
          ],
          const SizedBox(height: 8),
          AudioChip(label: 'Original audio · ${original.authorName}'),
        ],
      ),
    );
  }
}

class _QuotedOriginal extends StatelessWidget {
  const _QuotedOriginal({required this.post, this.onTap});

  final FeedPost post;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final handle = (post.authorHandle ?? post.meta).trim();
    return Semantics(
      label: 'Quoted post by ${post.authorName}',
      child: InkWell(
        key: const Key('quote-refeed-original'),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.repeat_rounded,
                    size: 15,
                    color: FeedImmersiveTheme.inkMuted,
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      handle.isEmpty
                          ? post.authorName
                          : '${post.authorName} · $handle',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: FeedImmersiveTheme.ink,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
              if (post.body.trim().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  post.body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: FeedImmersiveTheme.inkMuted,
                    fontSize: 12,
                    height: 1.3,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String _relativeTime(int millis) {
  final age = DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(millis));
  if (age.inDays > 0) return '${age.inDays}d';
  if (age.inHours > 0) return '${age.inHours}h';
  if (age.inMinutes > 0) return '${age.inMinutes}m';
  return 'now';
}
