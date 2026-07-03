import 'package:flutter/material.dart';

import '../../../../core/media/cached_image.dart';
import '../chat_theme.dart';
import '../chat_view_models.dart';

/// Pure presentational inbox row for the 1:1 messages list.
///
/// Mirrors the web `TikTokConversationItem`: leading avatar with an online
/// presence dot, a title row (name + verified + muted glyph + timestamp), a
/// second line that shows either a typing/activity indicator or the last
/// message preview (with delivery ticks when the last message is mine), and a
/// trailing unread/pending count pill.
///
/// All data is supplied via [conversation] / [currentUserId]; the widget never
/// touches Supabase or a repository. User actions are surfaced through the
/// [onTap] and [onArchive] callbacks. A trailing swipe (endToStart) reveals an
/// amber "Archive" affordance which invokes [onArchive] without removing the
/// row itself (the list owner decides what to do).
class ConversationListTile extends StatelessWidget {
  const ConversationListTile({
    super.key,
    required this.conversation,
    required this.currentUserId,
    required this.onTap,
    this.selected = false,
    this.onArchive,
  });

  final ConversationView conversation;
  final String currentUserId;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback? onArchive;

  @override
  Widget build(BuildContext context) {
    final row = _buildRow(context);

    // Only allow the archive swipe when there's a handler for it.
    if (onArchive == null) return row;

    return Dismissible(
      key: ValueKey('conversation-${conversation.id}'),
      direction: DismissDirection.endToStart,
      background: const SizedBox.shrink(),
      secondaryBackground: _buildArchiveBackground(),
      confirmDismiss: (_) async {
        // Never let the Dismissible remove the row; just fire the callback so
        // the owning list can decide (archive in place, animate, etc.).
        onArchive?.call();
        return false;
      },
      child: row,
    );
  }

  Widget _buildArchiveBackground() {
    // Align the amber action to the card bounds (same outer margin + rounded
    // clip as the row) so the affordance reveals *within* the rounded card, not
    // the inter-card gutter.
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.md,
        0,
        ChatSpacing.md,
        6,
      ),
      child: ClipRRect(
        borderRadius: ChatRadii.row,
        child: Container(
          color: ChatColors.amberWarning,
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.xl),
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.archive_outlined,
                color: ChatColors.primaryForeground,
                size: 22,
              ),
              SizedBox(height: ChatSpacing.xs),
              Text(
                'Archive',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: ChatColors.primaryForeground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRow(BuildContext context) {
    // Card-framed row matching the web `TikTokConversationItem`: every row is a
    // rounded-xl card with a faint muted fill + hairline border, swapping to a
    // primary wash + ring when selected. The whole card scales down slightly on
    // press for the same tactile feel as the web `active:scale-[0.98]`.
    final showSelection = selected;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.md,
        0,
        ChatSpacing.md,
        6, // web mb-1.5 inter-card gap
      ),
      child: _PressScale(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: showSelection ? ChatColors.primaryFaint : ChatColors.rowCard,
            borderRadius: ChatRadii.row,
            border: Border.all(
              color: showSelection
                  ? ChatColors.rowCardSelectedBorder
                  : ChatColors.rowCardBorder,
            ),
          ),
          child: ClipRRect(
            borderRadius: ChatRadii.row,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onTap,
                child: Container(
                  constraints: const BoxConstraints(
                    minHeight: ChatSpacing.listItemMinHeight,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: ChatSpacing.md,
                    vertical: ChatSpacing.md,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      _Avatar(
                        other: conversation.other,
                        isOnline: conversation.isOnline,
                      ),
                      const SizedBox(width: ChatSpacing.md),
                      Expanded(child: _content(context)),
                      _trailing(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _content(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [_titleRow(), const SizedBox(height: 2), _secondLine()],
    );
  }

  Widget _titleRow() {
    return Row(
      children: [
        Expanded(
          child: Text(
            conversation.other.displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: ChatTextStyles.conversationName,
          ),
        ),
        if (conversation.other.isVerified) ...[
          const SizedBox(width: ChatSpacing.xs),
          const Icon(Icons.verified, size: 14, color: ChatColors.primary),
        ],
        if (conversation.isMuted) ...[
          const SizedBox(width: ChatSpacing.xs),
          const Icon(
            Icons.notifications_off,
            size: 14,
            color: ChatColors.mutedForeground,
          ),
        ],
        const SizedBox(width: ChatSpacing.sm),
        Text(
          _friendlyTime(conversation.updatedAtMillis),
          style: ChatTextStyles.subtitle,
        ),
      ],
    );
  }

  Widget _secondLine() {
    if (conversation.isTyping) {
      return Row(
        children: [
          Icon(
            _activityIcon(conversation.activity),
            size: 14,
            color: ChatColors.primary,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              chatActivityText(conversation.activity),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontStyle: FontStyle.italic,
                color: ChatColors.primary,
              ),
            ),
          ),
        ],
      );
    }

    final isMine = conversation.lastMessageIsMine(currentUserId);
    final preview = conversation.lastMessageText.trim();
    final hasUnread = conversation.hasUnread;
    final previewText = preview.isEmpty ? 'Start a conversation' : preview;

    return Row(
      children: [
        if (isMine && preview.isNotEmpty) ...[
          _deliveryGlyph(conversation.lastMessageDelivery, hasUnread),
          const SizedBox(width: 4),
        ],
        Expanded(
          child: Text(
            previewText,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: hasUnread
                ? ChatTextStyles.previewUnread
                : ChatTextStyles.previewMuted,
          ),
        ),
      ],
    );
  }

  /// Single check when the last (mine) message is sent/delivered but not yet
  /// read by the other side; double check (primary) once it has been read.
  /// Wrapped in [Semantics] so the delivery state is announced consistently
  /// with the message bubble's status glyph.
  Widget _deliveryGlyph(DeliveryState? delivery, bool hasUnread) {
    final Icon icon;
    // When the other participant still has it unread (unreadCount on their
    // side is implied for us by a not-yet-read state) show a single check.
    if (delivery == DeliveryState.read) {
      icon = const Icon(Icons.done_all, size: 14, color: ChatColors.primary);
    } else if (delivery == DeliveryState.delivered) {
      icon = const Icon(
        Icons.done_all,
        size: 14,
        color: ChatColors.mutedForeground,
      );
    } else if (delivery == DeliveryState.sent) {
      icon = const Icon(
        Icons.check,
        size: 14,
        color: ChatColors.mutedForeground,
      );
    } else if (delivery == DeliveryState.failed) {
      icon = const Icon(
        Icons.error_outline,
        size: 14,
        color: ChatColors.destructive,
      );
    } else {
      // pending / null -> a faint schedule glyph as the optimistic state.
      icon = const Icon(
        Icons.schedule,
        size: 13,
        color: ChatColors.mutedForeground,
      );
    }
    return Semantics(
      label: delivery == null ? 'Sending' : deliveryStateLabel(delivery),
      child: icon,
    );
  }

  Widget _trailing() {
    if (conversation.unreadCount > 0) {
      return Padding(
        padding: const EdgeInsets.only(left: ChatSpacing.sm),
        child: _CountPill(count: conversation.unreadCount, muted: false),
      );
    }
    if (conversation.pendingCount > 0) {
      return Padding(
        padding: const EdgeInsets.only(left: ChatSpacing.sm),
        child: _CountPill(count: conversation.pendingCount, muted: true),
      );
    }
    return const SizedBox.shrink();
  }

  static IconData _activityIcon(ChatActivity activity) {
    switch (activity) {
      case ChatActivity.typing:
      case ChatActivity.focused:
        return Icons.more_horiz;
      case ChatActivity.emoji:
        return Icons.emoji_emotions_outlined;
      case ChatActivity.sticker:
        return Icons.sticky_note_2_outlined;
      case ChatActivity.voiceRecording:
        return Icons.mic_none;
      case ChatActivity.uploadingImage:
        return Icons.image_outlined;
      case ChatActivity.uploadingVideo:
        return Icons.videocam_outlined;
      case ChatActivity.uploadingFile:
        return Icons.insert_drive_file_outlined;
      case ChatActivity.none:
        return Icons.more_horiz;
    }
  }

  /// Compact relative timestamp (now / Nm / Nh / Nd / weekday / dd/mm).
  static String _friendlyTime(int millis) {
    if (millis <= 0) return '';
    final now = DateTime.now();
    final then = DateTime.fromMillisecondsSinceEpoch(millis);
    final diff = now.difference(then);

    if (diff.inSeconds < 45) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';

    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(then.day)}/${two(then.month)}';
  }
}

/// Wraps a row in a subtle scale-down-on-press animation, mirroring the web
/// `active:scale-[0.98]` tactile feedback. It deliberately does NOT consume the
/// tap (the inner [InkWell] keeps ownership of [onTap] + ripple); it only
/// observes press state to drive the scale.
class _PressScale extends StatefulWidget {
  const _PressScale({required this.child});

