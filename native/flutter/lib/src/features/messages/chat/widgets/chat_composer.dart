import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/media/cached_image.dart';
import '../chat_theme.dart';
import '../chat_view_models.dart';

/// Bottom input area for the 1:1 chat surface, ported for visual parity with
/// the web `ModernChatInterface` composer (src/components/messages).
///
/// Two stacked parts:
///  * TOP — the reply preview bar (only when [replyPreview] is non-null): a
///    [ChatColors.card] row with a 3px [ChatColors.primary] accent stripe, an
///    optional media thumbnail, the "Replying to {name}" label over the quoted
///    content (or a media placeholder), and a trailing close button.
///  * BOTTOM — a rounded pill ([ChatColors.input] fill, [ChatRadii.pill],
///    subtle border) holding a leading "+" attach button, a multiline text
///    field, an emoji button, and a right action that swaps between a circular
///    gradient Send button (when there is text or pending media) and a Mic
///    button (when empty).
///
/// Intentionally omitted (per scope): gift, sticker, schedule, and AI sparkle
/// affordances are NOT rendered here — they are out of scope, not stubbed.
///
/// Pure presentation plus a local debounce [Timer] for [onTypingChanged]; this
/// widget never touches Supabase or any repository.
class ChatComposer extends StatefulWidget {
  const ChatComposer({
    super.key,
    required this.controller,
    required this.onSend,
    required this.onAttach,
    required this.onVoice,
    this.hasPendingMedia = false,
    this.replyPreview,
    this.onEmoji,
    this.onCancelReply,
    this.onTypingChanged,
  });

  /// The shared text controller owned by the screen. The composer listens to it
  /// to swap the right action and to drive typing notifications.
  final TextEditingController controller;

  /// True when a media attachment is staged but not yet typed over — forces the
  /// Send action to show even with an empty text field.
  final bool hasPendingMedia;

  /// When non-null, renders the reply preview bar above the input pill.
  final ReplyPreview? replyPreview;

  /// Invoked when the user taps Send or submits a non-empty field.
  final VoidCallback onSend;

  /// Invoked when the user taps the leading "+" attach button.
  final VoidCallback onAttach;

  /// Invoked when the user taps the Mic button (empty field).
  final VoidCallback onVoice;

  /// Invoked when the user taps the emoji button. When null the button is still
  /// rendered (for layout parity) but is a no-op placeholder.
  final VoidCallback? onEmoji;

  /// Invoked from the reply preview bar's close button.
  final VoidCallback? onCancelReply;

  /// Debounced typing signal: `true` on the first keystroke of an active burst,
  /// `false` after ~3s idle or once the field becomes empty.
  final void Function(bool isActive)? onTypingChanged;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  static const Duration _typingIdle = Duration(seconds: 3);

