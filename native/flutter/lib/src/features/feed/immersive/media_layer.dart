import 'package:flutter/material.dart';

import '../../create/camera_studio/studio_filters.dart';
import '../feed_post.dart';
import 'feed_immersive_theme.dart';
import 'immersive_video_player.dart';
import 'photo_carousel.dart';

/// Resolves and renders a post's background media: the immersive video player,
/// a photo carousel, or a branded gradient text card when there is no media.
///
/// Presentation-only. [post] is the already-resolved content post (i.e. the
/// re-shared original when applicable); [onDoubleTapLike] is forwarded to the
/// underlying media so a double-tap anywhere on the media triggers the like
/// burst, exactly as before.
class MediaLayer extends StatelessWidget {
  const MediaLayer({
    super.key,
    required this.post,
    required this.isActive,
    required this.onDoubleTapLike,
  });

  final FeedPost post;
  final bool isActive;
  final VoidCallback onDoubleTapLike;

  String? get _primaryMediaType {
    final type = post.mediaType;
    if (type != null && type.isNotEmpty) return type;
    final types = post.mediaTypes;
    return types.isNotEmpty ? types.first : null;
  }

  bool get _isVideo => _primaryMediaType == 'video';

  StudioFilter? get _mediaFilter {
    final id = post.mediaFilterId?.trim();
    if (id == null || id.isEmpty || id == 'original') return null;
    for (final filter in kStudioFilters) {
      if (filter.id == id) return filter;
    }
    return null;
  }

  /// Non-empty image urls from [FeedPost.mediaUrl] + [FeedPost.mediaUrls],
  /// de-duplicated while preserving order.
  List<String> get _imageUrls {
    final seen = <String>{};
    final urls = <String>[];
    void add(String? value) {
      if (value == null) return;
      final trimmed = value.trim();
      if (trimmed.isEmpty) return;
      if (seen.add(trimmed)) urls.add(trimmed);
    }

    add(post.mediaUrl);
    for (final url in post.mediaUrls) {
      add(url);
    }
    return urls;
  }

  @override
  Widget build(BuildContext context) {
    Widget media;
    if (_isVideo) {
      final url =
          post.mediaUrl ??
          (post.mediaUrls.isNotEmpty ? post.mediaUrls.first : null);
      media = ImmersiveVideoPlayer(
        url: url,
        localPath: post.localMediaPath,
        isActive: isActive,
        onDoubleTapLike: onDoubleTapLike,
      );
    } else {
      final imageUrls = _imageUrls;
      if (imageUrls.isNotEmpty) {
        // The post carries a single local media path, so attach it to the first
        // image and pad the rest with nulls.
        final localPaths = <String?>[
          for (var i = 0; i < imageUrls.length; i++)
            i == 0 ? post.localMediaPath : null,
        ];
        media = PhotoCarousel(
          urls: imageUrls,
          localPaths: localPaths,
          onDoubleTapLike: onDoubleTapLike,
        );
      } else {
        return _TextCardBackground(
          post: post,
          onDoubleTapLike: onDoubleTapLike,
        );
      }
    }

    final colorFilter = _mediaFilter?.filter;
    return colorFilter == null
        ? media
        : ColorFiltered(colorFilter: colorFilter, child: media);
  }
}

/// Full-bleed branded gradient card used when a post has no media, showing the
/// post body centered over the brand gradient.
class _TextCardBackground extends StatelessWidget {
  const _TextCardBackground({
    required this.post,
    required this.onDoubleTapLike,
  });

  final FeedPost post;
  final VoidCallback onDoubleTapLike;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onDoubleTap: onDoubleTapLike,
      child: Semantics(
        label: 'Text post by ${post.authorName}',
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [
                FeedImmersiveTheme.brandDeepPurple,
                FeedImmersiveTheme.brandPink,
                FeedImmersiveTheme.brandOrange,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(30, 0, 96, 0),
            child: Center(
              child: Text(
                post.body,
                textAlign: TextAlign.center,
                maxLines: 8,
                overflow: TextOverflow.ellipsis,
                style: FeedImmersiveTheme.textPost,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
