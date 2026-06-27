/// Followers / Following modal ("Connections").
///
/// Ports the web `FollowersModal.tsx` dialog into a native bottom-sheet body.
/// A two-tab control (Followers / Following, each with its count) switches
/// between two scrollable lists of user rows. Each row shows the avatar, name,
/// @username and optional bio, plus a Follow / Following toggle button (hidden
/// on the viewer's own row).
///
/// Pure presentational: it renders a [ConnectionsModalView] and forwards taps
/// via callbacks ([onOpenUser], [onToggleFollow]). All data loading and follow
/// mutations are the host's job — no Supabase / repo access here. When a list
/// is empty it shows the web empty copy ("No followers yet" / "Not following
/// anyone yet").
///
/// Use [showConnectionsModal] to present it as a rounded modal bottom sheet
/// matching the app's other sheets.
///
/// Web parity references:
///   - src/components/profile/FollowersModal.tsx (tabs, counts, rows, empties)
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';
import '../profile_view_models.dart';
import 'profile_avatar.dart';

/// Presents [ConnectionsModalBody] as a rounded modal bottom sheet.
Future<void> showConnectionsModal(
  BuildContext context, {
  required ConnectionsModalView view,
  required ValueChanged<ProfileUserRef> onOpenUser,
  required ValueChanged<ProfileUserRef> onToggleFollow,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: ProfileColors.card,
    barrierColor: ProfileColors.barrier,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(borderRadius: ProfileRadii.sheetTop),
    builder: (_) => ConnectionsModalBody(
      view: view,
      onOpenUser: onOpenUser,
      onToggleFollow: onToggleFollow,
    ),
  );
}

/// The tabbed body of the Connections modal. Stateful only for the active tab.
class ConnectionsModalBody extends StatefulWidget {
  const ConnectionsModalBody({
    super.key,
    required this.view,
    required this.onOpenUser,
    required this.onToggleFollow,
  });

  final ConnectionsModalView view;
  final ValueChanged<ProfileUserRef> onOpenUser;
  final ValueChanged<ProfileUserRef> onToggleFollow;

  @override
  State<ConnectionsModalBody> createState() => _ConnectionsModalBodyState();
}

class _ConnectionsModalBodyState extends State<ConnectionsModalBody> {
  late ConnectionsTab _tab = widget.view.defaultTab;

  @override
  Widget build(BuildContext context) {
    final view = widget.view;
    final isFollowers = _tab == ConnectionsTab.followers;
    final rows = isFollowers ? view.followers : view.following;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ProfileSpacing.lg,
          ProfileSpacing.md,
          ProfileSpacing.lg,
          ProfileSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _SheetGrabber(),
            const SizedBox(height: ProfileSpacing.md),
            const Text('Connections', style: ProfileTextStyles.sectionTitle),
            const SizedBox(height: ProfileSpacing.md),
            _TabBar(
              tab: _tab,
              followersCount: view.followersCount,
              followingCount: view.followingCount,
              onChanged: (t) => setState(() => _tab = t),
            ),
            const SizedBox(height: ProfileSpacing.md),
            SizedBox(
              height: ProfileSpacing.modalListHeight,
              child: _ConnectionsList(
                rows: rows,
                isLoading: view.isLoading,
                isFollowersTab: isFollowers,
                onOpenUser: widget.onOpenUser,
                onToggleFollow: widget.onToggleFollow,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tab,
    required this.followersCount,
    required this.followingCount,
    required this.onChanged,
  });

  final ConnectionsTab tab;
  final int followersCount;
  final int followingCount;
  final ValueChanged<ConnectionsTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(ProfileSpacing.xs),
      decoration: BoxDecoration(
        color: ProfileColors.muted,
        borderRadius: ProfileRadii.tile,
      ),
      child: Row(
        children: [
          Expanded(
            child: _TabButton(
              label: 'Followers ($followersCount)',
              isActive: tab == ConnectionsTab.followers,
              onTap: () => onChanged(ConnectionsTab.followers),
            ),
          ),
          const SizedBox(width: ProfileSpacing.xs),
          Expanded(
            child: _TabButton(
              label: 'Following ($followingCount)',
              isActive: tab == ConnectionsTab.following,
              onTap: () => onChanged(ConnectionsTab.following),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? ProfileColors.card : Colors.transparent,
      borderRadius: ProfileRadii.chip,
      child: InkWell(
        onTap: onTap,
        borderRadius: ProfileRadii.chip,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: ProfileSpacing.sm),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isActive
                  ? ProfileColors.foreground
                  : ProfileColors.mutedForeground,
            ),
          ),
        ),
      ),
    );
  }
}