  Timer? _typingTimer;
  bool _typingActive = false;
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _hasText = widget.controller.text.trim().isNotEmpty;
    widget.controller.addListener(_handleTextChanged);
  }

  @override
  void didUpdateWidget(covariant ChatComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_handleTextChanged);
      widget.controller.addListener(_handleTextChanged);
      _hasText = widget.controller.text.trim().isNotEmpty;
    }
  }

  @override
  void dispose() {
    _typingTimer?.cancel();
    widget.controller.removeListener(_handleTextChanged);
    super.dispose();
  }

  void _handleTextChanged() {
    final hasText = widget.controller.text.trim().isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }

    if (hasText) {
      // First keystroke of a burst -> emit active.
      if (!_typingActive) {
        _typingActive = true;
        widget.onTypingChanged?.call(true);
      }
      // Restart the idle countdown on every keystroke.
      _typingTimer?.cancel();
      _typingTimer = Timer(_typingIdle, _emitIdle);
    } else {
      // Field emptied -> stop immediately.
      _typingTimer?.cancel();
      _emitIdle();
    }
  }

  void _emitIdle() {
    _typingTimer?.cancel();
    _typingTimer = null;
    if (_typingActive) {
      _typingActive = false;
      widget.onTypingChanged?.call(false);
    }
  }

  void _handleSendPressed() {
    if (!_hasText && !widget.hasPendingMedia) return;
    // Sending ends the typing burst.
    _emitIdle();
    widget.onSend();
  }

  void _handleSubmitted(String _) {
    if (!_hasText) return;
    _emitIdle();
    widget.onSend();
  }

  bool get _showSend => _hasText || widget.hasPendingMedia;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final safeBottom = MediaQuery.viewPaddingOf(context).bottom;

    return Container(
      decoration: const BoxDecoration(
        color: ChatColors.background,
        border: Border(top: BorderSide(color: ChatColors.border, width: 0.5)),
      ),
      child: Padding(
        // Sit above the keyboard; fall back to the safe-area inset when closed.
        padding: EdgeInsets.only(
          bottom: bottomInset > 0 ? bottomInset : safeBottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.replyPreview != null)
              _ReplyPreviewBar(
                preview: widget.replyPreview!,
                onCancel: widget.onCancelReply,
              ),
            _InputRow(
              controller: widget.controller,
              showSend: _showSend,
              onAttach: widget.onAttach,
              onEmoji: widget.onEmoji,
              onVoice: widget.onVoice,
              onSendPressed: _handleSendPressed,
              onSubmitted: _handleSubmitted,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Reply preview bar
// ---------------------------------------------------------------------------

class _ReplyPreviewBar extends StatelessWidget {
  const _ReplyPreviewBar({required this.preview, this.onCancel});

  final ReplyPreview preview;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ChatColors.card,
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.md,
        ChatSpacing.sm,
        ChatSpacing.xs,
        ChatSpacing.sm,
      ),
      child: Row(
        children: [
          // 3px primary accent stripe.
          Container(
            width: 3,
            height: 36,
            decoration: const BoxDecoration(
              color: ChatColors.primary,
              borderRadius: BorderRadius.all(Radius.circular(2)),
            ),
          ),
          const SizedBox(width: ChatSpacing.md),
          if (preview.mediaThumbUrl != null) ...[
            _ReplyThumbnail(
              url: preview.mediaThumbUrl!,
              kind: preview.mediaKind,
            ),
            const SizedBox(width: ChatSpacing.md),
          ],
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Replying to ${preview.senderName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: ChatColors.primary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _quoteLine(preview),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ChatTextStyles.previewMuted,
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onCancel,
            visualDensity: VisualDensity.compact,
            iconSize: 18,
            splashRadius: 20,
            color: ChatColors.mutedForeground,
            tooltip: 'Cancel reply',
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }

  /// The quoted line: the resolved text, or a media-kind placeholder when the
  /// reply target carries media but no text content.
  static String _quoteLine(ReplyPreview preview) {
    final content = preview.content.trim();
    if (content.isNotEmpty) return content;
    switch (preview.mediaKind) {
      case ChatMediaKind.image:
        return 'Photo';
      case ChatMediaKind.video:
        return 'Video';
      case ChatMediaKind.audio:
        return 'Audio note';
      case ChatMediaKind.music:
        return 'Music';
      case ChatMediaKind.file:
        return 'File';
      case ChatMediaKind.callLog:
        return 'Call';
      case ChatMediaKind.none:
        return '';
    }
  }
}

class _ReplyThumbnail extends StatelessWidget {
  const _ReplyThumbnail({required this.url, required this.kind});

  final String url;
  final ChatMediaKind kind;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: ChatColors.muted,
        borderRadius: const BorderRadius.all(Radius.circular(ChatRadii.sm)),
        border: Border.all(color: ChatColors.primarySoft, width: 1.5),
      ),
      child: CachedImage(
        url: url,
        fit: BoxFit.cover,
        placeholderColor: ChatColors.muted,
        errorWidget: _fallbackIcon,
      ),
    );
  }

  Widget get _fallbackIcon => Center(
    child: Icon(_iconFor(kind), size: 14, color: ChatColors.mutedForeground),
  );

  static IconData _iconFor(ChatMediaKind kind) {
    switch (kind) {
      case ChatMediaKind.video:
        return Icons.videocam_outlined;
      case ChatMediaKind.audio:
        return Icons.graphic_eq_rounded;
      case ChatMediaKind.music:
        return Icons.music_note_outlined;
      case ChatMediaKind.file:
        return Icons.attach_file;
      case ChatMediaKind.callLog:
        return Icons.call_outlined;
      case ChatMediaKind.image:
      case ChatMediaKind.none:
        return Icons.image_outlined;
    }
  }
}

// ---------------------------------------------------------------------------
// Input pill row
// ---------------------------------------------------------------------------

class _InputRow extends StatelessWidget {
  const _InputRow({
    required this.controller,
    required this.showSend,
    required this.onAttach,
    required this.onEmoji,
    required this.onVoice,
    required this.onSendPressed,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final bool showSend;
  final VoidCallback onAttach;
  final VoidCallback? onEmoji;
  final VoidCallback onVoice;
  final VoidCallback onSendPressed;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.md,
        ChatSpacing.sm,
        ChatSpacing.md,
        ChatSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: ChatColors.input,
                borderRadius: const BorderRadius.all(
                  Radius.circular(ChatRadii.pill),
                ),
                border: Border.all(color: ChatColors.border, width: 0.5),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _PillIconButton(
                    icon: Icons.add,
                    tooltip: 'Attach',
                    onPressed: onAttach,
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: TextField(
                        controller: controller,
                        minLines: 1,
                        maxLines: 5,
                        textInputAction: TextInputAction.send,
                        keyboardType: TextInputType.multiline,
                        textCapitalization: TextCapitalization.sentences,
                        cursorColor: ChatColors.primary,
                        style: ChatTextStyles.messageBody,
                        onSubmitted: onSubmitted,
                        decoration: const InputDecoration(
                          isDense: true,
                          hintText: 'Message',
                          hintStyle: TextStyle(
                            fontSize: 15,
                            color: ChatColors.mutedForeground,
                          ),
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 4),
                        ),
                      ),
                    ),
                  ),
                  _PillIconButton(
                    icon: Icons.emoji_emotions_outlined,
                    tooltip: 'Emoji',
                    // Still visible when null; the button is simply a no-op.
                    onPressed: onEmoji,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: ChatSpacing.sm),
          _RightAction(
            showSend: showSend,
            onSend: onSendPressed,
            onVoice: onVoice,
          ),
        ],
      ),
    );
  }
}

