import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import 'audio_chip.dart';
import 'bottom_metadata.dart';
import 'caption_text.dart';
import 'feed_immersive_theme.dart';

/// The bottom-left text overlay of an immersive post: an optional re-share
/// attribution, the expandable caption, an optional
/// location chip, and the pulsing audio chip.
///
/// Composition-only — it reads everything from [post] (the wrapper, so
/// re-shares resolve correctly). For a quote-refeed the embedded original is
/// shown as an X-style quote card whose whole surface opens the ORIGINAL POST
/// via [onOpenOriginalPost] (never a profile).
class CaptionLayer extends StatelessWidget {
  const CaptionLayer({super.key, required this.post, this.onOpenOriginalPost});

  final FeedPost post;

  /// Opens the embedded quoted post's detail (the immersive post viewer).
  /// Null makes the quote card non-interactive.
  final VoidCallback? onOpenOriginalPost;

  @override
  Widget build(BuildContext context) {
    final original = post.displayedPost;
    final visibleAuthor = post.isQuoteRefeed ? post : original;
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
          if (hasCaption) ...[
            ExpandableCaption(
              key: Key('post-caption-${post.id}'),
              text: visibleCaption,
              collapsedLines: 2,
              linkColor: FeedImmersiveTheme.brandPink,
            ),
          ],
          if (post.isQuoteRefeed) ...[
            const SizedBox(height: 10),
            _QuotedOriginal(post: original, onOpenPost: onOpenOriginalPost),
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

/// Flat, X/Instagram-style quoted-post attribution — NOT a bordered card and
/// with NO media. Shows a refeed indicator, the original author's identity
/// (name · @handle · time) on one line, then the original caption. The whole
/// block is one tap target that opens the ORIGINAL POST (never a profile). A
/// quote-of-a-quote is flattened (only the innermost text is shown).
class _QuotedOriginal extends StatelessWidget {
  const _QuotedOriginal({required this.post, this.onOpenPost});

  final FeedPost post;
  final VoidCallback? onOpenPost;

  /// A deleted / unavailable original carries neither text nor media.
  bool get _isUnavailable =>
      post.body.trim().isEmpty && post.normalizedMedia.isEmpty;

  @override
  Widget build(BuildContext context) {
    if (_isUnavailable) {
      return _wrap(
        onTap: null,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(
              Icons.repeat_rounded,
              size: 14,
              color: FeedImmersiveTheme.inkSubtle,
            ),
            SizedBox(width: 6),
            Text(
              'This post is unavailable',
              style: TextStyle(
                color: FeedImmersiveTheme.inkSubtle,
                fontSize: 12,
                fontStyle: FontStyle.italic,
                shadows: FeedImmersiveTheme.textShadow,
              ),
            ),
          ],
        ),
      );
    }

    final displayName = post.authorName.trim();
    final handle = (post.authorHandle ?? post.meta).trim();
    final handleBare = handle.startsWith('@') ? handle.substring(1) : handle;
    // Avoid a "bob · @bob" duplication when there is no distinct display name.
    final showName =
        displayName.isNotEmpty &&
        displayName.toLowerCase() != handleBare.toLowerCase();
    final meta = handle.isEmpty
        ? _relativeAge(post.createdAtMillis)
        : '$handle · ${_relativeAge(post.createdAtMillis)}';

    return _wrap(
      onTap: onOpenPost,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ONE attribution line: refeed icon · name · @handle · time.
          Row(
            children: [
              const Icon(
                Icons.repeat_rounded,
                size: 14,
                color: FeedImmersiveTheme.inkMuted,
                shadows: FeedImmersiveTheme.textShadow,
              ),
              const SizedBox(width: 6),
              if (showName) ...[
                Flexible(
                  child: Text(
                    displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: FeedImmersiveTheme.ink,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      shadows: FeedImmersiveTheme.textShadow,
                    ),
                  ),
                ),
                const SizedBox(width: 4),
              ],
              Flexible(
                child: Text(
                  meta,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: FeedImmersiveTheme.inkMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    shadows: FeedImmersiveTheme.textShadow,
                  ),
                ),
              ),
            ],
          ),
          if (post.body.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              post.body,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: FeedImmersiveTheme.ink,
                fontSize: 13,
                height: 1.3,
                shadows: FeedImmersiveTheme.textShadow,
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// One flat tap target (no border/background). A null [onTap] is inert.
  Widget _wrap({required VoidCallback? onTap, required Widget child}) {
    return Semantics(
      button: onTap != null,
      label: 'Quoted post by ${post.authorName}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                onTap();
              },
        child: Container(
          key: const Key('quote-refeed-original'),
          width: double.infinity,
          color: Colors.transparent,
          child: child,
        ),
      ),
    );
  }
}

String _relativeAge(int millis) {
  final elapsed = DateTime.now().difference(
    DateTime.fromMillisecondsSinceEpoch(millis),
  );
  if (elapsed.inDays >= 7) return '${elapsed.inDays ~/ 7}w';
  if (elapsed.inDays >= 1) return '${elapsed.inDays}d';
  if (elapsed.inHours >= 1) return '${elapsed.inHours}h';
  if (elapsed.inMinutes >= 1) return '${elapsed.inMinutes}m';
  return 'now';
}
