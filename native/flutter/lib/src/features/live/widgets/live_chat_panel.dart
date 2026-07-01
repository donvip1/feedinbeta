import 'package:flutter/material.dart';

import '../data/live_models.dart';
import '../live_theme.dart';
import 'live_common.dart';

/// A normalized chat line so the panel can render both `live_stream_comments`
/// and `live_space_messages` with one widget.
class LiveChatLine {
  const LiveChatLine({
    required this.id,
    required this.body,
    this.author,
  });

  final String id;
  final String body;
  final LiveProfile? author;

  factory LiveChatLine.fromComment(LiveComment c) =>
      LiveChatLine(id: c.id, body: c.content, author: c.author);

  factory LiveChatLine.fromSpaceMessage(SpaceMessage m) =>
      LiveChatLine(id: m.id, body: m.content, author: m.author);
}

/// A scrolling chat list (newest at the bottom) rendered over a live surface,
/// mirroring the web `FlyingChat` / `SpaceChat` message list. Auto-scrolls to
/// the bottom when new lines arrive.
class LiveChatList extends StatefulWidget {
  const LiveChatList({super.key, required this.lines});

  final List<LiveChatLine> lines;

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
    return Padding(
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
