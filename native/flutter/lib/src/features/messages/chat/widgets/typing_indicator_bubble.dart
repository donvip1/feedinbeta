import 'package:flutter/material.dart';

import '../chat_theme.dart';
import '../chat_view_models.dart';

/// In-thread "is typing…" bubble, ported from the web `TypingIndicator`
/// (src/components/messages/TypingIndicator.tsx) as rendered at the foot of the
/// message list in `ModernChatInterface`.
///
/// Layout mirrors the web non-compact variant: an activity glyph, three bouncing
/// dots staggered by 150ms, and a trailing "{name} is typing…" caption, all on a
/// rounded `bg-muted/80` pill with a soft border. The glyph + dot colour follow
/// the activity (typing → primary, recording → red, etc.) exactly like
/// `getActivityColor`.
///
/// Purely presentational: it animates on its own ticker but never reads presence
/// — the parent decides when to mount it (typically gated on a live activity
/// signal). Returns an empty box for [ChatActivity.none] so callers can mount it
/// unconditionally if convenient.
class TypingIndicatorBubble extends StatefulWidget {
  const TypingIndicatorBubble({
    super.key,
    required this.activity,
    this.userName,
  });

  /// The other participant's live activity. [ChatActivity.none] renders nothing.
  final ChatActivity activity;

  /// First name of the other participant (prefixes the caption when present).
  final String? userName;

  @override
  State<TypingIndicatorBubble> createState() => _TypingIndicatorBubbleState();
}

class _TypingIndicatorBubbleState extends State<TypingIndicatorBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.activity == ChatActivity.none) {
      return const SizedBox.shrink();
    }

    final color = _activityColor(widget.activity);
    final caption = _caption();

    return Padding(
      padding: const EdgeInsets.fromLTRB(ChatSpacing.lg, 0, ChatSpacing.lg, 6),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: ChatSpacing.lg,
            vertical: ChatSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: ChatColors.muted,
            borderRadius: const BorderRadius.all(
              Radius.circular(ChatRadii.bubbleRadius),
            ),
            border: Border.all(color: ChatColors.incomingBubbleBorderSoft),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(_activityIcon(widget.activity), size: 14, color: color),
              const SizedBox(width: ChatSpacing.sm),
              _BouncingDots(controller: _controller, color: color),
              if (caption.isNotEmpty) ...[
                const SizedBox(width: ChatSpacing.sm),
                Flexible(
                  child: Text(
                    caption,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: ChatColors.mutedForeground,
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

  String _caption() {
    final text = chatActivityText(widget.activity);
    final name = widget.userName?.trim();
    if (name == null || name.isEmpty) return text;
    return '$name $text';
  }

  static Color _activityColor(ChatActivity activity) {
    switch (activity) {
      case ChatActivity.emoji:
        return ChatColors.amberWarning;
      case ChatActivity.sticker:
        return ChatColors.primary;
      case ChatActivity.voiceRecording:
        return ChatColors.recording;
      case ChatActivity.uploadingImage:
        return ChatColors.activeNow;
      case ChatActivity.uploadingVideo:
        return ChatColors.accent;
      case ChatActivity.uploadingFile:
        return ChatColors.amberWarning;
      case ChatActivity.focused:
        return ChatColors.online;
      case ChatActivity.typing:
      case ChatActivity.none:
        return ChatColors.primary;
    }
  }

  static IconData _activityIcon(ChatActivity activity) {
    switch (activity) {
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
      case ChatActivity.focused:
        return Icons.chat_bubble_outline;
      case ChatActivity.typing:
      case ChatActivity.none:
        return Icons.edit_outlined;
    }
  }
}

/// Three dots that bounce in a staggered loop (web `animate-bounce` with 0 /
/// 150 / 300ms delays).
class _BouncingDots extends StatelessWidget {
  const _BouncingDots({required this.controller, required this.color});

  final AnimationController controller;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 3),
          _Dot(controller: controller, color: color, phase: i / 3),
        ],
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({
    required this.controller,
    required this.color,
    required this.phase,
  });

  final AnimationController controller;
  final Color color;

  /// 0..1 offset into the shared loop so the three dots bounce out of step.
  final double phase;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        final t = (controller.value + phase) % 1.0;
        // A single up-down hop in the first half of each dot's cycle.
        final hop = t < 0.5 ? Curves.easeOut.transform(t * 2) : 0.0;
        final lift = -3.0 * hop;
        final opacity = 0.45 + 0.55 * hop;
        return Transform.translate(
          offset: Offset(0, lift),
          child: Opacity(opacity: opacity, child: child),
        );
      },
      child: Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
    );
  }
}
