import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import 'feed_immersive_theme.dart';

typedef CommentSubmitCallback =
    Future<FeedComment> Function(String body, String? parentCommentId);
typedef CommentLikeCallback =
    Future<bool> Function(FeedComment comment, bool liked);
typedef CommentDeleteCallback = Future<void> Function(FeedComment comment);

class FeedCommentSheetRoute<T> extends ModalBottomSheetRoute<T> {
  FeedCommentSheetRoute({
    required super.builder,
    required super.isScrollControlled,
    required super.backgroundColor,
    required super.barrierLabel,
    required super.capturedThemes,
    required super.useSafeArea,
    super.modalBarrierColor,
    super.sheetAnimationStyle,
  });
}

Future<void> showCommentSheet(
  BuildContext context, {
  required FeedPost post,
  required List<FeedComment> comments,
  required CommentSubmitCallback onSubmit,
  required CommentLikeCallback onToggleLike,
  required CommentDeleteCallback onDelete,
  required ValueChanged<String> onOpenUserProfile,
  required String currentUserId,
}) {
  final navigator = Navigator.of(context);
  final materialLocalizations = MaterialLocalizations.of(context);
  return navigator.push<void>(
    FeedCommentSheetRoute<void>(
      builder: (context) => CommentSheet(
        post: post,
        comments: comments,
        onSubmit: onSubmit,
        onToggleLike: onToggleLike,
        onDelete: onDelete,
        onOpenUserProfile: onOpenUserProfile,
        currentUserId: currentUserId,
      ),
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      modalBarrierColor: FeedImmersiveTheme.sheetBarrier,
      barrierLabel: materialLocalizations.modalBarrierDismissLabel,
      capturedThemes: InheritedTheme.capture(
        from: context,
        to: navigator.context,
      ),
      sheetAnimationStyle: const AnimationStyle(
        duration: FeedImmersiveTheme.motionSheet,
        reverseDuration: FeedImmersiveTheme.motionSheetReverse,
        curve: FeedImmersiveTheme.sheetCurve,
        reverseCurve: FeedImmersiveTheme.sheetReverseCurve,
      ),
    ),
  );
}

class CommentSheet extends StatefulWidget {
  const CommentSheet({
    super.key,
    required this.post,
    required this.comments,
    required this.onSubmit,
    required this.onToggleLike,
    required this.onDelete,
    required this.onOpenUserProfile,
    required this.currentUserId,
  });

  final FeedPost post;
  final List<FeedComment> comments;
  final CommentSubmitCallback onSubmit;
  final CommentLikeCallback onToggleLike;
  final CommentDeleteCallback onDelete;
  final ValueChanged<String> onOpenUserProfile;
  final String currentUserId;

