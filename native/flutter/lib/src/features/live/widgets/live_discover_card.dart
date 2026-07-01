import 'package:flutter/material.dart';

import '../data/live_models.dart';
import '../live_theme.dart';
import 'live_common.dart';

/// A portrait discovery card for one live room (video stream or audio space),
/// mirroring the web `LiveDiscoverCard`: full-bleed thumbnail / gradient
/// fallback, a top LIVE + viewer-count row, and a bottom host + title row.
class LiveDiscoverCard extends StatelessWidget {
  const LiveDiscoverCard({
    super.key,
    required this.kind,
    required this.title,
    required this.host,
    required this.viewerCount,
    required this.onTap,
    this.thumbnailUrl,
    this.category,
  });

  /// Adapter for a video stream summary.
  factory LiveDiscoverCard.stream(
    LiveStreamSummary stream, {
    required VoidCallback onTap,
  }) {
    return LiveDiscoverCard(
      kind: LiveRoomKind.stream,
      title: stream.title,
      host: stream.host,
      viewerCount: stream.viewerCount,
      thumbnailUrl: stream.thumbnailUrl,
      onTap: onTap,
    );
  }

  /// Adapter for an audio space summary.
  factory LiveDiscoverCard.space(
    LiveSpaceSummary space, {
    required VoidCallback onTap,
  }) {
    return LiveDiscoverCard(
      kind: LiveRoomKind.space,
      title: space.title,
      host: space.host,
      viewerCount: space.viewerCount,
      category: space.topicCategory,
      onTap: onTap,
    );
  }

  final LiveRoomKind kind;
  final String title;
  final LiveProfile? host;
  final int viewerCount;
  final VoidCallback onTap;
  final String? thumbnailUrl;
  final String? category;

  bool get _isSpace => kind == LiveRoomKind.space;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: ClipRRect(
          borderRadius: LiveTheme.cardRadius,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _background(),
              const DecoratedBox(
                decoration: BoxDecoration(gradient: LiveTheme.bottomScrim),
              ),
              Positioned(
                top: 8,
                left: 8,
                right: 8,
                child: Row(
                  children: [
                    LivePill(
                      color: _isSpace
                          ? LiveTheme.spacePurple
                          : LiveTheme.liveRed,
                    ),
                    const Spacer(),
                    ViewerCountChip(
                      count: viewerCount,
                      icon: _isSpace
                          ? Icons.headphones_rounded
                          : Icons.remove_red_eye_outlined,
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 10,
                right: 10,
                bottom: 10,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    LiveAvatar(profile: host, size: 28),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            host?.label ?? 'feedIn user',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: LiveTheme.cardTitle,
                          ),
                          const SizedBox(height: 1),
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: LiveTheme.cardHost,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (_isSpace)
                const Positioned(
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Icon(
                      Icons.graphic_eq_rounded,
                      color: Color(0x33FFFFFF),
                      size: 56,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _background() {
    final url = thumbnailUrl;
    if (url != null && url.isNotEmpty) {
      return Image.network(
        url,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _gradientFallback(),
      );
    }
    return _gradientFallback();
  }

  Widget _gradientFallback() {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: _isSpace
            ? LiveTheme.spaceFallback
            : LiveTheme.streamFallback,
      ),
    );
  }
}
