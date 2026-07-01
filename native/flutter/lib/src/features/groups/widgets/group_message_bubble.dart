import 'package:flutter/material.dart';

import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import 'group_avatar.dart';

/// A single message bubble in the group room. Mirrors the web
/// `GroupMessageBubble`: incoming bubbles show a small sender avatar (only on
/// the last bubble of a sender run) and a colored sender name (only on the
/// first bubble of a run); own bubbles use the pink gradient and align right.
class GroupMessageBubble extends StatelessWidget {
  const GroupMessageBubble({super.key, required this.message});

  final GroupMessageView message;

  @override
  Widget build(BuildContext context) {
    final isMine = message.isMine;
    final maxWidth =
        MediaQuery.of(context).size.width *
        GroupSpacing.bubbleMaxWidthFraction;

    final bubble = Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.symmetric(
        horizontal: GroupSpacing.md,
        vertical: GroupSpacing.sm,
      ),
      decoration: BoxDecoration(
        gradient: isMine ? GroupGradients.outgoingBubble : null,
        color: isMine ? null : GroupColors.incomingBubble,
        borderRadius: _bubbleRadius(isMine),
        border: isMine
            ? null
            : Border.all(color: GroupColors.incomingBubbleBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!isMine && message.isFirstInGroup)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                message.senderName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GroupTextStyles.senderLabel,
              ),
            ),
          Text(
            message.body,
            style: GroupTextStyles.messageBody.copyWith(
              color: isMine
                  ? GroupColors.primaryForeground
                  : GroupColors.foreground,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            groupClockTime(message.createdAtMillis),
            style: GroupTextStyles.timestamp.copyWith(
              color: isMine
                  ? GroupColors.primaryForeground.withValues(alpha: 0.8)
                  : GroupColors.mutedForeground,
            ),
          ),
        ],
      ),
    );

    // Incoming rows reserve a gutter for the sender avatar, shown only on the
    // last bubble of a run so a vertical run reads as one column.
    if (isMine) {
      return Align(
        alignment: Alignment.centerRight,
        child: Padding(
          padding: const EdgeInsets.only(left: 40),
          child: bubble,
        ),
      );
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(right: 40),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: GroupSpacing.avatarSm,
              child: message.isLastInGroup
                  ? GroupAvatar(
                      initial: message.senderInitial,
                      avatarUrl: message.senderAvatarUrl,
                      size: GroupSpacing.avatarSm,
                    )
                  : null,
            ),
            const SizedBox(width: GroupSpacing.sm),
            Flexible(child: bubble),
          ],
        ),
      ),
    );
  }

  BorderRadius _bubbleRadius(bool isMine) {
    const big = Radius.circular(GroupRadii.bubbleRadius);
    const small = Radius.circular(6);
    if (isMine) {
      return BorderRadius.only(
        topLeft: big,
        bottomLeft: big,
        topRight: message.isFirstInGroup ? big : small,
        bottomRight: message.isLastInGroup ? big : small,
      );
    }
    return BorderRadius.only(
      topRight: big,
      bottomRight: big,
      topLeft: message.isFirstInGroup ? big : small,
      bottomLeft: message.isLastInGroup ? big : small,
    );
  }
}
