import 'package:flutter/material.dart';

import '../channels_theme.dart';
import '../view_models/channel_view_models.dart';

/// One broadcast post in the channel feed, Telegram-style: a wide card aligned
/// to the start, with the post body, an optional media preview, and a footer
/// row carrying the view count and a relative timestamp.
class ChannelPostCard extends StatelessWidget {
  const ChannelPostCard({super.key, required this.post});

  final ChannelPostView post;

  @override
  Widget build(BuildContext context) {
    final maxWidth =
        MediaQuery.sizeOf(context).width * ChannelSpacing.postMaxWidthFraction;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ChannelSpacing.md,
        vertical: ChannelSpacing.xs,
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: Container(
            decoration: BoxDecoration(
              color: ChannelColors.postBubble,
              borderRadius: ChannelRadii.bubble,
              border: Border.all(color: ChannelColors.postBubbleBorder),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (post.hasMedia) _Media(post: post),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ChannelSpacing.md,
                    ChannelSpacing.md,
                    ChannelSpacing.md,
                    ChannelSpacing.sm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (post.body.trim().isNotEmpty)
                        Text(post.body, style: ChannelTextStyles.postBody),
                      if (post.body.trim().isNotEmpty)
                        const SizedBox(height: 6),
                      _Footer(post: post),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Media extends StatelessWidget {
  const _Media({required this.post});

  final ChannelPostView post;

  @override
  Widget build(BuildContext context) {
    final url = post.mediaUrl!;
    final isVideo = (post.mediaType ?? '').startsWith('video');

    return AspectRatio(
      aspectRatio: 16 / 10,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.network(
            url,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const ColoredBox(
              color: ChannelColors.muted,
              child: Center(
                child: Icon(
                  Icons.broken_image_outlined,
                  color: ChannelColors.mutedForeground,
                ),
              ),
            ),
          ),
          if (isVideo)
            const Center(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: ChannelColors.barrier,
                  shape: BoxShape.circle,
                ),
                child: Padding(
                  padding: EdgeInsets.all(10),
                  child: Icon(
                    Icons.play_arrow_rounded,
                    color: ChannelColors.foreground,
                    size: 28,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.post});

  final ChannelPostView post;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(
          Icons.remove_red_eye_outlined,
          size: 13,
          color: ChannelColors.mutedForeground,
        ),
        const SizedBox(width: 4),
        Text(
          channelCompactCount(post.viewCount),
          style: ChannelTextStyles.timestamp,
        ),
        const Spacer(),
        Text(
          channelRelativeTime(post.createdAtMillis),
          style: ChannelTextStyles.timestamp,
        ),
      ],
    );
  }
}
