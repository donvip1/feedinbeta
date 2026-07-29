import 'package:flutter/material.dart';

import '../feed_post.dart';
import 'feed_immersive_theme.dart';

enum RefeedAction { refeed, undoRefeed, quoteRefeed }

Future<RefeedAction?> showRefeedActionSheet(
  BuildContext context, {
  required bool isRefeeded,
}) {
  return showModalBottomSheet<RefeedAction>(
    context: context,
    backgroundColor: FeedImmersiveTheme.surface,
    barrierColor: Colors.black54,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) => Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: FeedImmersiveTheme.inkSubtle,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(height: 12),
          ListTile(
            leading: Icon(
              isRefeeded ? Icons.undo_rounded : Icons.repeat_rounded,
              color: FeedImmersiveTheme.refeedActive,
            ),
            title: Text(
              isRefeeded ? 'Undo Refeed' : 'Refeed',
              style: const TextStyle(
                color: FeedImmersiveTheme.ink,
                fontWeight: FontWeight.w800,
              ),
            ),
            subtitle: Text(
              isRefeeded
                  ? 'Remove this post from your feed.'
                  : 'Share this post with your followers.',
              style: const TextStyle(color: FeedImmersiveTheme.inkMuted),
            ),
            onTap: () => Navigator.of(
              sheetContext,
            ).pop(isRefeeded ? RefeedAction.undoRefeed : RefeedAction.refeed),
          ),
          ListTile(
            leading: const Icon(
              Icons.format_quote_rounded,
              color: FeedImmersiveTheme.brandPink,
            ),
            title: const Text(
              'Quote Refeed',
              style: TextStyle(
                color: FeedImmersiveTheme.ink,
                fontWeight: FontWeight.w800,
              ),
            ),
            subtitle: const Text(
              'Add your thoughts before sharing.',
              style: TextStyle(color: FeedImmersiveTheme.inkMuted),
            ),
            onTap: () =>
                Navigator.of(sheetContext).pop(RefeedAction.quoteRefeed),
          ),
        ],
      ),
    ),
  );
}

Future<String?> showQuoteRefeedComposer(
  BuildContext context, {
  required FeedPost post,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black54,
    useSafeArea: true,
    builder: (_) => _QuoteRefeedComposer(post: post.displayedPost),
  );
}

class _QuoteRefeedComposer extends StatefulWidget {
  const _QuoteRefeedComposer({required this.post});

  final FeedPost post;

  @override
  State<_QuoteRefeedComposer> createState() => _QuoteRefeedComposerState();
}

class _QuoteRefeedComposerState extends State<_QuoteRefeedComposer> {
  final TextEditingController _controller = TextEditingController();
  bool _canSubmit = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_handleChanged);
  }

  void _handleChanged() {
    final canSubmit = _controller.text.trim().isNotEmpty;
    if (canSubmit == _canSubmit) return;
    setState(() => _canSubmit = canSubmit);
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_handleChanged)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    final authorHandle = widget.post.authorHandle;
    return AnimatedPadding(
      duration: FeedImmersiveTheme.motionFast,
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: DecoratedBox(
        decoration: const BoxDecoration(
          color: FeedImmersiveTheme.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  IconButton(
                    tooltip: 'Close',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(
                      Icons.close_rounded,
                      color: FeedImmersiveTheme.ink,
                    ),
                  ),
                  const Expanded(
                    child: Text(
                      'Quote Refeed',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: FeedImmersiveTheme.ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _canSubmit
                        ? () =>
                              Navigator.of(context).pop(_controller.text.trim())
                        : null,
                    child: const Text('Post'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                key: const Key('quote-refeed-field'),
                controller: _controller,
                autofocus: true,
                minLines: 3,
                maxLines: 6,
                maxLength: 500,
                style: const TextStyle(color: FeedImmersiveTheme.ink),
                decoration: InputDecoration(
                  hintText: 'Add your thoughts...',
                  hintStyle: const TextStyle(
                    color: FeedImmersiveTheme.inkSubtle,
                  ),
                  filled: true,
                  fillColor: FeedImmersiveTheme.surfaceElevated,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(
                      color: FeedImmersiveTheme.divider,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(
                      color: FeedImmersiveTheme.brandPink,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: FeedImmersiveTheme.surfaceElevated,
                  border: Border.all(color: FeedImmersiveTheme.divider),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.post.authorName,
                        style: const TextStyle(
                          color: FeedImmersiveTheme.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (authorHandle != null && authorHandle.isNotEmpty)
                        Text(
                          authorHandle,
                          style: const TextStyle(
                            color: FeedImmersiveTheme.inkMuted,
                          ),
                        ),
                      if (widget.post.body.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          widget.post.body.trim(),
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: FeedImmersiveTheme.inkMuted,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