class _ConnectionsList extends StatelessWidget {
  const _ConnectionsList({
    required this.rows,
    required this.isLoading,
    required this.isFollowersTab,
    required this.onOpenUser,
    required this.onToggleFollow,
  });

  final List<FollowRowView> rows;
  final bool isLoading;
  final bool isFollowersTab;
  final ValueChanged<ProfileUserRef> onOpenUser;
  final ValueChanged<ProfileUserRef> onToggleFollow;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: ProfileColors.primary,
          ),
        ),
      );
    }
    if (rows.isEmpty) {
      return Center(
        child: Text(
          isFollowersTab ? 'No followers yet' : 'Not following anyone yet',
          style: ProfileTextStyles.emptyTitle,
        ),
      );
    }
    return ListView.separated(
      padding: EdgeInsets.zero,
      itemCount: rows.length,
      separatorBuilder: (_, _) => const SizedBox(height: ProfileSpacing.sm),
      itemBuilder: (context, index) => _FollowRow(
        row: rows[index],
        onOpenUser: onOpenUser,
        onToggleFollow: onToggleFollow,
      ),
    );
  }
}

class _FollowRow extends StatelessWidget {
  const _FollowRow({
    required this.row,
    required this.onOpenUser,
    required this.onToggleFollow,
  });

  final FollowRowView row;
  final ValueChanged<ProfileUserRef> onOpenUser;
  final ValueChanged<ProfileUserRef> onToggleFollow;

  @override
  Widget build(BuildContext context) {
    final user = row.user;
    return Material(
      color: Colors.transparent,
      borderRadius: ProfileRadii.tile,
      child: InkWell(
        onTap: () => onOpenUser(user),
        borderRadius: ProfileRadii.tile,
        child: Padding(
          padding: const EdgeInsets.all(ProfileSpacing.md),
          child: Row(
            children: [
              ProfileAvatar(
                diameter: ProfileSpacing.avatarRow,
                initial: user.initial,
                imageUrl: user.avatarUrl,
              ),
              const SizedBox(width: ProfileSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.nameOrFallback,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ProfileTextStyles.rowName,
                    ),
                    Text(
                      '@${user.usernameOrFallback}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ProfileTextStyles.rowMuted,
                    ),
                    if (user.bio != null && user.bio!.trim().isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        user.bio!.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: ProfileTextStyles.emptySubtitle,
                      ),
                    ],
                  ],
                ),
              ),
              if (!row.isOwnRow) ...[
                const SizedBox(width: ProfileSpacing.sm),
                _FollowButton(
                  isFollowing: row.isFollowedByMe,
                  isProcessing: row.isProcessing,
                  onTap: () => onToggleFollow(user),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Follow / Following toggle. "Follow" uses the brand action gradient;
/// "Following" uses an outlined neutral style (web variant default/outline).
class _FollowButton extends StatelessWidget {
  const _FollowButton({
    required this.isFollowing,
    required this.isProcessing,
    required this.onTap,
  });

  final bool isFollowing;
  final bool isProcessing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final child = Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ProfileSpacing.md,
        vertical: ProfileSpacing.sm,
      ),
      child: isProcessing
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: ProfileColors.foreground,
              ),
            )
          : Text(
              isFollowing ? 'Following' : 'Follow',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isFollowing
                    ? ProfileColors.foreground
                    : ProfileColors.primaryForeground,
              ),
            ),
    );

    if (isFollowing) {
      return Material(
        color: Colors.transparent,
        borderRadius: ProfileRadii.tile,
        child: InkWell(
          onTap: isProcessing ? null : onTap,
          borderRadius: ProfileRadii.tile,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: ProfileRadii.tile,
              border: Border.all(color: ProfileColors.border),
            ),
            child: child,
          ),
        ),
      );
    }

    return Material(
      color: Colors.transparent,
      borderRadius: ProfileRadii.tile,
      child: InkWell(
        onTap: isProcessing ? null : onTap,
        borderRadius: ProfileRadii.tile,
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: ProfileGradients.action,
            borderRadius: ProfileRadii.tile,
          ),
          child: child,
        ),
      ),
    );
  }
}

/// 36x4 muted grabber handle at the top of the sheet.
class _SheetGrabber extends StatelessWidget {
  const _SheetGrabber();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 36,
        height: 4,
        decoration: BoxDecoration(
          color: ProfileColors.border,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
