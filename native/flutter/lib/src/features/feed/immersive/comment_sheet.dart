import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import 'feed_immersive_theme.dart';

/// Presents the premium comment sheet as a keyboard-aware, spring-animated
/// modal bottom sheet with a glass surface over a dimmed barrier.
Future<void> showCommentSheet(
  BuildContext context, {
  required FeedPost post,
  required List<FeedComment> comments,
  required Future<FeedComment> Function(String body) onSubmit,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: FeedImmersiveTheme.sheetBarrier,
    sheetAnimationStyle: const AnimationStyle(
      duration: FeedImmersiveTheme.motionSheet,
      reverseDuration: FeedImmersiveTheme.motionSheetReverse,
      curve: FeedImmersiveTheme.sheetCurve,
      reverseCurve: FeedImmersiveTheme.sheetReverseCurve,
    ),
    builder: (context) =>
        CommentSheet(post: post, comments: comments, onSubmit: onSubmit),
  );
}

/// YouTube/TikTok-style comment sheet: a glass surface with a grabber, a live
/// comment count, avatar rows, and a pill composer with a circular send button.
class CommentSheet extends StatefulWidget {
  const CommentSheet({
    super.key,
    required this.post,
    required this.comments,
    required this.onSubmit,
  });

  final FeedPost post;
  final List<FeedComment> comments;
  final Future<FeedComment> Function(String body) onSubmit;

  @override
  State<CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<CommentSheet> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  late final List<FeedComment> _comments = [...widget.comments];
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  String get _countLabel {
    final n = _comments.isEmpty ? widget.post.commentsCount : _comments.length;
    return n == 1 ? '1 Comment' : '$n Comments';
  }

  Future<void> _submit() async {
    final body = _controller.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final comment = await widget.onSubmit(body);
      if (!mounted) return;
      setState(() {
        _comments.add(comment);
        _controller.clear();
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not post comment.')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxHeight =
        MediaQuery.of(context).size.height * FeedImmersiveTheme.sheetHeightFactor;
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(FeedImmersiveTheme.sheetRadius),
        ),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(
            sigmaX: FeedImmersiveTheme.blurStrong,
            sigmaY: FeedImmersiveTheme.blurStrong,
          ),
          child: Container(
            constraints: BoxConstraints(maxHeight: maxHeight),
            decoration: const BoxDecoration(
              color: FeedImmersiveTheme.glassSurfaceStrong,
              border: Border(
                top: BorderSide(color: FeedImmersiveTheme.glassBorder),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _Grabber(),
                _Header(label: _countLabel),
                Flexible(
                  child: _comments.isEmpty
                      ? const _EmptyComments()
                      : ListView.builder(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                          itemCount: _comments.length,
                          itemBuilder: (context, index) =>
                              _CommentRow(comment: _comments[index]),
                        ),
                ),
                _Composer(
                  controller: _controller,
                  sending: _sending,
                  onSend: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Grabber extends StatelessWidget {
  const _Grabber();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 10, bottom: 6),
      width: 40,
      height: 4,
      decoration: BoxDecoration(
        color: FeedImmersiveTheme.inkSubtle,
        borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 8, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: FeedImmersiveTheme.ink,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            iconSize: FeedImmersiveTheme.iconSm,
            color: FeedImmersiveTheme.inkMuted,
            icon: const Icon(Icons.close_rounded),
            tooltip: 'Close',
          ),
        ],
      ),
    );
  }
}

class _EmptyComments extends StatelessWidget {
  const _EmptyComments();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 40),
      child: Center(
        child: Text(
          'No comments yet. Start the conversation.',
          style: TextStyle(color: FeedImmersiveTheme.inkMuted, fontSize: 13),
        ),
      ),
    );
  }
}

class _CommentRow extends StatelessWidget {
  const _CommentRow({required this.comment});
  final FeedComment comment;

  @override
  Widget build(BuildContext context) {
    final name = comment.authorName.trim();
    final initial = name.isEmpty ? '?' : name.characters.first.toUpperCase();
    final hasImage = comment.avatarUrl?.trim().isNotEmpty == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: FeedImmersiveTheme.brandGradient,
            ),
            clipBehavior: Clip.antiAlias,
            child: hasImage
                ? Image.network(
                    comment.avatarUrl!,
                    fit: BoxFit.cover,
                    filterQuality: FilterQuality.medium,
                    errorBuilder: (_, _, _) => _Initial(initial),
                  )
                : _Initial(initial),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name.isEmpty ? 'Someone' : name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: FeedImmersiveTheme.ink,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _relativeCommentTime(comment.createdAtMillis),
                      style: const TextStyle(
                        color: FeedImmersiveTheme.inkSubtle,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  comment.content,
                  style: const TextStyle(
                    color: FeedImmersiveTheme.inkMuted,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Initial extends StatelessWidget {
  const _Initial(this.initial);
  final String initial;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        initial,
        style: const TextStyle(
          color: FeedImmersiveTheme.onMedia,
          fontSize: 15,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
      child: Row(
        children: [
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: FeedImmersiveTheme.sheetInputSurface,
                borderRadius:
                    BorderRadius.circular(FeedImmersiveTheme.radiusPill),
                border: Border.all(color: FeedImmersiveTheme.glassBorder),
              ),
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                style: const TextStyle(
                  color: FeedImmersiveTheme.ink,
                  fontSize: 13,
                ),
                cursorColor: FeedImmersiveTheme.brandPink,
                decoration: const InputDecoration(
                  isDense: true,
                  hintText: 'Add a comment…',
                  hintStyle: TextStyle(color: FeedImmersiveTheme.inkSubtle),
                  border: InputBorder.none,
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _SendButton(sending: sending, onSend: onSend),
        ],
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({required this.sending, required this.onSend});

  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Send comment',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: sending
            ? null
            : () {
                HapticFeedback.selectionClick();
                onSend();
              },
        child: Container(
          width: 42,
          height: 42,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: FeedImmersiveTheme.brandGradient,
            boxShadow: FeedImmersiveTheme.brandGlow,
          ),
          child: Center(
            child: sending
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: FeedImmersiveTheme.onMedia,
                    ),
                  )
                : const Icon(
                    Icons.send_rounded,
                    size: 18,
                    color: FeedImmersiveTheme.onMedia,
                  ),
          ),
        ),
      ),
    );
  }
}

String _relativeCommentTime(int createdAtMillis) {
  final created = DateTime.fromMillisecondsSinceEpoch(createdAtMillis);
  final elapsed = DateTime.now().difference(created);
  if (elapsed.inMinutes < 1) return 'now';
  if (elapsed.inHours < 1) return '${elapsed.inMinutes}m';
  if (elapsed.inDays < 1) return '${elapsed.inHours}h';
  if (elapsed.inDays < 7) return '${elapsed.inDays}d';
  return '${created.day}/${created.month}';
}
