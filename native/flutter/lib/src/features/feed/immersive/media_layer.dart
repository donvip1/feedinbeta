import 'package:flutter/material.dart';

import '../../create/camera_studio/studio_filters.dart';
import '../feed_post.dart';
import '../state/feed_chrome_state_machine.dart';
import 'feed_immersive_theme.dart';
import 'immersive_video_player.dart';
import 'photo_carousel.dart';
import 'post_photo_viewer.dart';

/// Resolves and renders a post's background media: the immersive video
/// player, a photo carousel, or a branded gradient text card when there
/// is no media.
///
/// Presentation-only. [post] is the already-resolved content post
/// (i.e. the re-shared original when applicable); [onDoubleTapLike] is
/// forwarded to the underlying media so a double-tap anywhere on the
/// media triggers the like burst, exactly as before.
///
/// Surface taps on video posts are forwarded via [onSurfaceTap] so the
/// host pager can drive the chrome reveal state machine. Non-video
/// posts ignore [onSurfaceTap] because they don't participate in the
/// immersive timer.
class MediaLayer extends StatelessWidget {
  const MediaLayer({
    super.key,
    required this.post,
    required this.isActive,
    required this.onDoubleTapLike,
    this.onSurfaceTap,
    this.onPlaybackChange,
    this.chromeState = FeedChromeVisibility.full,
  });

  final FeedPost post;
  final bool isActive;
  final VoidCallback onDoubleTapLike;

  /// Forwarded to [ImmersiveVideoPlayer] so the host pager can decide
  /// whether a tap reveals chrome or toggles playback.
  final void Function(FeedSurfaceTapIntent intent)? onSurfaceTap;

  /// Forwarded to [ImmersiveVideoPlayer] so the host knows when the
  /// video actually starts/stops playing.
  final void Function(bool isPlaying)? onPlaybackChange;

  /// Current chrome visibility — passed through to the video player
  /// so its gesture behavior matches the host's reveal state.
  final FeedChromeVisibility chromeState;

  StudioFilter? _mediaFilter(String id) {
    if (id.isEmpty || id == 'original') return null;
    for (final filter in kStudioFilters) {
      if (filter.id == id) return filter;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    Widget media;
    final normalized = post.normalizedMedia;
    final video = normalized.where((item) => item.isVideo).firstOrNull;
    if (video != null) {
      media = ImmersiveVideoPlayer(
        url: video.url,
        localPath: video.localPath,
        isActive: isActive,
        onDoubleTapLike: onDoubleTapLike,
        onSurfaceTap: onSurfaceTap,
        onPlaybackChange: onPlaybackChange,
        chromeState: chromeState,
      );
    } else {
      final images = normalized.where((item) => item.isImage).toList();
      if (images.isNotEmpty) {
        media = PhotoCarousel(
          urls: images.map((item) => item.url).toList(growable: false),
          localPaths: images
              .map((item) => item.localPath)
              .toList(growable: false),
          colorFilters: images
              .map((item) => _mediaFilter(item.filterId)?.filter)
              .toList(growable: false),
          onDoubleTapLike: onDoubleTapLike,
          onPhotoTap: (index) => Navigator.of(context).push<void>(
            PostPhotoViewer.route(
              urls: images.map((item) => item.url).toList(growable: false),
              localPaths: images
                  .map((item) => item.localPath)
                  .toList(growable: false),
              initialIndex: index,
            ),
          ),
        );
      } else {
        return _TextCardBackground(
          post: post,
          onDoubleTapLike: onDoubleTapLike,
        );
      }
    }

    return media;
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
