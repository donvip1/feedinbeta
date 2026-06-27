import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../create_tokens.dart';
import '../create_view_models.dart';

/// Single-line hashtag entry for the post composer, porting
/// `src/components/post/HashtagInput.tsx`.
///
/// Behaviour (web parity):
///   * A leading [Icons.tag] (lucide `Hash`) sits before a transparent
///     [TextField] with the hint 'Add hashtags...'.
///   * Typing the first character of a fresh word auto-prepends a '#'.
///   * Pressing space or comma commits the current word and starts a new '#'
///     for the next tag.
///   * Input that would push the parsed tag count over [maxHashtags] is ignored
///     (the cap is enforced before emitting).
///   * The RAW field string is emitted via [onChanged]; the screen re-parses it
///     with `parseHashtags` so there is a single source of truth. This widget
///     never derives its own tag list for emission — [hashtags] is passed back
///     in by the parent.
///
/// Below the field:
///   * a right-aligned 'n/max' counter ([CreateTextStyles.counter]) that flips
///     to [CreateTextStyles.warning] with a 'Maximum N hashtags' note once the
///     limit is reached, and
///   * a [Wrap] of removable chips, one per parsed tag in [hashtags].
///
/// Pure presentational beyond a single [TextEditingController] kept in sync with
/// [rawValue] in [didUpdateWidget]. No Supabase/repo access, no derived state.
class HashtagInput extends StatefulWidget {
  const HashtagInput({
    super.key,
    required this.rawValue,
    required this.hashtags,
    this.maxHashtags = 5,
    required this.onChanged,
    required this.onRemoveTag,
  });

  /// Raw field text owned by the screen (source of truth), e.g. '#one #two'.
  final String rawValue;

  /// Parsed/normalized tags (no leading '#') the screen derived from [rawValue].
  final List<String> hashtags;

  /// Hard cap on the number of tags. Input that would exceed it is ignored.
  final int maxHashtags;

  /// Emits the RAW field string after applying the auto-'#'/space-commit rules
  /// and the cap. The screen re-parses via `parseHashtags`.
  final ValueChanged<String> onChanged;

  /// Removes a single parsed tag (no '#') — the screen rebuilds [rawValue].
  final ValueChanged<String> onRemoveTag;

  @override
  State<HashtagInput> createState() => _HashtagInputState();
}

