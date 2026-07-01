import 'package:flutter/material.dart';

import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import 'group_avatar.dart';

/// One row in the groups list. Mirrors the web `TikTokConversationItem`
/// card-row treatment: a rounded `bg-muted/20` card with a hairline border, a
/// group avatar, the group name + last-message/member preview, a relative
/// timestamp and an unread badge.
class GroupListTile extends StatelessWidget {
  const GroupListTile({super.key, required this.group, required this.onTap});

  final GroupListItemView group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: GroupSpacing.md,
        vertical: 3,
      ),
      child: Material(
        color: GroupColors.rowCard,
        borderRadius: GroupRadii.card,
        child: InkWell(
          onTap: onTap,
          borderRadius: GroupRadii.card,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: GroupSpacing.md,
              vertical: GroupSpacing.sm,
            ),
            constraints: const BoxConstraints(
              minHeight: GroupSpacing.listItemMinHeight,
            ),
            decoration: BoxDecoration(
              borderRadius: GroupRadii.card,
              border: Border.all(color: GroupColors.rowCardBorder),
            ),
            child: Row(
              children: [
                GroupAvatar(
                  initial: group.avatarInitial,
                  size: GroupSpacing.avatarMd,
                ),
                const SizedBox(width: GroupSpacing.md),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              group.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GroupTextStyles.groupName,
                            ),
                          ),
                          const SizedBox(width: GroupSpacing.xs),
                          Text(
                            groupRelativeTime(group.updatedAtMillis),
                            style: GroupTextStyles.timestamp,
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              group.previewLine,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: group.hasUnread
                                  ? GroupTextStyles.previewUnread
                                  : GroupTextStyles.previewMuted,
                            ),
                          ),
                          if (group.hasUnread) ...[
                            const SizedBox(width: GroupSpacing.sm),
                            _UnreadBadge(count: group.unreadCount),
                          ],
                        ],
                      ),
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

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+' : '$count';
    return Container(
      constraints: const BoxConstraints(minWidth: 20),
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: GroupGradients.sendAction,
        borderRadius: GroupRadii.chip,
        boxShadow: GroupShadows.pink,
      ),
      child: Text(label, style: GroupTextStyles.badge),
    );
  }
}
