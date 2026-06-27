import 'package:flutter/material.dart';

import '../chat_theme.dart';
import '../chat_view_models.dart';
import 'reaction_picker_bar.dart';

/// The long-press context menu for a single message, rendered as the *body* of
/// a bottom sheet.
///
/// The parent presents this via:
/// ```dart
/// showModalBottomSheet(
///   context: context,
///   barrierColor: ChatColors.barrier,
///   backgroundColor: Colors.transparent,
///   shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
///   builder: (_) => MessageActionSheet(message: msg, onReact: ..., ...),
/// );
/// ```
///
/// Layout, top to bottom:
///   1. A [ReactionPickerBar] (core quick-reactions + expandable extended grid),
///      pre-selecting whichever emoji the current user already reacted with.
///   2. A divider.
///   3. A vertical list of action rows, each gated by the message's state.
///
/// ### Dismissal contract
/// Every row that fires a callback first pops the sheet (`Navigator.pop`) and
/// *then* invokes its callback. The reaction picker likewise pops before
/// emitting [onReact]. The parent therefore does NOT need to close the sheet
/// itself — it only handles the emitted intent (open a dialog, copy text, etc.).
///
/// ### Scope
/// This is pure UI. It only emits intent callbacks. The follow-up flows —
/// delete confirmation, report-reason picker, forward target picker, edit
/// composer — are separate area widgets and are not built here. Pin and any
/// gift/sticker/schedule/secret entries are intentionally omitted.
class MessageActionSheet extends StatefulWidget {
  const MessageActionSheet({
    super.key,
    required this.message,
    required this.onReact,
    required this.onReply,
    required this.onForward,
    required this.onStar,
    this.onCopy,
    this.onEdit,
    this.onDelete,
    this.onReport,
  });

  /// The message the menu is acting on. Drives every visibility gate and the
  /// star/unstar label + icon.
  final ChatMessageView message;

  /// Emitted when the user taps an emoji in the reaction picker.
  final void Function(String emoji) onReact;

  /// Reply to the message. Always available.
  final VoidCallback onReply;

  /// Forward the message. Always available.
  final VoidCallback onForward;

  /// Toggle the starred state. Always available; the row reflects
  /// [ChatMessageView.isStarred].
  final VoidCallback onStar;

  /// Copy the message text. Shown only when the message has text.
  final VoidCallback? onCopy;

  /// Edit the message. Shown only for own text-only (non-media) messages.
  final VoidCallback? onEdit;

  /// Delete the message. Shown only for own messages; rendered destructive.
  final VoidCallback? onDelete;

  /// Report the message. Shown only for others' messages; rendered destructive.
  final VoidCallback? onReport;

  @override
  State<MessageActionSheet> createState() => _MessageActionSheetState();
}

