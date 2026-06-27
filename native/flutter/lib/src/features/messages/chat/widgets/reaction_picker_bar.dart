import 'package:flutter/material.dart';

import '../chat_theme.dart';
import '../chat_view_models.dart';

/// The quick-reaction row + expandable extended emoji grid used at the top of
/// the message context menu (and reusable standalone).
///
/// Collapsed state shows the 6 [ChatReactionCatalog.core] descriptors as
/// circular tappable targets; the [selectedEmoji] gets a [ChatColors.primaryFaint]
/// highlight ring plus a subtle continuous pulse. A trailing chevron toggles an
/// animated expansion into a 7-column grid of [ChatReactionCatalog.extended]
/// (21 emoji). Tapping any emoji — core or extended — calls [onReact]; the
/// parent menu is responsible for closing.
///
/// This widget is purely presentational: it holds no toggle semantics
/// (one-per-user replace/remove is decided by the parent/repo) and performs no
/// business logic beyond the expand toggle and per-button press animation.
class ReactionPickerBar extends StatefulWidget {
  const ReactionPickerBar({
    super.key,
    required this.onReact,
    this.selectedEmoji,
    this.initiallyExpanded = false,
  });

  /// The emoji the current user has already reacted with (if any). Rendered
  /// with a highlight ring + pulse in the collapsed core row.
  final String? selectedEmoji;

  /// Called when the user taps any emoji (core or extended). The parent owns
  /// closing the menu and reconciling reaction state.
  final void Function(String emoji) onReact;

  /// Whether the extended grid starts expanded.
  final bool initiallyExpanded;

  @override
  State<ReactionPickerBar> createState() => _ReactionPickerBarState();
}

class _ReactionPickerBarState extends State<ReactionPickerBar> {
  late bool _expanded = widget.initiallyExpanded;

  void _toggleExpanded() {
    setState(() => _expanded = !_expanded);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Collapsed quick-reaction row: 6 core emoji + chevron toggle.
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (final reaction in ChatReactionCatalog.core)
              _ReactionButton(
                emoji: reaction.emoji,
                semanticLabel: reaction.label,
                isSelected: widget.selectedEmoji == reaction.emoji,
                onTap: () => widget.onReact(reaction.emoji),
              ),
            _ExpandToggleButton(expanded: _expanded, onTap: _toggleExpanded),
          ],
        ),
        // Extended emoji grid (7 columns), animated open/close.
        AnimatedCrossFade(
          firstChild: const SizedBox(width: double.infinity, height: 0),
          secondChild: _ExtendedEmojiGrid(
            onReact: widget.onReact,
            selectedEmoji: widget.selectedEmoji,
          ),
          crossFadeState: _expanded
              ? CrossFadeState.showSecond
              : CrossFadeState.showFirst,
          duration: ChatMotion.normal,
          sizeCurve: ChatMotion.emphasized,
          firstCurve: Curves.easeOut,
          secondCurve: Curves.easeOut,
        ),
      ],
    );
  }
}

/// The 7-column non-scrolling grid of extended emoji, shown when expanded.
class _ExtendedEmojiGrid extends StatelessWidget {
  const _ExtendedEmojiGrid({
    required this.onReact,
    required this.selectedEmoji,
  });

  final void Function(String emoji) onReact;
  final String? selectedEmoji;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: ChatSpacing.sm),
      padding: const EdgeInsets.only(top: ChatSpacing.sm),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: ChatColors.border)),
      ),
      child: GridView.count(
        crossAxisCount: 7,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        mainAxisSpacing: ChatSpacing.xs,
        crossAxisSpacing: ChatSpacing.xs,
        children: [
          for (final emoji in ChatReactionCatalog.extended)
            _ReactionButton(
              emoji: emoji,
              semanticLabel: emoji,
              isSelected: selectedEmoji == emoji,
              compact: true,
              onTap: () => onReact(emoji),
            ),
        ],
      ),
    );
  }
}