  @override
  State<CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<CommentSheet> {
  final _controller = TextEditingController();
  final _composerFocusNode = FocusNode();
  late final List<FeedComment> _comments = [...widget.comments];
  final Set<String> _processingLikes = <String>{};
  bool _sending = false;
  bool _emojiPickerVisible = false;
  FeedComment? _replyingTo;

  @override
  void dispose() {
    _controller.dispose();
    _composerFocusNode.dispose();
    super.dispose();
  }

  List<FeedComment> get _rootComments =>
      _comments
          .where((comment) => comment.parentCommentId == null)
          .toList(growable: false)
        ..sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));

  Map<String, List<FeedComment>> get _repliesByParent {
    final result = <String, List<FeedComment>>{};
    for (final comment in _comments) {
      final parentId = comment.parentCommentId;
      if (parentId == null) continue;
      result.putIfAbsent(parentId, () => <FeedComment>[]).add(comment);
    }
    for (final replies in result.values) {
      replies.sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));
    }
    return result;
  }

  String get _countLabel {
    final n = _rootComments.isEmpty
        ? widget.post.commentsCount
        : _rootComments.length;
    return n == 1 ? '1 Comment' : '$n Comments';
  }

  void _beginReply(FeedComment comment) {
    setState(() {
      _replyingTo = comment;
      _emojiPickerVisible = false;
    });
    _composerFocusNode.requestFocus();
  }

  void _insertEmoji(String emoji) {
    final value = _controller.value;
    final selection = value.selection.isValid
        ? value.selection
        : TextSelection.collapsed(offset: value.text.length);
    final nextText = value.text.replaceRange(
      selection.start,
      selection.end,
      emoji,
    );
    final nextOffset = selection.start + emoji.length;
    _controller.value = TextEditingValue(
      text: nextText,
      selection: TextSelection.collapsed(offset: nextOffset),
    );
    _composerFocusNode.requestFocus();
  }

  Set<String> _descendantIds(String commentId) {
    final descendants = <String>{commentId};
    var changed = true;
    while (changed) {
      changed = false;
      for (final comment in _comments) {
        final parentId = comment.parentCommentId;
        if (parentId != null && descendants.contains(parentId)) {
          changed = descendants.add(comment.id) || changed;
        }
      }
    }
    return descendants;
  }

  String _safeCommentError(Object error) {
    final message = error.toString().toLowerCase();
    if (message.contains('sign in') || message.contains('jwt')) {
      return 'Sign in again to post a comment.';
    }
    if (message.contains('reply parent')) {
      return 'That reply target is no longer available.';
    }
    if (message.contains('permission') || message.contains('row-level')) {
      return 'You do not have permission to post this comment.';
    }
    if (message.contains('network') || message.contains('socket')) {
      return 'Check your connection and try again.';
    }
    return 'Could not post comment. Please try again.';
  }

  Future<void> _submit() async {
    final body = _controller.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final comment = await widget.onSubmit(body, _replyingTo?.id);
      if (!mounted) return;
      setState(() {
        _comments.add(comment);
        _controller.clear();
        _replyingTo = null;
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_safeCommentError(error))));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _toggleLike(FeedComment comment) async {
    if (_processingLikes.contains(comment.id)) return;
    final index = _comments.indexWhere((item) => item.id == comment.id);
    if (index < 0) return;
    final wasLiked = comment.viewerHasLiked;
    final optimistic = comment.copyWith(
      viewerHasLiked: !wasLiked,
      likesCount: (comment.likesCount + (wasLiked ? -1 : 1)).clamp(0, 1 << 30),
    );
    setState(() {
      _processingLikes.add(comment.id);
      _comments[index] = optimistic;
    });
    try {
      final nowLiked = await widget.onToggleLike(comment, wasLiked);
      if (!mounted) return;
      final latestIndex = _comments.indexWhere((item) => item.id == comment.id);
      if (latestIndex < 0) return;
      setState(() {
        _comments[latestIndex] = _comments[latestIndex].copyWith(
          viewerHasLiked: nowLiked,
        );
      });
    } catch (_) {
      if (!mounted) return;
      final latestIndex = _comments.indexWhere((item) => item.id == comment.id);
      if (latestIndex >= 0) setState(() => _comments[latestIndex] = comment);
    } finally {
      if (mounted) setState(() => _processingLikes.remove(comment.id));
    }
  }

  Future<void> _delete(FeedComment comment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete comment?'),
        content: const Text('This comment and its replies will be removed.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await widget.onDelete(comment);
      if (!mounted) return;
      final removedIds = _descendantIds(comment.id);
      setState(() {
        _comments.removeWhere((item) => removedIds.contains(item.id));
        if (_replyingTo case final reply?) {
          if (removedIds.contains(reply.id)) _replyingTo = null;
        }
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete comment.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: DraggableScrollableSheet(
        initialChildSize: 0.42,
        minChildSize: 0.25,
        maxChildSize: keyboardInset > 0 ? 0.8 : 0.72,
        expand: false,
        snap: true,
        snapSizes: const [0.42, 0.72],
        builder: (context, scrollController) => ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(FeedImmersiveTheme.sheetRadius),
          ),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(
              sigmaX: FeedImmersiveTheme.blurStrong,
              sigmaY: FeedImmersiveTheme.blurStrong,
            ),
            child: DecoratedBox(
              decoration: const BoxDecoration(
                color: FeedImmersiveTheme.glassSurfaceStrong,
                border: Border(
                  top: BorderSide(color: FeedImmersiveTheme.glassBorder),
                ),
              ),
              child: Column(
                children: [
                  const _Grabber(),
                  _Header(label: _countLabel),
                  Expanded(
                    child: _rootComments.isEmpty
                        ? const _EmptyComments()
                        : ListView.builder(
                            controller: scrollController,
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                            itemCount: _rootComments.length,
                            itemBuilder: (context, index) {
                              final comment = _rootComments[index];
                              return _CommentThread(
                                comment: comment,
                                repliesByParent: _repliesByParent,
                                currentUserId: widget.currentUserId,
                                processingLikes: _processingLikes,
                                onOpenUser: widget.onOpenUserProfile,
                                onReply: _beginReply,
                                onLike: _toggleLike,
                                onDelete: _delete,
                              );
                            },
                          ),
                  ),
                  if (_replyingTo case final reply?)
                    _ReplyBanner(
                      comment: reply,
                      onCancel: () => setState(() => _replyingTo = null),
                    ),
                  if (_emojiPickerVisible)
                    _EmojiPicker(
                      onSelected: _insertEmoji,
                      onClose: () =>
                          setState(() => _emojiPickerVisible = false),
                    ),
                  _Composer(
                    controller: _controller,
                    focusNode: _composerFocusNode,
                    sending: _sending,
                    emojiPickerVisible: _emojiPickerVisible,
                    hintText: _replyingTo == null
                        ? 'Add a comment…'
                        : 'Reply to ${_replyingTo!.authorName}…',
                    onToggleEmoji: () => setState(
                      () => _emojiPickerVisible = !_emojiPickerVisible,
                    ),
                    onSend: _submit,
                  ),
                ],
              ),
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
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 10, bottom: 6),
    width: 40,
    height: 4,
    decoration: BoxDecoration(
      color: FeedImmersiveTheme.inkSubtle,
      borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
    ),
  );
}

class _Header extends StatelessWidget {
  const _Header({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
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

class _EmptyComments extends StatelessWidget {
  const _EmptyComments();

  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.symmetric(vertical: 32),
      child: Text(
        'No comments yet. Start the conversation.',
        style: TextStyle(color: FeedImmersiveTheme.inkMuted, fontSize: 13),
      ),
    ),
  );
}

class _CommentThread extends StatelessWidget {
  const _CommentThread({
    required this.comment,
    required this.repliesByParent,
    required this.currentUserId,
    required this.processingLikes,
    required this.onOpenUser,
    required this.onReply,
    required this.onLike,
    required this.onDelete,
    this.depth = 0,
  });

  final FeedComment comment;
  final Map<String, List<FeedComment>> repliesByParent;
  final String currentUserId;
  final Set<String> processingLikes;
  final ValueChanged<String> onOpenUser;
  final ValueChanged<FeedComment> onReply;
  final ValueChanged<FeedComment> onLike;
  final ValueChanged<FeedComment> onDelete;
  final int depth;

  @override
  Widget build(BuildContext context) {
    final replies = repliesByParent[comment.id] ?? const <FeedComment>[];
    final indentation = (depth * 26.0).clamp(0.0, 78.0);
    return Padding(
      key: Key('comment-thread-${comment.id}'),
      padding: EdgeInsets.only(left: indentation),
      child: Column(
        children: [
          _CommentRow(
            comment: comment,
            currentUserId: currentUserId,
            processingLike: processingLikes.contains(comment.id),
            onOpenUser: onOpenUser,
            onReply: onReply,
            onLike: onLike,
            onDelete: onDelete,
          ),
          for (final reply in replies)
            _CommentThread(
              comment: reply,
              repliesByParent: repliesByParent,
              currentUserId: currentUserId,
              processingLikes: processingLikes,
              onOpenUser: onOpenUser,
              onReply: onReply,
              onLike: onLike,
              onDelete: onDelete,
              depth: depth + 1,
            ),
        ],
      ),
    );
  }
}

class _CommentRow extends StatelessWidget {
  const _CommentRow({
    required this.comment,
    required this.currentUserId,
    required this.processingLike,
    required this.onOpenUser,
    required this.onReply,
    required this.onLike,
    required this.onDelete,
  });

  final FeedComment comment;
  final String currentUserId;
  final bool processingLike;
  final ValueChanged<String> onOpenUser;
  final ValueChanged<FeedComment> onReply;
  final ValueChanged<FeedComment> onLike;
  final ValueChanged<FeedComment> onDelete;

  @override
  Widget build(BuildContext context) {
    final name = comment.authorName.trim();
    final initial = name.isEmpty ? '?' : name.characters.first.toUpperCase();
    final hasImage = comment.avatarUrl?.trim().isNotEmpty == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () => onOpenUser(comment.userId),
            child: Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: FeedImmersiveTheme.brandGradient,
              ),
              clipBehavior: Clip.antiAlias,
              child: hasImage
                  ? Image.network(
                      comment.avatarUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _Initial(initial),
                    )
                  : _Initial(initial),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: () => onOpenUser(comment.userId),
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
                const SizedBox(height: 2),
                Text(
                  comment.content,
                  style: const TextStyle(
                    color: FeedImmersiveTheme.inkMuted,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Text(
                      _relativeCommentTime(comment.createdAtMillis),
                      style: const TextStyle(
                        color: FeedImmersiveTheme.inkSubtle,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(width: 14),
                    GestureDetector(
                      key: Key('comment-reply-${comment.id}'),
                      behavior: HitTestBehavior.opaque,
                      onTap: () => onReply(comment),
                      child: const Text(
                        'Reply',
                        style: TextStyle(
                          color: FeedImmersiveTheme.inkMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (comment.userId == currentUserId) ...[
                      const SizedBox(width: 14),
                      GestureDetector(
                        onTap: () => onDelete(comment),
                        child: const Text(
                          'Delete',
                          style: TextStyle(
                            color: FeedImmersiveTheme.error,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            key: Key('comment-like-${comment.id}'),
            onTap: processingLike ? null : () => onLike(comment),
            borderRadius: BorderRadius.circular(20),
            child: Padding(
              padding: const EdgeInsets.all(5),
              child: Column(
                children: [
                  Icon(
                    comment.viewerHasLiked
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    size: 17,
                    color: comment.viewerHasLiked
                        ? FeedImmersiveTheme.likeActive
                        : FeedImmersiveTheme.inkSubtle,
                  ),
                  if (comment.likesCount > 0)
                    Text(
                      '${comment.likesCount}',
                      style: const TextStyle(
                        color: FeedImmersiveTheme.inkSubtle,
                        fontSize: 10,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReplyBanner extends StatelessWidget {
  const _ReplyBanner({required this.comment, required this.onCancel});
  final FeedComment comment;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) => Container(
    color: FeedImmersiveTheme.surfaceElevated,
    padding: const EdgeInsets.fromLTRB(16, 7, 8, 7),
    child: Row(
      children: [
        Expanded(
          child: Text(
            'Replying to ${comment.authorName}',
            style: const TextStyle(
              color: FeedImmersiveTheme.inkMuted,
              fontSize: 12,
            ),
          ),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          onPressed: onCancel,
          icon: const Icon(
            Icons.close_rounded,
            size: 17,
            color: FeedImmersiveTheme.inkMuted,
          ),
        ),
      ],
    ),
  );
}

class _Initial extends StatelessWidget {
  const _Initial(this.initial);
  final String initial;

  @override
  Widget build(BuildContext context) => Center(
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

class _EmojiPicker extends StatelessWidget {
  const _EmojiPicker({required this.onSelected, required this.onClose});

  static const emojis = <String>[
    '😀',
    '😂',
    '😍',
    '🥰',
    '😎',
    '😭',
    '😡',
    '🤔',
    '👍',
    '👏',
    '🙏',
    '🔥',
    '❤️',
    '🎉',
    '💯',
    '✨',
  ];

  final ValueChanged<String> onSelected;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('comment-emoji-picker'),
    padding: const EdgeInsets.fromLTRB(16, 8, 8, 4),
    color: FeedImmersiveTheme.surfaceElevated,
    child: Row(
      children: [
        Expanded(
          child: Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              for (final emoji in emojis)
                InkWell(
                  key: Key('comment-emoji-$emoji'),
                  onTap: () => onSelected(emoji),
                  borderRadius: BorderRadius.circular(18),
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: Text(emoji, style: const TextStyle(fontSize: 21)),
                  ),
                ),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Close emoji picker',
          onPressed: onClose,
          icon: const Icon(
            Icons.close_rounded,
            color: FeedImmersiveTheme.inkMuted,
          ),
        ),
      ],
    ),
  );
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.focusNode,
    required this.sending,
    required this.emojiPickerVisible,
    required this.hintText,
    required this.onToggleEmoji,
    required this.onSend,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool sending;
  final bool emojiPickerVisible;
  final String hintText;
  final VoidCallback onToggleEmoji;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
    child: Row(
      children: [
        IconButton(
          key: const Key('comment-emoji-button'),
          tooltip: 'Add emoji',
          onPressed: onToggleEmoji,
          color: emojiPickerVisible
              ? FeedImmersiveTheme.brandPink
              : FeedImmersiveTheme.inkMuted,
          icon: const Icon(Icons.emoji_emotions_outlined),
        ),
        Expanded(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: FeedImmersiveTheme.sheetInputSurface,
              borderRadius: BorderRadius.circular(
                FeedImmersiveTheme.radiusPill,
              ),
              border: Border.all(color: FeedImmersiveTheme.glassBorder),
            ),
            child: TextField(
              key: const Key('comment-composer'),
              controller: controller,
              focusNode: focusNode,
              minLines: 1,
              maxLines: 3,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              style: const TextStyle(
                color: FeedImmersiveTheme.ink,
                fontSize: 13,
              ),
              cursorColor: FeedImmersiveTheme.brandPink,
              decoration: InputDecoration(
                isDense: true,
                hintText: hintText,
                hintStyle: const TextStyle(color: FeedImmersiveTheme.inkSubtle),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Semantics(
          button: true,
          label: 'Send comment',
          child: GestureDetector(
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
        ),
      ],
    ),
  );
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
