import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../feed_post.dart';
import 'feed_immersive_theme.dart';
import 'mention_text.dart';

typedef CommentSubmitCallback =
    Future<FeedComment> Function(String body, String? parentCommentId);
typedef CommentLikeCallback =
    Future<bool> Function(FeedComment comment, bool liked);
typedef CommentDeleteCallback = Future<void> Function(FeedComment comment);

/// Live user search for @mention autocomplete. Returns lightweight
/// (userId, displayName, handle, avatarUrl) records for the current query.
typedef CommentMentionSearch =
    Future<List<CommentMentionCandidate>> Function(String query);

/// A single @mention autocomplete suggestion.
class CommentMentionCandidate {
  const CommentMentionCandidate({
    required this.userId,
    required this.displayName,
    required this.handle,
    this.avatarUrl,
  });

  final String userId;
  final String displayName;
  final String handle;
  final String? avatarUrl;
}

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
  ValueChanged<String>? onOpenHashtag,
  ValueChanged<String>? onOpenMention,
  CommentMentionSearch? onSearchMentions,
  Future<String?> Function()? onPickGif,
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
        onOpenHashtag: onOpenHashtag,
        onOpenMention: onOpenMention,
        onSearchMentions: onSearchMentions,
        onPickGif: onPickGif,
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
    this.onOpenHashtag,
    this.onOpenMention,
    this.onSearchMentions,
    this.onPickGif,
  });

  final FeedPost post;
  final List<FeedComment> comments;
  final CommentSubmitCallback onSubmit;
  final CommentLikeCallback onToggleLike;
  final CommentDeleteCallback onDelete;
  final ValueChanged<String> onOpenUserProfile;
  final String currentUserId;

  /// Tapping a `#hashtag` in a comment. Null → tags render as plain text.
  final ValueChanged<String>? onOpenHashtag;

  /// Tapping an `@handle` in a comment. Null → mentions render as plain text.
  final ValueChanged<String>? onOpenMention;

  /// Live user search for @mention autocomplete. Null → no autocomplete.
  final CommentMentionSearch? onSearchMentions;

  /// Opens the GIF picker and returns the chosen GIF URL, or null. When null,
  /// the GIF button is hidden (no Tenor key configured).
  final Future<String?> Function()? onPickGif;

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

  // @mention autocomplete state.
  List<CommentMentionCandidate> _mentionSuggestions = const [];
  int _mentionQueryVersion = 0;

  @override
  void initState() {
    super.initState();
    if (widget.onSearchMentions != null) {
      _controller.addListener(_onComposerChanged);
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onComposerChanged);
    _controller.dispose();
    _composerFocusNode.dispose();
    super.dispose();
  }

  /// The `@…` token being typed at the caret, or null if none is active.
  String? get _activeMentionQuery {
    final selection = _controller.selection;
    if (!selection.isValid || !selection.isCollapsed) return null;
    final upToCaret = _controller.text.substring(0, selection.baseOffset);
    final match = RegExp(r'(?<![A-Za-z0-9_])@([A-Za-z0-9_.]*)$')
        .firstMatch(upToCaret);
    return match?.group(1);
  }

  Future<void> _onComposerChanged() async {
    final search = widget.onSearchMentions;
    if (search == null) return;
    final query = _activeMentionQuery;
    if (query == null || query.isEmpty) {
      if (_mentionSuggestions.isNotEmpty) {
        setState(() => _mentionSuggestions = const []);
      }
      return;
    }
    final version = ++_mentionQueryVersion;
    try {
      final results = await search(query);
      if (!mounted || version != _mentionQueryVersion) return;
      setState(() => _mentionSuggestions = results);
    } catch (_) {
      if (!mounted || version != _mentionQueryVersion) return;
      setState(() => _mentionSuggestions = const []);
    }
  }

  /// Replace the active `@…` token with the picked handle.
  void _applyMention(CommentMentionCandidate candidate) {
    final selection = _controller.selection;
    if (!selection.isValid) return;
    final text = _controller.text;
    final caret = selection.baseOffset;
    final before = text.substring(0, caret);
    final tokenMatch = RegExp(r'@([A-Za-z0-9_.]*)$').firstMatch(before);
    if (tokenMatch == null) return;
    final tokenStart = tokenMatch.start;
    final replacement = '@${candidate.handle} ';
    final nextText = text.replaceRange(tokenStart, caret, replacement);
    final nextOffset = tokenStart + replacement.length;
    _controller.value = TextEditingValue(
      text: nextText,
      selection: TextSelection.collapsed(offset: nextOffset),
    );
    setState(() => _mentionSuggestions = const []);
    _composerFocusNode.requestFocus();
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

  Future<void> _submit({String? overrideBody}) async {
    final body = overrideBody ?? _controller.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final comment = await widget.onSubmit(body, _replyingTo?.id);
      if (!mounted) return;
      setState(() {
        _comments.add(comment);
        if (overrideBody == null) _controller.clear();
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

  /// Open the GIF picker; a chosen GIF is posted as a comment whose body is the
  /// GIF URL, rendered inline (and animated) by [_CommentRow].
  Future<void> _pickGif() async {
    final pick = widget.onPickGif;
    if (pick == null || _sending) return;
    final url = await pick();
    if (url == null || url.isEmpty || !mounted) return;
    await _submit(overrideBody: url);
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
                                onOpenMention: widget.onOpenMention,
                                onOpenHashtag: widget.onOpenHashtag,
                                onReply: _beginReply,
                                onLike: _toggleLike,
                                onDelete: _delete,
                              );
                            },
                          ),
                  ),
                  if (_mentionSuggestions.isNotEmpty)
                    _MentionSuggestions(
                      candidates: _mentionSuggestions,
                      onSelected: _applyMention,
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
                    onPickGif: widget.onPickGif == null ? null : _pickGif,
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

class _CommentThread extends StatefulWidget {
  const _CommentThread({
    required this.comment,
    required this.repliesByParent,
    required this.currentUserId,
    required this.processingLikes,
    required this.onOpenUser,
    required this.onReply,
    required this.onLike,
    required this.onDelete,
    this.onOpenMention,
    this.onOpenHashtag,
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
  final ValueChanged<String>? onOpenMention;
  final ValueChanged<String>? onOpenHashtag;
  final int depth;

  @override
  State<_CommentThread> createState() => _CommentThreadState();
}

class _CommentThreadState extends State<_CommentThread> {
  // Threads start collapsed so replies stay tucked under their parent instead
  // of scattering down the list; the user expands the ones they care about.
  bool _expanded = false;

  /// Total number of replies nested under this comment (all depths).
  int get _replyCount {
    var count = 0;
    void walk(String id) {
      final replies = widget.repliesByParent[id] ?? const <FeedComment>[];
      count += replies.length;
      for (final reply in replies) {
        walk(reply.id);
      }
    }

    walk(widget.comment.id);
    return count;
  }

  @override
  Widget build(BuildContext context) {
    final replies =
        widget.repliesByParent[widget.comment.id] ?? const <FeedComment>[];
    final hasReplies = replies.isNotEmpty;
    // Indentation grows with depth but is clamped so deep chains never march
    // off-screen; past a couple of levels it holds flat.
    final indentation = (widget.depth * 22.0).clamp(0.0, 44.0);
    final totalReplies = hasReplies ? _replyCount : 0;

    return Padding(
      key: Key('comment-thread-${widget.comment.id}'),
      padding: EdgeInsets.only(left: indentation),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CommentRow(
            comment: widget.comment,
            currentUserId: widget.currentUserId,
            processingLike: widget.processingLikes.contains(widget.comment.id),
            onOpenUser: widget.onOpenUser,
            onOpenMention: widget.onOpenMention,
            onOpenHashtag: widget.onOpenHashtag,
            onReply: widget.onReply,
            onLike: widget.onLike,
            onDelete: widget.onDelete,
          ),
          if (hasReplies)
            _RepliesToggle(
              key: Key('comment-toggle-${widget.comment.id}'),
              count: totalReplies,
              expanded: _expanded,
              onTap: () => setState(() => _expanded = !_expanded),
            ),
          if (hasReplies && _expanded)
            for (final reply in replies)
              _CommentThread(
                comment: reply,
                repliesByParent: widget.repliesByParent,
                currentUserId: widget.currentUserId,
                processingLikes: widget.processingLikes,
                onOpenUser: widget.onOpenUser,
                onOpenMention: widget.onOpenMention,
                onOpenHashtag: widget.onOpenHashtag,
                onReply: widget.onReply,
                onLike: widget.onLike,
                onDelete: widget.onDelete,
                depth: widget.depth + 1,
              ),
        ],
      ),
    );
  }
}

/// The "View N replies" / "Hide replies" affordance that collapses a thread's
/// children so long conversations stay grouped rather than scattered.
class _RepliesToggle extends StatelessWidget {
  const _RepliesToggle({
    super.key,
    required this.count,
    required this.expanded,
    required this.onTap,
  });

  final int count;
  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = expanded
        ? 'Hide replies'
        : (count == 1 ? 'View 1 reply' : 'View $count replies');
    return Padding(
      padding: const EdgeInsets.only(left: 44, top: 2, bottom: 4),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 22,
              height: 1,
              color: FeedImmersiveTheme.inkSubtle,
              margin: const EdgeInsets.only(right: 8),
            ),
            Icon(
              expanded
                  ? Icons.keyboard_arrow_up_rounded
                  : Icons.keyboard_arrow_down_rounded,
              size: 16,
              color: FeedImmersiveTheme.brandPink,
            ),
            const SizedBox(width: 2),
            Text(
              label,
              style: const TextStyle(
                color: FeedImmersiveTheme.brandPink,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
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
    this.onOpenMention,
    this.onOpenHashtag,
  });

  final FeedComment comment;
  final String currentUserId;
  final bool processingLike;
  final ValueChanged<String> onOpenUser;
  final ValueChanged<FeedComment> onReply;
  final ValueChanged<FeedComment> onLike;
  final ValueChanged<FeedComment> onDelete;
  final ValueChanged<String>? onOpenMention;
  final ValueChanged<String>? onOpenHashtag;

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
                if (_isGifUrl(comment.content))
                  ClipRRect(
                    borderRadius: BorderRadius.circular(
                      FeedImmersiveTheme.radiusMd,
                    ),
                    child: Image.network(
                      comment.content.trim(),
                      width: 160,
                      fit: BoxFit.cover,
                      gaplessPlayback: true,
                      errorBuilder: (_, _, _) => const Text(
                        '[GIF]',
                        style: TextStyle(
                          color: FeedImmersiveTheme.inkMuted,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  )
                else
                  MentionText(
                    text: comment.content,
                    baseStyle: const TextStyle(
                      color: FeedImmersiveTheme.inkMuted,
                      fontSize: 13,
                      height: 1.35,
                    ),
                    linkColor: FeedImmersiveTheme.brandPink,
                    onOpenMention: onOpenMention,
                    onOpenHashtag: onOpenHashtag,
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

/// Horizontal-friendly list of @mention autocomplete suggestions shown above
/// the composer while an `@…` token is being typed.
class _MentionSuggestions extends StatelessWidget {
  const _MentionSuggestions({
    required this.candidates,
    required this.onSelected,
  });

  final List<CommentMentionCandidate> candidates;
  final ValueChanged<CommentMentionCandidate> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('comment-mention-suggestions'),
      constraints: const BoxConstraints(maxHeight: 168),
      color: FeedImmersiveTheme.surfaceElevated,
      child: ListView.builder(
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 4),
        itemCount: candidates.length,
        itemBuilder: (context, index) {
          final candidate = candidates[index];
          final name = candidate.displayName.trim();
          final initial = name.isEmpty
              ? '?'
              : name.characters.first.toUpperCase();
          final hasImage = candidate.avatarUrl?.trim().isNotEmpty == true;
          return InkWell(
            key: Key('comment-mention-${candidate.userId}'),
            onTap: () => onSelected(candidate),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    clipBehavior: Clip.antiAlias,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: FeedImmersiveTheme.brandGradient,
                    ),
                    child: hasImage
                        ? Image.network(
                            candidate.avatarUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => _Initial(initial),
                          )
                        : _Initial(initial),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          name.isEmpty ? 'Someone' : name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: FeedImmersiveTheme.ink,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '@${candidate.handle}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: FeedImmersiveTheme.brandPink,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
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
    this.onPickGif,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool sending;
  final bool emojiPickerVisible;
  final String hintText;
  final VoidCallback onToggleEmoji;
  final VoidCallback onSend;

  /// When non-null, a GIF button is shown that opens the picker.
  final VoidCallback? onPickGif;

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
        if (onPickGif != null)
          IconButton(
            key: const Key('comment-gif-button'),
            tooltip: 'Add a GIF',
            onPressed: sending ? null : onPickGif,
            color: FeedImmersiveTheme.inkMuted,
            icon: const Icon(Icons.gif_box_outlined),
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

/// A comment whose body is a single GIF URL is rendered as an inline image
/// rather than text. Matches the URLs Tenor returns from the GIF picker.
bool _isGifUrl(String content) {
  final value = content.trim();
  if (value.contains(RegExp(r'\s'))) return false;
  final lower = value.toLowerCase();
  if (!lower.startsWith('http')) return false;
  return lower.endsWith('.gif') ||
      lower.contains('tenor.com') ||
      lower.contains('.gif?') ||
      lower.contains('giphy.com');
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