  final Widget child;

  @override
  State<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<_PressScale> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerUp: (_) => setState(() => _pressed = false),
      onPointerCancel: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1,
        duration: ChatMotion.fast,
        curve: ChatMotion.emphasized,
        child: widget.child,
      ),
    );
  }
}

/// Inbox avatar with optional network image, initials fallback and an online
/// presence dot anchored to the bottom-right.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.other, required this.isOnline});

  final ChatUserRef other;
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    const size = ChatSpacing.avatarMd;

    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: ChatGradients.avatarFallback,
      ),
      child: Text(
        other.initial,
        style: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: ChatColors.primaryForeground,
        ),
      ),
    );

    final Widget avatar = CachedCircleAvatar(
      url: other.avatarUrl,
      radius: size / 2,
      fallback: fallback,
    );

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          if (isOnline)
            Positioned(
              right: -2,
              bottom: -2,
              child: Container(
                width: ChatSpacing.inboxOnlineDot,
                height: ChatSpacing.inboxOnlineDot,
                decoration: BoxDecoration(
                  color: ChatColors.online,
                  shape: BoxShape.circle,
                  // web border-[3px] reads against the row-card fill, not the bg.
                  border: Border.all(color: ChatColors.rowCard, width: 3),
                  boxShadow: const [
                    BoxShadow(color: Color(0x33000000), blurRadius: 2),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Rounded count badge for unread (primary, with pink glow) or pending (muted).
class _CountPill extends StatelessWidget {
  const _CountPill({required this.count, required this.muted});

  final int count;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+' : '$count';

    return Container(
      constraints: const BoxConstraints(minWidth: 20),
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: muted ? ChatColors.muted : ChatColors.primary,
        borderRadius: ChatRadii.chip,
        boxShadow: muted ? null : ChatShadows.pink,
      ),
      child: Text(
        label,
        style: muted
            ? const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: ChatColors.mutedForeground,
              )
            : ChatTextStyles.badge,
      ),
    );
  }
}
