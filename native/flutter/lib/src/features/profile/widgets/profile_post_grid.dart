/// A scrollable 3-column media grid used as a profile content-tab body
/// (Posts / Reels / Saved).
///
/// Unlike the fixed-height parity `PostsGrid` card, this fills the tab viewport
/// so it plays nicely inside a `NestedScrollView` + `TabBarView`. It handles the
/// four tab states honestly:
///  * loading  -> shimmerless skeleton tiles,
///  * error    -> centered message with a Retry button,
///  * empty    -> per-tab icon + copy (no fabricated content),
///  * loaded   -> square image/video/text tiles with a view-count pill and a
///                video play glyph, forwarding taps via [onOpenTile].
///
/// Pure presentational: the host resolves the [PostsGridView] (via
/// [ProfilePresenter]) and owns loading/error flags. Tile visuals reuse the
/// shared profile tokens so this matches the parity grid.
library;

import 'package:flutter/material.dart';

import '../parity/profile_tokens.dart';
import '../parity/profile_view_models.dart';

class ProfilePostGrid extends StatelessWidget {
  const ProfilePostGrid({
    super.key,
    required this.view,
    required this.onOpenTile,
    this.hasError = false,
    this.onRetry,
    this.emptyIcon = Icons.grid_view_rounded,
    this.emptyTitle = 'No posts yet',
    this.emptySubtitle,
    this.padding = const EdgeInsets.all(ProfileSpacing.sm),
  });

  final PostsGridView view;

  /// Called when a loaded tile is tapped.
  final ValueChanged<PostTileView> onOpenTile;

  /// Renders the error state (with [onRetry]) over the empty/loaded states.
  final bool hasError;
  final VoidCallback? onRetry;

  final IconData emptyIcon;
  final String emptyTitle;
  final String? emptySubtitle;

  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    if (hasError) {
      return _ProfileGridError(onRetry: onRetry);
    }
    if (view.isLoading) {
      return _ProfileGridSkeleton(padding: padding);
    }
    if (view.tiles.isEmpty) {
      return _ProfileGridEmpty(
        icon: emptyIcon,
        title: emptyTitle,
        subtitle: emptySubtitle,
      );
    }

    return GridView.builder(
      padding: padding,
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: view.tiles.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
      ),
      itemBuilder: (context, index) => _GridTile(
        tile: view.tiles[index],
        onTap: () => onOpenTile(view.tiles[index]),
      ),
    );
  }
}

class _GridTile extends StatelessWidget {
  const _GridTile({required this.tile, required this.onTap});

  final PostTileView tile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: ProfileColors.muted,
      borderRadius: ProfileRadii.tile,
      child: InkWell(
        onTap: onTap,
        borderRadius: ProfileRadii.tile,
        child: ClipRRect(
          borderRadius: ProfileRadii.tile,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _TileMedia(tile: tile),
              if (tile.isMulti)
                const Positioned(
                  top: 4,
                  right: 4,
                  child: Icon(
                    Icons.collections,
                    size: 16,
                    color: ProfileColors.primaryForeground,
                    shadows: [Shadow(blurRadius: 6, color: Colors.black54)],
                  ),
                ),
              if (tile.showViewBadge)
                Positioned(
                  left: 6,
                  bottom: 6,
                  child: _ViewBadge(count: tile.viewsCount),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TileMedia extends StatelessWidget {
  const _TileMedia({required this.tile});

  final PostTileView tile;

  @override
  Widget build(BuildContext context) {
    if (tile.media == PostTileMedia.text) {
      return DecoratedBox(
        decoration: const BoxDecoration(gradient: ProfileGradients.textPostTile),
        child: Padding(
          padding: const EdgeInsets.all(ProfileSpacing.md),
          child: Center(
            child: Text(
              tile.content?.trim().isNotEmpty == true
                  ? tile.content!.trim()
                  : '',
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: ProfileTextStyles.textTileCaption,
            ),
          ),
        ),
      );
    }

    final imageUrl = tile.displayImageUrl;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (imageUrl != null)
          Image.network(
            imageUrl,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => const ColoredBox(
              color: ProfileColors.muted,
              child: Icon(
                Icons.broken_image_outlined,
                color: ProfileColors.mutedForeground,
              ),
            ),
          )
        else
          const ColoredBox(color: ProfileColors.muted),
        if (tile.media == PostTileMedia.video) ...[
          const ColoredBox(color: ProfileColors.videoScrim),
          const Center(
            child: Icon(
              Icons.play_arrow,
              size: 32,
              color: ProfileColors.primaryForeground,
            ),
          ),
        ],
      ],
    );
  }
}

class _ViewBadge extends StatelessWidget {
  const _ViewBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: ProfileColors.tileBadgeScrim,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.visibility,
            size: 12,
            color: ProfileColors.primaryForeground,
          ),
          const SizedBox(width: 4),
          Text(
            compactCount(count),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: ProfileColors.primaryForeground,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileGridSkeleton extends StatelessWidget {
  const _ProfileGridSkeleton({required this.padding});

  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: padding,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 12,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
      ),
      itemBuilder: (_, _) => DecoratedBox(
        decoration: BoxDecoration(
          color: ProfileColors.muted,
          borderRadius: ProfileRadii.tile,
        ),
      ),
    );
  }
}

class _ProfileGridEmpty extends StatelessWidget {
  const _ProfileGridEmpty({
    required this.icon,
    required this.title,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    // Scrollable so the tab still supports pull-to-refresh gestures.
    return ListView(
      padding: const EdgeInsets.symmetric(
        horizontal: ProfileSpacing.xl,
        vertical: 64,
      ),
      children: [
        Icon(icon, size: 48, color: ProfileColors.mutedForeground),
        const SizedBox(height: ProfileSpacing.md),
        Text(title, textAlign: TextAlign.center, style: ProfileTextStyles.emptyTitle),
        if (subtitle != null) ...[
          const SizedBox(height: ProfileSpacing.xs),
          Text(
            subtitle!,
            textAlign: TextAlign.center,
            style: ProfileTextStyles.emptySubtitle,
          ),
        ],
      ],
    );
  }
}

class _ProfileGridError extends StatelessWidget {
  const _ProfileGridError({required this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(
        horizontal: ProfileSpacing.xl,
        vertical: 64,
      ),
      children: [
        const Icon(
          Icons.cloud_off_outlined,
          size: 48,
          color: ProfileColors.mutedForeground,
        ),
        const SizedBox(height: ProfileSpacing.md),
        const Text(
          "Couldn't load content",
          textAlign: TextAlign.center,
          style: ProfileTextStyles.emptyTitle,
        ),
        const SizedBox(height: ProfileSpacing.xs),
        const Text(
          'Check your connection and try again.',
          textAlign: TextAlign.center,
          style: ProfileTextStyles.emptySubtitle,
        ),
        if (onRetry != null) ...[
          const SizedBox(height: ProfileSpacing.lg),
          Center(
            child: Material(
              color: Colors.transparent,
              borderRadius: ProfileRadii.tile,
              child: InkWell(
                onTap: onRetry,
                borderRadius: ProfileRadii.tile,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: ProfileGradients.action,
                    borderRadius: ProfileRadii.tile,
                  ),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: ProfileSpacing.xl,
                      vertical: ProfileSpacing.md,
                    ),
                    child: Text(
                      'Retry',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: ProfileColors.primaryForeground,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
