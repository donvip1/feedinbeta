import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';

/// Caption rendered over immersive media. Collapses to [collapsedLines] with an
/// ellipsis and reveals a tappable "more"/"less" toggle only when the text
/// actually overflows. #hashtags and @mentions are highlighted in [linkColor].
///
/// Mirrors the behavior of the React `CaptionText` (hashtag/mention coloring and
/// a more/less toggle) but detects overflow natively via [TextPainter].
class ExpandableCaption extends StatefulWidget {
  const ExpandableCaption({
    super.key,
    required this.text,
    this.collapsedLines = 2,
    this.linkColor,
  });

  final String text;
  final int collapsedLines;
  final Color? linkColor;

  @override
  State<ExpandableCaption> createState() => _ExpandableCaptionState();
}

class _ExpandableCaptionState extends State<ExpandableCaption> {
  bool _expanded = false;

  @override
  void didUpdateWidget(covariant ExpandableCaption oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Reset to the collapsed state when the caption content changes.
    if (oldWidget.text != widget.text) {
      _expanded = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.text;
    if (text.trim().isEmpty) {
      return const SizedBox.shrink();
    }

    final linkColor = widget.linkColor ?? FeedImmersiveTheme.brandPink;
    final baseStyle = _baseStyle(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;

        // Lay the full text out unconstrained-by-lines to see if it would
        // exceed the collapsed line count at this width.
        final painter = TextPainter(
          text: TextSpan(text: text, style: baseStyle),
          maxLines: widget.collapsedLines,
          textDirection: Directionality.of(context),
          ellipsis: '…',
        )..layout(maxWidth: maxWidth);

        final overflows = painter.didExceedMaxLines;
        final showToggle = overflows;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Smoothly grow/shrink between collapsed and expanded heights.
            AnimatedSize(
              duration: FeedImmersiveTheme.motionCaption,
              curve: FeedImmersiveTheme.premiumSettleCurve,
              alignment: Alignment.topLeft,
              child: RichText(
                maxLines: _expanded ? null : widget.collapsedLines,
                overflow: _expanded ? TextOverflow.clip : TextOverflow.ellipsis,
                text: TextSpan(
                  style: baseStyle,
                  children: _buildSpans(text, baseStyle, linkColor),
                ),
              ),
            ),
            if (showToggle)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: _MoreLessPill(
                  expanded: _expanded,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    setState(() => _expanded = !_expanded);
                  },
                ),
              ),
          ],
        );
      },
    );
  }

  TextStyle _baseStyle(BuildContext context) {
    // Prefer the theme's caption style; ensure white + legibility shadow.
    final captionStyle = FeedImmersiveTheme.caption;
    return captionStyle.copyWith(
      color: captionStyle.color ?? FeedImmersiveTheme.onMedia,
      shadows: captionStyle.shadows ?? FeedImmersiveTheme.textShadow,
    );
  }

  /// Splits [text] into plain runs and highlighted #hashtag / @mention runs.
  List<InlineSpan> _buildSpans(
    String text,
    TextStyle baseStyle,
    Color linkColor,
  ) {
    final spans = <InlineSpan>[];
    // Capture hashtags and mentions as discrete tokens, keeping all other text.
    final pattern = RegExp(r'([#@][\w]+)');
    int start = 0;

    for (final match in pattern.allMatches(text)) {
      if (match.start > start) {
        spans.add(TextSpan(text: text.substring(start, match.start)));
      }
      final token = match.group(0)!;
      spans.add(
        TextSpan(
          text: token,
          // Visually highlighted; tapping is a no-op for now (no recognizer,
          // so taps fall through to the parent gesture handler).
          style: baseStyle.copyWith(
            color: linkColor,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
      start = match.end;
    }

    if (start < text.length) {
      spans.add(TextSpan(text: text.substring(start)));
    }

    return spans;
  }
}

/// Pill-shaped "MORE"/"LESS" toggle mirroring the web app's rounded black chip.
/// Animates a chevron rotation and gives a brief press scale for tactility.
class _MoreLessPill extends StatefulWidget {
  const _MoreLessPill({required this.expanded, required this.onTap});

  final bool expanded;
  final VoidCallback onTap;

  @override
  State<_MoreLessPill> createState() => _MoreLessPillState();
}

class _MoreLessPillState extends State<_MoreLessPill> {
  bool _held = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.expanded ? 'Collapse caption' : 'Expand caption',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _held = true),
        onTapUp: (_) => setState(() => _held = false),
        onTapCancel: () => setState(() => _held = false),
        child: AnimatedScale(
          scale: _held ? 0.94 : 1.0,
          duration: FeedImmersiveTheme.motionPress,
          curve: FeedImmersiveTheme.premiumSettleCurve,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusPill),
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(
                sigmaX: FeedImmersiveTheme.blurPill,
                sigmaY: FeedImmersiveTheme.blurPill,
              ),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: FeedImmersiveTheme.pillBackground,
                  borderRadius: BorderRadius.circular(
                    FeedImmersiveTheme.radiusPill,
                  ),
                  border: Border.all(color: FeedImmersiveTheme.glassBorder),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 5, 8, 5),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.expanded ? 'LESS' : 'MORE',
                        style: FeedImmersiveTheme.pillLabel,
                      ),
                      const SizedBox(width: 2),
                      AnimatedRotation(
                        turns: widget.expanded ? 0.5 : 0.0,
                        duration: FeedImmersiveTheme.motionFast,
                        curve: FeedImmersiveTheme.premiumSettleCurve,
                        child: const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          size: 16,
                          color: FeedImmersiveTheme.onMedia,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
