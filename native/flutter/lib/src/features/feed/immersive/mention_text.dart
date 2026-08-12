import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Renders comment/post text with tappable `@mentions` and `#hashtags`.
///
/// Mentions and tags are detected with a single regex and turned into styled,
/// tappable spans; everything else is plain text. Kept standalone (not tied to
/// the comment sheet) so posts and other surfaces can reuse the same tokenizer.
///
/// - `@handle` → [onOpenMention] with the handle (no leading `@`, lowercased).
/// - `#tag` → [onOpenHashtag] with the tag (no leading `#`).
class MentionText extends StatefulWidget {
  const MentionText({
    super.key,
    required this.text,
    required this.baseStyle,
    required this.linkColor,
    this.onOpenMention,
    this.onOpenHashtag,
  });

  final String text;
  final TextStyle baseStyle;
  final Color linkColor;
  final ValueChanged<String>? onOpenMention;
  final ValueChanged<String>? onOpenHashtag;

  /// Matches `@handle` / `#tag`. Handles allow letters, digits, underscore and
  /// dot; tags allow letters, digits and underscore. A leading boundary check
  /// avoids matching mid-word (e.g. an email's `@`).
  static final RegExp pattern = RegExp(
    r'(?<![A-Za-z0-9_])[@#][A-Za-z0-9_.]{1,30}',
  );

  @override
  State<MentionText> createState() => _MentionTextState();
}

class _MentionTextState extends State<MentionText> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    super.dispose();
  }

  void _resetRecognizers() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
  }

  @override
  Widget build(BuildContext context) {
    _resetRecognizers();

    final linkStyle = widget.baseStyle.copyWith(
      color: widget.linkColor,
      fontWeight: FontWeight.w700,
    );
    final spans = <InlineSpan>[];
    var index = 0;

    for (final match in MentionText.pattern.allMatches(widget.text)) {
      if (match.start > index) {
        spans.add(TextSpan(text: widget.text.substring(index, match.start)));
      }
      final token = match.group(0)!;
      final isMention = token.startsWith('@');
      final value = token.substring(1);
      final handler = isMention ? widget.onOpenMention : widget.onOpenHashtag;

      if (handler == null) {
        // No handler wired for this token type — render it plainly so the raw
        // text is never lost.
        spans.add(TextSpan(text: token));
      } else {
        final recognizer = TapGestureRecognizer()
          ..onTap = () =>
              handler(isMention ? value.toLowerCase() : value);
        _recognizers.add(recognizer);
        spans.add(
          TextSpan(text: token, style: linkStyle, recognizer: recognizer),
        );
      }
      index = match.end;
    }
    if (index < widget.text.length) {
      spans.add(TextSpan(text: widget.text.substring(index)));
    }

    return Text.rich(TextSpan(style: widget.baseStyle, children: spans));
  }
}