class _MessageActionSheetState extends State<MessageActionSheet>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entranceController = AnimationController(
    vsync: this,
    duration: ChatMotion.normal,
  );

  late final Animation<double> _scale = CurvedAnimation(
    parent: _entranceController,
    curve: ChatMotion.spring,
  );

  late final Animation<double> _fade = CurvedAnimation(
    parent: _entranceController,
    curve: Curves.easeOut,
  );

  @override
  void initState() {
    super.initState();
    _entranceController.forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    super.dispose();
  }

  /// Pop the sheet first (per the dismissal contract) then run [action].
  void _runAndClose(VoidCallback action) {
    Navigator.of(context).maybePop();
    action();
  }

  /// The emoji the current user already reacted with, if any.
  String? get _selectedEmoji {
    for (final group in widget.message.reactions) {
      if (group.reactedByMe) return group.emoji;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;

    // Visibility gates (mirrors the web MessageContextMenu, sans Pin/group).
    final bool showCopy = message.hasText && widget.onCopy != null;
    final bool showEdit =
        message.isMine &&
        message.hasText &&
        !message.hasMedia &&
        widget.onEdit != null;
    final bool showDelete = message.isMine && widget.onDelete != null;
    final bool showReport = !message.isMine && widget.onReport != null;

    final List<Widget> rows = <Widget>[
      _ActionRow(
        icon: Icons.reply_rounded,
        label: 'Reply',
        onTap: () => _runAndClose(widget.onReply),
      ),
      if (showCopy)
        _ActionRow(
          icon: Icons.content_copy_rounded,
          label: 'Copy',
          onTap: () => _runAndClose(widget.onCopy!),
        ),
      _ActionRow(
        icon: Icons.forward_rounded,
        label: 'Forward',
        onTap: () => _runAndClose(widget.onForward),
      ),
      _ActionRow(
        icon: message.isStarred
            ? Icons.star_rounded
            : Icons.star_outline_rounded,
        label: message.isStarred ? 'Unstar' : 'Star',
        onTap: () => _runAndClose(widget.onStar),
      ),
      if (showEdit)
        _ActionRow(
          icon: Icons.edit_outlined,
          label: 'Edit',
          onTap: () => _runAndClose(widget.onEdit!),
        ),
      if (showDelete)
        _ActionRow(
          icon: Icons.delete_outline_rounded,
          label: 'Delete',
          destructive: true,
          onTap: () => _runAndClose(widget.onDelete!),
        ),
      if (showReport)
        _ActionRow(
          icon: Icons.flag_outlined,
          label: 'Report',
          destructive: true,
          onTap: () => _runAndClose(widget.onReport!),
        ),
    ];

    return FadeTransition(
      opacity: _fade,
      child: ScaleTransition(
        scale: _scale,
        alignment: Alignment.bottomCenter,
        child: SafeArea(
          top: false,
          child: Container(
            margin: const EdgeInsets.all(ChatSpacing.sm),
            decoration: BoxDecoration(
              color: ChatColors.card,
              borderRadius: ChatRadii.card,
              border: Border.all(color: ChatColors.border),
              boxShadow: ChatShadows.sheet,
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Grab handle for affordance.
                const _SheetGrabHandle(),

                // 1. Reaction picker.
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    ChatSpacing.md,
                    0,
                    ChatSpacing.md,
                    ChatSpacing.sm,
                  ),
                  child: ReactionPickerBar(
                    selectedEmoji: _selectedEmoji,
                    onReact: (emoji) =>
                        _runAndClose(() => widget.onReact(emoji)),
                  ),
                ),

                // 2. Divider.
                const Divider(
                  height: 1,
                  thickness: 1,
                  color: ChatColors.border,
                ),

                // 3. Action rows.
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: ChatSpacing.xs),
                  child: Column(mainAxisSize: MainAxisSize.min, children: rows),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The small rounded grab handle at the top of the sheet body.
class _SheetGrabHandle extends StatelessWidget {
  const _SheetGrabHandle();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(
        top: ChatSpacing.sm,
        bottom: ChatSpacing.sm,
      ),
      width: 36,
      height: 4,
      decoration: const BoxDecoration(
        color: ChatColors.muted,
        borderRadius: BorderRadius.all(Radius.circular(ChatRadii.pill)),
      ),
    );
  }
}

/// A single tappable action row: a fixed leading icon box plus a label.
/// Destructive rows tint both the icon and label with [ChatColors.destructive].
class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final Color tint = destructive
        ? ChatColors.destructive
        : ChatColors.mutedForeground;
    final TextStyle labelStyle = destructive
        ? ChatTextStyles.actionItem.copyWith(color: ChatColors.destructive)
        : ChatTextStyles.actionItem;

    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        splashColor: ChatColors.primaryFaint,
        highlightColor: ChatColors.muted,
        child: Container(
          constraints: const BoxConstraints(minHeight: ChatSpacing.tapTarget),
          padding: const EdgeInsets.symmetric(
            horizontal: ChatSpacing.md,
            vertical: ChatSpacing.sm,
          ),
          child: Row(
            children: [
              // Fixed leading icon box for consistent label alignment.
              SizedBox(
                width: ChatSpacing.xl,
                height: ChatSpacing.xl,
                child: Icon(icon, size: 20, color: tint),
              ),
              const SizedBox(width: ChatSpacing.md),
              Expanded(
                child: Text(
                  label,
                  style: labelStyle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
