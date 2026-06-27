import 'package:flutter/material.dart';

import '../chat_theme.dart';
import '../chat_view_models.dart';

/// A single chat message bubble (text + chrome).
///
/// This widget is intentionally *presentational only*: it renders one
/// [ChatMessageView] using the shared [ChatColors] / [ChatGradients] /
/// [ChatRadii] / [ChatTextStyles] tokens and surfaces user intent through the
/// callbacks. It never reaches into Supabase, a repository, or the app theme.
///
/// The media body is injected by the parent via [mediaSlot] so this file stays
/// disjoint from the media widget; the inline link-preview card is injected via
/// [linkPreviewSlot]. Call-log "messages" render as a centered system row
/// rather than a bubble.
///
/// Layout (incoming example):
///
///   [avatar 28]  ┌──────────────────────┐
///                │ Forwarded            │
///                │ ▌ Sender             │
///                │ ▌ quoted content     │
///                │ (media slot)         │
///                │ body text…           │
///                │ (link preview slot)  │
///                │            12:30 ✓✓  │
///                └──────────────────────┘
///                [😂 2] [❤️ 1]
class ChatMessageBubble extends StatefulWidget {
  const ChatMessageBubble({
    super.key,
    required this.message,
    this.showAvatar = true,
    this.onTap,
    this.onLongPress,
    this.onSwipeReply,
    this.onReactionTap,
    this.mediaSlot,
    this.linkPreviewSlot,
  });

  final ChatMessageView message;

  /// Whether the incoming-side avatar gutter is rendered at all. Own messages
  /// never show an avatar regardless of this flag.
  final bool showAvatar;

  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  /// Fired when the user swipes the bubble past the reply threshold toward the
  /// bubble's reply direction.
  final VoidCallback? onSwipeReply;

  /// Fired when a reaction chip below the bubble is tapped.
  final void Function(ReactionGroup group)? onReactionTap;

  /// Media body, injected by the parent so this file does not depend on the
  /// media widget. Rendered inside the bubble, above the text.
  final Widget? mediaSlot;

  /// Inline link-preview card, injected by the parent. Rendered under the text.
  final Widget? linkPreviewSlot;

  @override
  State<ChatMessageBubble> createState() => _ChatMessageBubbleState();
}

class _ChatMessageBubbleState extends State<ChatMessageBubble> {
  /// Live horizontal offset while the user is dragging toward the reply side.
  double _dragOffset = 0;

  /// Distance (px) the bubble must travel before a release fires [onSwipeReply].
  static const double _replyThreshold = 56;

  /// Maximum visual travel so the bubble does not slide off-screen.
  static const double _maxDrag = 88;

  ChatMessageView get _message => widget.message;

  bool get _isMine => _message.isMine;