/// A single circular, tappable emoji target with a light press 'burst' (scale)
/// animation and an optional selected highlight ring + continuous pulse.
class _ReactionButton extends StatefulWidget {
  const _ReactionButton({
    required this.emoji,
    required this.semanticLabel,
    required this.isSelected,
    required this.onTap,
    this.compact = false,
  });

  final String emoji;
  final String semanticLabel;
  final bool isSelected;
  final VoidCallback onTap;

  /// Compact cells (extended grid) omit the fixed [ChatSpacing.tapTarget]
  /// minimum so they pack tightly into the 7-column grid.
  final bool compact;

  @override
  State<_ReactionButton> createState() => _ReactionButtonState();
}

class _ReactionButtonState extends State<_ReactionButton>
    with TickerProviderStateMixin {
  // Short press 'burst' driven manually so a tap always plays start->end.
  late final AnimationController _burstController = AnimationController(
    vsync: this,
    duration: ChatMotion.fast,
    lowerBound: 0,
    upperBound: 1,
  );

  // Continuous subtle pulse for the currently-selected emoji.
  late final AnimationController _pulseController = AnimationController(
    vsync: this,
    duration: ChatMotion.slow,
  );

  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    if (widget.isSelected) {
      _pulseController.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(covariant _ReactionButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isSelected && !_pulseController.isAnimating) {
      _pulseController.repeat(reverse: true);
    } else if (!widget.isSelected && _pulseController.isAnimating) {
      _pulseController
        ..stop()
        ..value = 0;
    }
  }

  @override
  void dispose() {
    _burstController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _handleTap() {
    // Visual-only burst: pop up then settle back.
    _burstController.forward(from: 0).then((_) {
      if (mounted) _burstController.reverse();
    });
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final double size = widget.compact
        ? ChatSpacing.tapTarget - 8
        : ChatSpacing.tapTarget;
    final double glyphSize = widget.compact ? 18 : 22;

    final Widget glyph = Text(
      widget.emoji,
      style: TextStyle(fontSize: glyphSize, height: 1.0),
    );

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      selected: widget.isSelected,
      child: AnimatedScale(
        // Press feedback combines with the burst for a snappy pop.
        scale: _pressed ? 0.85 : 1.0,
        duration: ChatMotion.fast,
        curve: Curves.easeOut,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => setState(() => _pressed = true),
          onTapCancel: () => setState(() => _pressed = false),
          onTap: () {
            setState(() => _pressed = false);
            _handleTap();
          },
          child: AnimatedBuilder(
            animation: Listenable.merge([_burstController, _pulseController]),
            builder: (context, child) {
              // Burst: a brief overshoot scale on tap.
              final double burst = 1 + (_burstController.value * 0.25);
              // Pulse: gentle breathing only while selected.
              final double pulse = widget.isSelected
                  ? 1 + (_pulseController.value * 0.08)
                  : 1.0;
              return Transform.scale(scale: burst * pulse, child: child);
            },
            child: Container(
              width: size,
              height: size,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: widget.isSelected
                    ? ChatColors.primaryFaint
                    : Colors.transparent,
                shape: BoxShape.circle,
                border: widget.isSelected
                    ? Border.all(color: ChatColors.primary, width: 2)
                    : null,
              ),
              child: glyph,
            ),
          ),
        ),
      ),
    );
  }
}

/// The trailing chevron that toggles the extended grid open/closed.
class _ExpandToggleButton extends StatelessWidget {
  const _ExpandToggleButton({required this.expanded, required this.onTap});

  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: expanded ? 'Fewer reactions' : 'More reactions',
      expanded: expanded,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          width: ChatSpacing.tapTarget,
          height: ChatSpacing.tapTarget,
          alignment: Alignment.center,
          child: Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: ChatColors.muted,
              shape: BoxShape.circle,
            ),
            child: AnimatedRotation(
              turns: expanded ? 0.5 : 0.0,
              duration: ChatMotion.normal,
              curve: ChatMotion.emphasized,
              child: const Icon(
                Icons.keyboard_arrow_down,
                size: 20,
                color: ChatColors.mutedForeground,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