class _HashtagInputState extends State<HashtagInput> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.rawValue);
  }

  @override
  void didUpdateWidget(covariant HashtagInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Keep the controller in lock-step with the screen's source-of-truth value
    // without clobbering the caret when the text is already identical.
    if (widget.rawValue != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.rawValue,
        selection: TextSelection.collapsed(offset: widget.rawValue.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Count parsed tags in an arbitrary raw string using the shared parser so the
  /// cap matches what the screen will compute.
  int _tagCount(String raw) => parseHashtags(raw, max: 1 << 30).length;

  /// Apply the HashtagInput.tsx input rules to [incoming] (the new field text
  /// proposed by the [TextField]). Returns the value to emit, or null to ignore
  /// the edit (cap exceeded). [previous] is the value before this edit.
  String? _transform(String incoming, String previous) {
    var next = incoming;

    // 1. If the user just typed a trailing space after some text, commit the
    //    current word and prime the next tag with a fresh '#'.
    final lastChar = next.isEmpty ? '' : next.substring(next.length - 1);
    if (lastChar == ' ' && previous.length < next.length) {
      final trimmed = next.trimRight();
      final words = trimmed
          .split(RegExp(r'[\s,]+'))
          .where((w) => w.isNotEmpty)
          .toList();
      if (words.length >= widget.maxHashtags) {
        // At the limit — keep the committed text but drop the new-tag space.
        return trimmed;
      }
      next = '$trimmed #';
    }

    // 2. Starting fresh: auto-prepend '#' to the very first character typed
    //    (unless it already is '#' or a bare space).
    if (next.length == 1 && next != '#' && next != ' ') {
      next = '#$next';
    }

    // 3. Guard the cap — never emit a value that parses to more than the max.
    if (_tagCount(next) > widget.maxHashtags) {
      return null;
    }
    return next;
  }

  void _handleChanged(String incoming) {
    final previous = widget.rawValue;
    final emitted = _transform(incoming, previous);
    if (emitted == null) {
      // Rejected (cap exceeded): snap the field back to the source of truth.
      _controller.value = TextEditingValue(
        text: previous,
        selection: TextSelection.collapsed(offset: previous.length),
      );
      return;
    }
    if (emitted != incoming) {
      // We rewrote the text (auto-'#' or space-commit): reflect it immediately
      // and park the caret at the end so typing continues naturally.
      _controller.value = TextEditingValue(
        text: emitted,
        selection: TextSelection.collapsed(offset: emitted.length),
      );
    }
    widget.onChanged(emitted);
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.hashtags.length;
    final atLimit = count >= widget.maxHashtags;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // --- The single-line field: Hash icon + transparent TextField --------
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Padding(
              padding: EdgeInsets.only(right: CreateSpacing.sm),
              child: Icon(
                Icons.tag,
                size: 20,
                color: CreateColors.mutedForeground,
              ),
            ),
            Expanded(
              child: TextField(
                controller: _controller,
                onChanged: _handleChanged,
                cursorColor: CreateColors.primary,
                style: CreateTextStyles.composerInput,
                keyboardType: TextInputType.text,
                textInputAction: TextInputAction.done,
                inputFormatters: const [
                  // Hashtags never legitimately span lines.
                  _SingleLineFormatter(),
                ],
                decoration: const InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    vertical: CreateSpacing.sm,
                  ),
                  hintText: 'Add hashtags...',
                  hintStyle: CreateTextStyles.composerHint,
                ),
              ),
            ),
          ],
        ),

        // --- Right-aligned counter (+ at-limit note) -------------------------
        Padding(
          padding: const EdgeInsets.only(top: CreateSpacing.xs),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (atLimit)
                Expanded(
                  child: Text(
                    'Maximum ${widget.maxHashtags} hashtags',
                    style: CreateTextStyles.warning,
                  ),
                ),
              Text(
                '$count/${widget.maxHashtags}',
                style: atLimit
                    ? CreateTextStyles.warning
                    : CreateTextStyles.counter,
              ),
            ],
          ),
        ),

        // --- Removable chips, one per parsed tag -----------------------------
        if (widget.hashtags.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: CreateSpacing.sm),
            child: Wrap(
              spacing: CreateSpacing.xs,
              runSpacing: CreateSpacing.xs,
              children: [
                for (final tag in widget.hashtags)
                  _HashtagChip(
                    tag: tag,
                    onRemove: () => widget.onRemoveTag(tag),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A single removable hashtag chip: faint primary fill, primary '#tag' text and
/// a trailing close affordance. Kept private so the field + chips stay
/// co-located (the spec folds `HashtagChipList` in here).
class _HashtagChip extends StatelessWidget {
  const _HashtagChip({required this.tag, required this.onRemove});

  final String tag;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: CreateColors.primaryFaint,
        borderRadius: CreateRadii.chip,
      ),
      padding: const EdgeInsets.only(
        left: CreateSpacing.sm,
        right: CreateSpacing.xs,
        top: CreateSpacing.xs,
        bottom: CreateSpacing.xs,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '#$tag',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: CreateColors.primary,
            ),
          ),
          const SizedBox(width: CreateSpacing.xs),
          InkResponse(
            onTap: onRemove,
            radius: 14,
            containedInkWell: true,
            customBorder: const CircleBorder(),
            child: const Padding(
              padding: EdgeInsets.all(2),
              child: Icon(Icons.close, size: 14, color: CreateColors.primary),
            ),
          ),
        ],
      ),
    );
  }
}

/// Strips newline characters so the hashtag field stays single-line even when a
/// soft keyboard inserts one. Pressing the action key just submits.
class _SingleLineFormatter extends TextInputFormatter {
  const _SingleLineFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (!newValue.text.contains('\n')) return newValue;
    final stripped = newValue.text.replaceAll('\n', ' ');
    return TextEditingValue(
      text: stripped,
      selection: TextSelection.collapsed(
        offset: stripped.length.clamp(0, stripped.length),
      ),
    );
  }
}