/// A flat ghost icon button used for the in-pill affordances (attach / emoji).
class _PillIconButton extends StatelessWidget {
  const _PillIconButton({
    required this.icon,
    required this.tooltip,
    this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 40,
      height: 40,
      child: IconButton(
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        iconSize: 22,
        splashRadius: 20,
        color: ChatColors.mutedForeground,
        tooltip: tooltip,
        icon: Icon(icon),
      ),
    );
  }
}

/// The swapping right action: a circular gradient Send button when there is
/// content, or a flat Mic button when the field is empty.
class _RightAction extends StatelessWidget {
  const _RightAction({
    required this.showSend,
    required this.onSend,
    required this.onVoice,
  });

  final bool showSend;
  final VoidCallback onSend;
  final VoidCallback onVoice;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: ChatMotion.fast,
      transitionBuilder: (child, animation) => ScaleTransition(
        scale: animation,
        child: FadeTransition(opacity: animation, child: child),
      ),
      child: showSend
          ? _SendButton(key: const ValueKey('send'), onPressed: onSend)
          : _MicButton(key: const ValueKey('mic'), onPressed: onVoice),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Send',
      child: Material(
        type: MaterialType.transparency,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: ChatGradients.sendAction,
            boxShadow: ChatShadows.pink,
          ),
          child: InkWell(
            onTap: onPressed,
            customBorder: const CircleBorder(),
            child: const SizedBox(
              width: ChatSpacing.tapTarget,
              height: ChatSpacing.tapTarget,
              child: Icon(
                Icons.arrow_upward,
                size: 22,
                color: ChatColors.primaryForeground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MicButton extends StatelessWidget {
  const _MicButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: ChatSpacing.tapTarget,
      height: ChatSpacing.tapTarget,
      child: IconButton(
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        iconSize: 24,
        splashRadius: 22,
        color: ChatColors.mutedForeground,
        tooltip: 'Voice message',
        icon: const Icon(Icons.mic_none),
      ),
    );
  }
}
