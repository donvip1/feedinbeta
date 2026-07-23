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
  const CaptionLayer({super.key, required this.post, this.onCreatorTap});

  final FeedPost post;
  final VoidCallback? onCreatorTap;

  bool get _isVerified =>
      post.displayedPost.postType?.toLowerCase().contains('verified') ?? false;

  @override
  Widget build(BuildContext context) {
    final content = post.displayedPost;
    final handle = content.meta.trim();
    final hasLocation = content.location?.trim().isNotEmpty ?? false;
    final hasCaption = content.body.trim().isNotEmpty;

    return Semantics(
      container: true,
      label: 'Post by ${content.authorName}',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (post.originalPost != null) ...[
            OverlayBadge(
              icon: Icons.repeat_rounded,
              label: '${post.authorName} re-shared',
            ),
            const SizedBox(height: 10),
          ],
          CreatorHeader(
            authorName: content.authorName,
            handle: handle,
            isVerified: _isVerified,
            onTap: onCreatorTap,
          ),
          if (hasCaption) ...[
            const SizedBox(height: 9),
            ExpandableCaption(
              text: content.body,
              collapsedLines: 2,
              linkColor: FeedImmersiveTheme.brandPink,
            ),
          ],
          if (hasLocation) ...[
            const SizedBox(height: 11),
            OverlayBadge(
              icon: Icons.place_rounded,
              label: content.location!.trim(),
            ),
          ],
          const SizedBox(height: 8),
          AudioChip(label: 'Original audio · ${content.authorName}'),
        ],
      ),
    );
  }
}