  @override
  Widget build(BuildContext context) {
    // Call-log entries are a centered system row, never a bubble.
    if (_message.isCallLog) {
      return _CallLogRow(message: _message);
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final available = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : MediaQuery.of(context).size.width;
        final maxBubbleWidth = available * ChatSpacing.bubbleMaxWidthFraction;

        final row = Row(
          mainAxisAlignment: _isMine
              ? MainAxisAlignment.end
              : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!_isMine) _buildLeadingGutter(),
            Flexible(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxBubbleWidth),
                child: Column(
                  crossAxisAlignment: _isMine
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildBubble(),
                    if (_message.reactions.isNotEmpty) _buildReactions(),
                    ?_buildReadReceiptFooter(),
                  ],
                ),
              ),
            ),
          ],
        );

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          onLongPress: widget.onLongPress,
          onHorizontalDragUpdate: widget.onSwipeReply == null
              ? null
              : _handleDragUpdate,
          onHorizontalDragEnd: widget.onSwipeReply == null
              ? null
              : _handleDragEnd,
          child: Stack(
            children: [
              if (_dragOffset.abs() > 12) _buildSwipeAffordance(),
              AnimatedContainer(
                duration: ChatMotion.fast,
                curve: ChatMotion.emphasized,
                transform: Matrix4.translationValues(
                  _isMine ? -_dragOffset : _dragOffset,
                  0,
                  0,
                ),
                child: row,
              ),
            ],
          ),
        );
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Swipe-to-reply
  // ---------------------------------------------------------------------------

  void _handleDragUpdate(DragUpdateDetails details) {
    // Reply direction: own bubbles swipe left, incoming swipe right.
    final delta = _isMine ? -details.delta.dx : details.delta.dx;
    final next = (_dragOffset + delta).clamp(0.0, _maxDrag);
    if (next != _dragOffset) {
      setState(() => _dragOffset = next);
    }
  }

  void _handleDragEnd(DragEndDetails details) {
    if (_dragOffset >= _replyThreshold) {
      widget.onSwipeReply?.call();
    }
    setState(() => _dragOffset = 0);
  }

  Widget _buildSwipeAffordance() {
    final reached = _dragOffset >= _replyThreshold;
    return Positioned.fill(
      child: Align(
        alignment: _isMine ? Alignment.centerRight : Alignment.centerLeft,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.sm),
          child: Opacity(
            opacity: (_dragOffset / _replyThreshold).clamp(0.0, 1.0),
            child: Container(
              width: ChatSpacing.tapTarget,
              height: ChatSpacing.tapTarget,
              decoration: BoxDecoration(
                color: reached
                    ? ChatColors.primarySoft
                    : ChatColors.primaryFaint,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.reply,
                size: 20,
                color: ChatColors.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Avatar gutter (incoming only)
  // ---------------------------------------------------------------------------

  Widget _buildLeadingGutter() {
    const size = ChatSpacing.avatarSm; // 28
    // Only the last bubble of an incoming run shows the avatar; otherwise a
    // same-width spacer keeps the run aligned.
    if (!widget.showAvatar || !_message.isLastInGroup) {
      return const SizedBox(width: size);
    }

    Widget avatar;
    final url = _message.senderAvatarUrl;
    if (url != null && url.isNotEmpty) {
      avatar = ClipOval(
        child: Image.network(
          url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _initialAvatar(size),
        ),
      );
    } else {
      avatar = _initialAvatar(size);
    }

    return Padding(
      padding: const EdgeInsets.only(right: ChatSpacing.sm),
      child: SizedBox(width: size, height: size, child: avatar),
    );
  }

  Widget _initialAvatar(double size) {
    final initial = _message.senderName.trim().isEmpty
        ? '?'
        : _message.senderName.trim().characters.first.toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: ChatGradients.avatarFallback,
        shape: BoxShape.circle,
      ),
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: ChatColors.primaryForeground,
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // The bubble itself
  // ---------------------------------------------------------------------------

  Widget _buildBubble() {
    final radius = ChatRadii.groupedBubble(
      isMine: _isMine,
      isFirstInGroup: _message.isFirstInGroup,
      isLastInGroup: _message.isLastInGroup,
    );

    final decoration = _isMine
        ? BoxDecoration(
            gradient: ChatGradients.outgoingBubble,
            borderRadius: radius,
            boxShadow: ChatShadows.pink,
          )
        : BoxDecoration(
            color: ChatColors.incomingBubble,
            borderRadius: radius,
            border: Border.all(color: ChatColors.incomingBubbleBorder),
          );

    // The body foreground colour drives text + meta tints.
    final fg = _isMine ? ChatColors.primaryForeground : ChatColors.foreground;

    final bubble = Container(
      decoration: decoration,
      padding: const EdgeInsets.symmetric(
        horizontal: ChatSpacing.md - 2, // ~10px (web px-2.5)
        vertical: ChatSpacing.xs + 2, // ~6px (web py-1.5)
      ),
      child: Column(
        crossAxisAlignment: _isMine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: _buildBubbleChildren(fg),
      ),
    );

    if (!_message.isHighlighted) return bubble;

    // Search / jump-to highlight: a soft primary ring the parent can toggle off
    // after ~3s by flipping [isHighlighted].
    return AnimatedContainer(
      duration: ChatMotion.normal,
      curve: ChatMotion.emphasized,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: ChatColors.primaryFaint,
        borderRadius: BorderRadius.all(Radius.circular(ChatRadii.lg + 3)),
        boxShadow: ChatShadows.glow,
      ),
      child: bubble,
    );
  }

  List<Widget> _buildBubbleChildren(Color fg) {
    final children = <Widget>[];

    // (1) Forwarded label.
    if (_message.forwardedFrom != null) {
      children.add(_buildForwardedLabel());
    }

    // (2) Inline quoted reply.
    if (_message.replyPreview != null) {
      children.add(_buildReplyQuote(_message.replyPreview!, fg));
    }

    if (_message.isDeletedForEveryone) {
      // Tombstone — skip media/text/link, keep the meta row.
      children.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.block, size: 14, color: ChatColors.mutedForeground),
              const SizedBox(width: ChatSpacing.xs),
              Text(
                'This message was deleted',
                style: ChatTextStyles.messageBody.copyWith(
                  fontStyle: FontStyle.italic,
                  color: ChatColors.mutedForeground,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    } else {
      // (3a) Media body (injected).
      if (widget.mediaSlot != null) {
        children.add(
          Padding(
            padding: EdgeInsets.only(
              bottom: _message.hasText ? ChatSpacing.xs : 0,
            ),
            child: widget.mediaSlot!,
          ),
        );
      }

      // (3b) Text body.
      if (_message.hasText) {
        children.add(_buildTextBody(fg));
      }

      // (4) Link preview (injected), under the text.
      if (widget.linkPreviewSlot != null) {
        children.add(
          Padding(
            padding: const EdgeInsets.only(top: ChatSpacing.xs),
            child: widget.linkPreviewSlot!,
          ),
        );
      }
    }

    // (5) Meta row (time, edited, status).
    children.add(_buildMetaRow(fg));

    return children;
  }

  Widget _buildForwardedLabel() {
    return Padding(
      padding: const EdgeInsets.only(bottom: ChatSpacing.xs),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.forward, size: 12, color: ChatColors.mutedForeground),
          const SizedBox(width: 3),
          Text(
            'Forwarded',
            style: ChatTextStyles.timestamp.copyWith(
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReplyQuote(ReplyPreview reply, Color fg) {
    // The quote sits on a faint wash that adapts to the bubble side; the accent
    // stripe matches the web `border-l-2 border-primary/50`.
    final wash = _isMine ? const Color(0x1AFFFFFF) : ChatColors.primaryFaint;
    final nameColor = _isMine
        ? ChatColors.primaryForeground
        : ChatColors.accent;
    final contentColor = _isMine
        ? const Color(0xCCFFFFFF) // white @ 80%
        : ChatColors.mutedForeground;

    return Padding(
      padding: const EdgeInsets.only(bottom: ChatSpacing.xs),
      child: Container(
        constraints: const BoxConstraints(minWidth: 80),
        decoration: BoxDecoration(
          color: wash,
          borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.sm)),
        ),
        padding: const EdgeInsets.fromLTRB(0, 0, ChatSpacing.sm, 0),
        child: IntrinsicHeight(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 3px accent stripe.
              Container(
                width: 3,
                decoration: const BoxDecoration(
                  color: ChatColors.accent,
                  borderRadius: BorderRadius.all(
                    Radius.circular(ChatRadii.pill),
                  ),
                ),
              ),
              const SizedBox(width: ChatSpacing.sm),
              Flexible(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        reply.senderName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: nameColor,
                        ),
                      ),
                      Text(
                        reply.content,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12, color: contentColor),
                      ),
                    ],
                  ),
                ),
              ),
              if (reply.mediaThumbUrl != null &&
                  reply.mediaThumbUrl!.isNotEmpty) ...[
                const SizedBox(width: ChatSpacing.sm),
                ClipRRect(
                  borderRadius: const BorderRadius.all(
                    Radius.circular(ChatRadii.grouped),
                  ),
                  child: Image.network(
                    reply.mediaThumbUrl!,
                    width: ChatSpacing.avatarSm,
                    height: ChatSpacing.avatarSm,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: ChatSpacing.avatarSm,
                      height: ChatSpacing.avatarSm,
                      color: ChatColors.muted,
                      child: const Icon(
                        Icons.image,
                        size: 14,
                        color: ChatColors.mutedForeground,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextBody(Color fg) {
    if (_message.isEmojiOnly) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: ChatSpacing.xs),
        child: Text(
          _message.body,
          textAlign: TextAlign.center,
          style: ChatTextStyles.emojiOnly,
        ),
      );
    }
    return Text(
      _message.body,
      softWrap: true,
      style: ChatTextStyles.messageBody.copyWith(color: fg),
    );
  }

  Widget _buildMetaRow(Color fg) {
    // Time + edited + status are tinted onto the bubble foreground. On the
    // outgoing gradient we soften the white; on incoming we keep muted.
    final metaColor = _isMine
        ? const Color(0xB3FFFFFF)
        : ChatColors.mutedForeground;

    final items = <Widget>[];

    if (_message.isEdited) {
      items.add(
        Text(
          'edited',
          style: ChatTextStyles.timestamp.copyWith(
            color: metaColor,
            fontStyle: FontStyle.italic,
          ),
        ),
      );
    }

    items.add(
      Text(
        _formatTime(_message.createdAtMillis),
        style: ChatTextStyles.timestamp.copyWith(color: metaColor),
      ),
    );

    if (_isMine) {
      items.add(_buildStatusGlyph());
    }

    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Wrap(
        alignment: _isMine ? WrapAlignment.end : WrapAlignment.start,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: ChatSpacing.xs,
        children: items,
      ),
    );
  }

  /// Delivery-status glyph — identical mapping to the inbox row ticks, wrapped
  /// with a [Tooltip]/[Semantics] so the state is announced/inspectable. The
  /// read tick uses the sky readTick colour; everything pre-read is the softer
  /// on-gradient white, and a failure is the destructive red.
  Widget _buildStatusGlyph() {
    const double size = 14;
    const unread = Color(0x80FFFFFF); // white @ 50% on the gradient

    final Icon icon;
    switch (_message.deliveryState) {
      case DeliveryState.pending:
        icon = const Icon(Icons.schedule, size: size, color: unread);
      case DeliveryState.sent:
        icon = const Icon(Icons.check, size: size, color: unread);
      case DeliveryState.delivered:
        icon = const Icon(Icons.done_all, size: size, color: unread);
      case DeliveryState.read:
        icon = const Icon(
          Icons.done_all,
          size: size,
          color: ChatColors.readTick,
        );
      case DeliveryState.failed:
        icon = const Icon(
          Icons.error_outline,
          size: size,
          color: ChatColors.destructive,
        );
    }

    final label = deliveryStateLabel(_message.deliveryState);
    return Tooltip(
      message: label,
      child: Semantics(label: label, child: icon),
    );
  }

  /// A subtle "Read HH:mm" footer under an own message once a local
  /// read-receipt exists. Driven entirely by [ChatMessageView.readReceipts];
  /// renders nothing until that local state is populated (the backend receipt
  /// contract is not finalised). Only shown on the last bubble of a run to
  /// avoid repeating across a grouped block.
  Widget? _buildReadReceiptFooter() {
    if (!_isMine || !_message.isLastInGroup) return null;
    if (_message.readReceipts.isEmpty) return null;

    // Earliest read among recipients drives the displayed time (1:1 today;
    // for groups this is "first read" which is a reasonable summary).
    var readAt = _message.readReceipts.first.readAtMillis;
    for (final r in _message.readReceipts) {
      if (r.readAtMillis < readAt) readAt = r.readAtMillis;
    }
    if (readAt <= 0) return null;

    return Padding(
      padding: const EdgeInsets.only(top: 2, right: 2),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.done_all, size: 12, color: ChatColors.readTick),
          const SizedBox(width: 4),
          Text(
            'Read ${_formatTime(readAt)}',
            style: ChatTextStyles.timestamp.copyWith(
              color: ChatColors.readTick,
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Reactions (below the bubble)
  // ---------------------------------------------------------------------------

  Widget _buildReactions() {
    return Padding(
      padding: const EdgeInsets.only(top: ChatSpacing.xs),
      child: Wrap(
        alignment: _isMine ? WrapAlignment.end : WrapAlignment.start,
        spacing: ChatSpacing.xs,
        runSpacing: ChatSpacing.xs,
        children: [
          for (final group in _message.reactions)
            _ReactionChip(
              group: group,
              onTap: widget.onReactionTap == null
                  ? null
                  : () => widget.onReactionTap!(group),
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Inline HH:mm formatter (avoids a date package dependency).
  static String _formatTime(int millis) {
    final dt = DateTime.fromMillisecondsSinceEpoch(millis).toLocal();
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }
}

/// A single reaction pill (emoji + count) rendered below a bubble.
class _ReactionChip extends StatelessWidget {
  const _ReactionChip({required this.group, this.onTap});

  final ReactionGroup group;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final reacted = group.reactedByMe;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: ChatRadii.chip,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: ChatColors.muted,
            borderRadius: ChatRadii.chip,
            border: Border.all(
              color: reacted ? ChatColors.primary : ChatColors.border,
              width: reacted ? 1.2 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(group.emoji, style: const TextStyle(fontSize: 13)),
              if (group.count > 1) ...[
                const SizedBox(width: 4),
                Text(
                  '${group.count}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: reacted
                        ? ChatColors.primary
                        : ChatColors.mutedForeground,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Centered, muted system row for a call-log "message" (never a bubble).
class _CallLogRow extends StatelessWidget {
  const _CallLogRow({required this.message});

  final ChatMessageView message;

  @override
  Widget build(BuildContext context) {
    final time = _ChatMessageBubbleState._formatTime(message.createdAtMillis);
    // The call body text (and any status nuance) is resolved upstream into
    // `body`; fall back to a neutral label so this never renders empty.
    final label = message.body.trim().isEmpty ? 'Call' : message.body.trim();

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: ChatSpacing.xs),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ChatSpacing.md,
            vertical: ChatSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: ChatColors.muted,
            borderRadius: ChatRadii.chip,
            border: Border.all(color: ChatColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.call,
                size: 15,
                color: ChatColors.mutedForeground,
              ),
              const SizedBox(width: ChatSpacing.sm),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ChatTextStyles.subtitle,
                ),
              ),
              const SizedBox(width: ChatSpacing.sm),
              Text(time, style: ChatTextStyles.timestamp),
            ],
          ),
        ),
      ),
    );
  }
}
