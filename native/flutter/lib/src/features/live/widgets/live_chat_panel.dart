import 'package:flutter/material.dart';

import '../data/live_models.dart';
import '../live_theme.dart';
import 'live_common.dart';

/// A normalized chat line so the panel can render both `live_stream_comments`
/// and `live_space_messages` with one widget.
class LiveChatLine {
  const LiveChatLine({
    required this.id,
    required this.userId,
    required this.body,
    this.author,
    this.pending = false,
  });

  final String id;
  final String userId;
  final String body;
  final LiveProfile? author;

  /// True for an optimistic line awaiting its realtime echo (rendered slightly
  /// dimmed). Reconciled by [LiveChatBuffer.addRealtime].
  final bool pending;

  factory LiveChatLine.fromComment(LiveComment c) => LiveChatLine(
    id: c.id,
    userId: c.userId,
    body: c.content,
    author: c.author,
  );

  factory LiveChatLine.fromSpaceMessage(SpaceMessage m) => LiveChatLine(
    id: m.id,
    userId: m.userId,
    body: m.content,
    author: m.author,
  );

  LiveChatLine copyWith({LiveProfile? author, bool? pending, String? id}) {
    return LiveChatLine(
      id: id ?? this.id,
      userId: userId,
      body: body,
      author: author ?? this.author,
      pending: pending ?? this.pending,
    );
  }
}

/// Ordered, de-duplicated chat backing list shared by the stream viewer and the
/// space room. Reconciles three sources into one stable timeline:
///   * the initial fetch (authoritative, carries embedded authors),
///   * realtime INSERT echoes (no embedded author — hydrated separately), and
///   * optimistic local lines (shown instantly, upgraded on their echo).
class LiveChatBuffer {
  final List<LiveChatLine> _lines = [];

  List<LiveChatLine> get lines => List.unmodifiable(_lines);

  /// Replace the timeline from a full fetch, but carry forward any lines the
  /// fetch does not already contain: still-pending optimistic sends, and
  /// realtime echoes that landed during the bootstrap race (after the fetch
  /// query ran but before its result was applied). Carried lines are appended
  /// after the fetched history, preserving chronological order.
  void replaceAll(Iterable<LiveChatLine> next) {
    final incoming = next.toList();
    final incomingIds = {for (final l in incoming) l.id};
    final carried = [
      for (final line in _lines)
        if (line.pending || !incomingIds.contains(line.id)) line,
    ];
    _lines
      ..clear()
      ..addAll(incoming);
    for (final line in carried) {
      if (line.pending) {
        if (!incoming.any((l) => _matchesPending(line, l))) _lines.add(line);
      } else {
        _lines.add(line);
      }
    }
  }

  /// Append an optimistic line immediately (before the server round-trip).
  void addOptimistic(LiveChatLine line) => _lines.add(line);

  /// Merge a realtime echo: drop duplicates by id, and upgrade a matching
  /// optimistic line in place so the sender never sees their message twice.
  void addRealtime(LiveChatLine line) {
    if (_lines.any((l) => l.id == line.id)) return;
    final idx = _lines.indexWhere((l) => _matchesPending(l, line));
    if (idx != -1) {
      _lines[idx] = line.copyWith(author: line.author ?? _lines[idx].author);
      return;
    }
    _lines.add(line);
  }

  /// Fill in authors for lines whose author is still null, from a resolved
  /// id→profile map (realtime rows arrive without an embedded profile).
  bool hydrateAuthors(Map<String, LiveProfile> profiles) {
    var changed = false;
    for (var i = 0; i < _lines.length; i++) {
      final line = _lines[i];
      if (line.author == null) {
        final resolved = profiles[line.userId];
        if (resolved != null) {
          _lines[i] = line.copyWith(author: resolved);
          changed = true;
        }
      }
    }
    return changed;
  }

  /// User ids on lines that still have no author, for a batch profile fetch.
  Set<String> get unresolvedAuthorIds => {
    for (final line in _lines)
      if (line.author == null && line.userId.isNotEmpty) line.userId,
  };

  static bool _matchesPending(LiveChatLine existing, LiveChatLine incoming) =>
      existing.pending &&
      existing.userId == incoming.userId &&
      existing.body == incoming.body;
}

/// A scrolling chat list (newest at the bottom) rendered over a live surface,
/// mirroring the web `FlyingChat` / `SpaceChat` message list. Auto-scrolls to
/// the bottom when new lines arrive.
class LiveChatList extends StatefulWidget {
  const LiveChatList({super.key, required this.lines, this.loading = false});

  final List<LiveChatLine> lines;

  /// While true (initial fetch in flight) the empty-state hint is suppressed so
  /// it does not flash before the first messages land.
  final bool loading;

  @override
  State<LiveChatList> createState() => _LiveChatListState();
}

class _LiveChatListState extends State<LiveChatList> {
  final _scrollController = ScrollController();

  @override
  void didUpdateWidget(covariant LiveChatList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.lines.length != oldWidget.lines.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    }
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.lines.isEmpty) {
      if (widget.loading) return const SizedBox.shrink();
      return const Align(
        alignment: Alignment.bottomLeft,
        child: Padding(
          padding: EdgeInsets.only(left: 4, bottom: 4),
          child: Text(
            'Be the first to say something',
            style: TextStyle(
              color: LiveTheme.onSurfaceFaint,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      );
    }
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.only(top: 8),
      itemCount: widget.lines.length,
      itemBuilder: (context, index) => _ChatRow(line: widget.lines[index]),
    );
  }
}

class _ChatRow extends StatelessWidget {
  const _ChatRow({required this.line});

  final LiveChatLine line;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: line.pending ? 0.6 : 1,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LiveAvatar(profile: line.author, size: 26),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    line.author?.label ?? 'feedIn user',
                    style: LiveTheme.chatName,
                  ),
                  const SizedBox(height: 1),
                  Text(line.body, style: LiveTheme.chatBody),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The chat composer row (text field + send). Used by the stream viewer and the
/// space room. Calls [onSend] with the trimmed body and clears the field.
class LiveChatComposer extends StatefulWidget {
  const LiveChatComposer({
    super.key,
    required this.onSend,
    this.hintText = 'Say something...',
    this.accent = LiveTheme.brandPink,
  });

  final ValueChanged<String> onSend;
  final String hintText;
  final Color accent;

  @override
  State<LiveChatComposer> createState() => _LiveChatComposerState();
}

class _LiveChatComposerState extends State<LiveChatComposer> {
  final _controller = TextEditingController();
  bool _canSend = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final next = _controller.text.trim().isNotEmpty;
      if (next != _canSend) setState(() => _canSend = next);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final body = _controller.text.trim();
    if (body.isEmpty) return;
    widget.onSend(body);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: LiveTheme.glassSurface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: LiveTheme.chipBorder),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _controller,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _submit(),
              style: const TextStyle(color: LiveTheme.onSurface, fontSize: 14),
              cursorColor: widget.accent,
              decoration: InputDecoration(
                hintText: widget.hintText,
                hintStyle: const TextStyle(color: LiveTheme.onSurfaceFaint),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: _canSend ? _submit : null,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _canSend ? widget.accent : LiveTheme.surfaceRaised,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.send_rounded,
              size: 20,
              color: _canSend ? Colors.white : LiveTheme.onSurfaceFaint,
            ),
          ),
        ),
      ],
    );
  }
}
