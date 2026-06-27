/// Profile posts grid — square media/text tiles.
///
/// Ports the web `PostsGrid.tsx` 3-column grid: square tiles inside a bordered,
/// faint-card container that scrolls within a fixed max height. Image tiles
/// render the media; video tiles render a poster + centered play overlay with a
/// darkening scrim; text-only tiles render the 3-stop purple->pink->orange
/// gradient with a centered caption. A view-count pill sits bottom-left, and a
/// stacked-layers indicator marks multi-media posts (native addition over the
/// web single-media tile).
///
/// Tapping a tile opens a small action menu (View Post, plus Delete on the
/// viewer's own profile) via [onAction]. Promote is intentionally excluded per
/// project rules. Shows a skeleton while loading and the web "No posts yet"
/// empty state otherwise.
///
/// Pure presentational: renders a [PostsGridView] and forwards taps; no repo or
/// Supabase access.
///
/// Web parity references:
///   - src/components/profile/PostsGrid.tsx (grid, tile media states, view
///     pill, skeleton, empty, View/Delete menu)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';

/// The whole posts grid. Stateless — state (loading/tiles) lives in the view.
class PostsGrid extends StatelessWidget {
  const PostsGrid({super.key, required this.view, required this.onAction});

  final PostsGridView view;

  /// Called when a tile-menu action is chosen.
  final void Function(PostTileView tile, PostTileAction action) onAction;

  @override
  Widget build(BuildContext context) {
    if (view.isLoading) return const _GridSkeleton();
    if (view.isEmpty) return const _PostsEmpty();

    return Container(
      constraints: const BoxConstraints(
        maxHeight: ProfileSpacing.postsGridMaxHeight,
      ),
      decoration: BoxDecoration(
        color: ProfileColors.cardFaint,
        borderRadius: ProfileRadii.tile,
        border: Border.all(color: ProfileColors.border),
      ),
      padding: const EdgeInsets.all(ProfileSpacing.sm),
      child: GridView.builder(
        padding: EdgeInsets.zero,
        shrinkWrap: true,
        itemCount: view.tiles.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 6, // web gap-1.5
          mainAxisSpacing: 6,
        ),
        itemBuilder: (context, index) => _PostTile(
          tile: view.tiles[index],
          isOwnProfile: view.isOwnProfile,
          onAction: onAction,
        ),
      ),
    );
  }
}

class _PostTile extends StatelessWidget {
  const _PostTile({
    required this.tile,
    required this.isOwnProfile,
    required this.onAction,
  });

  final PostTileView tile;
  final bool isOwnProfile;
  final void Function(PostTileView tile, PostTileAction action) onAction;

  Future<void> _openMenu(BuildContext context) async {
    final box = context.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context).context.findRenderObject() as RenderBox?;
    if (box == null || overlay == null) {
      onAction(tile, PostTileAction.view);
      return;
    }
    final topLeft = box.localToGlobal(Offset.zero, ancestor: overlay);
    final position = RelativeRect.fromLTRB(
      topLeft.dx,
      topLeft.dy + box.size.height / 2,
      overlay.size.width - topLeft.dx - box.size.width,
      0,
    );
    final selected = await showMenu<PostTileAction>(
      context: context,
      position: position,
      color: ProfileColors.background,
      items: [
        const PopupMenuItem(
          value: PostTileAction.view,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.open_in_new,
                size: 16,
                color: ProfileColors.foreground,
              ),
              SizedBox(width: ProfileSpacing.sm),
              Text('View Post', style: ProfileTextStyles.rowName),
            ],
          ),
        ),
        if (isOwnProfile)
          const PopupMenuItem(
            value: PostTileAction.delete,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.delete_outline,
                  size: 16,
                  color: ProfileColors.destructive,
                ),
                SizedBox(width: ProfileSpacing.sm),
                Text(
                  'Delete Post',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: ProfileColors.destructive,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
    if (selected != null) onAction(tile, selected);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: ProfileColors.muted,
      borderRadius: ProfileRadii.tile,
      child: InkWell(
        onTap: () => _openMenu(context),
        borderRadius: ProfileRadii.tile,
        child: ClipRRect(
          borderRadius: ProfileRadii.tile,
          child: AspectRatio(
            aspectRatio: 1,
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
        decoration: const BoxDecoration(
          gradient: ProfileGradients.textPostTile,
        ),
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

/// Bottom-left black/70 view-count pill (web `bg-black/70`).
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

class _PostsEmpty extends StatelessWidget {
  const _PostsEmpty();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: Text('No posts yet', style: ProfileTextStyles.emptyTitle),
      ),
    );
  }
}

class _GridSkeleton extends StatelessWidget {
  const _GridSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: EdgeInsets.zero,
      shrinkWrap: true,
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
