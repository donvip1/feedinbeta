import 'package:flutter/material.dart';

import '../groups_theme.dart';
import 'group_avatar.dart';

/// Header for an open group room. Mirrors the web `GroupChatHeader`: back
/// button, tappable group identity (avatar + name + "{n} members, {m} online"),
/// and an overflow menu exposing members / leave. Purely presentational.
class GroupChatHeader extends StatelessWidget {
  const GroupChatHeader({
    super.key,
    required this.title,
    required this.memberCount,
    required this.onBack,
    required this.onShowMembers,
    required this.onLeaveGroup,
    this.onlineCount = 0,
    this.onAddMembers,
  });

  final String title;
  final int memberCount;
  final int onlineCount;
  final VoidCallback onBack;
  final VoidCallback onShowMembers;
  final VoidCallback onLeaveGroup;
  final VoidCallback? onAddMembers;

  String get _statusText {
    final base = '$memberCount member${memberCount == 1 ? '' : 's'}';
    if (onlineCount > 0) return '$base, $onlineCount online';
    return base;
  }

  String get _initial {
    final trimmed = title.trim();
    return trimmed.isEmpty ? 'G' : trimmed.substring(0, 1).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: GroupSpacing.headerHeight,
      padding: const EdgeInsets.symmetric(horizontal: GroupSpacing.xs),
      decoration: const BoxDecoration(
        color: GroupColors.card,
        border: Border(bottom: BorderSide(color: GroupColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: GroupColors.foreground),
            onPressed: onBack,
            tooltip: 'Back',
          ),
          Expanded(
            child: InkWell(
              onTap: onShowMembers,
              borderRadius: BorderRadius.circular(GroupRadii.sm),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: GroupSpacing.xs,
                  vertical: 4,
                ),
                child: Row(
                  children: [
                    GroupAvatar(
                      initial: _initial,
                      size: GroupSpacing.avatarSm + 4,
                    ),
                    const SizedBox(width: GroupSpacing.sm),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GroupTextStyles.headerName,
                          ),
                          Text(
                            _statusText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GroupTextStyles.subtitle,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          PopupMenuButton<_GroupHeaderAction>(
            icon: const Icon(
              Icons.more_vert,
              color: GroupColors.foreground,
            ),
            color: GroupColors.popover,
            tooltip: 'Group options',
            onSelected: (action) {
              switch (action) {
                case _GroupHeaderAction.members:
                  onShowMembers();
                case _GroupHeaderAction.addMembers:
                  onAddMembers?.call();
                case _GroupHeaderAction.leave:
                  onLeaveGroup();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: _GroupHeaderAction.members,
                child: _MenuRow(icon: Icons.group_outlined, label: 'View members'),
              ),
              if (onAddMembers != null)
                const PopupMenuItem(
                  value: _GroupHeaderAction.addMembers,
                  child: _MenuRow(
                    icon: Icons.person_add_alt_1_outlined,
                    label: 'Add members',
                  ),
                ),
              const PopupMenuItem(
                value: _GroupHeaderAction.leave,
                child: _MenuRow(
                  icon: Icons.logout,
                  label: 'Leave group',
                  destructive: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum _GroupHeaderAction { members, addMembers, leave }

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive
        ? GroupColors.destructive
        : GroupColors.foreground;
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: GroupSpacing.md),
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: color,
          ),
        ),
      ],
    );
  }
}
