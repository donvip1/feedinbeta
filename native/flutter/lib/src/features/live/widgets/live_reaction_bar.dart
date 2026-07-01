import 'package:flutter/material.dart';

import '../data/live_models.dart';
import '../live_theme.dart';

/// A horizontal row of tappable emoji reactions (web `LIVE_REACTIONS` bar).
/// Each tap fires [onReaction] with the reaction key (e.g. `heart`, `fire`).
class LiveReactionBar extends StatelessWidget {
  const LiveReactionBar({super.key, required this.onReaction});

  final ValueChanged<String> onReaction;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final option in LiveReactionOption.bar)
          _ReactionButton(option: option, onTap: () => onReaction(option.type)),
      ],
    );
  }
}

class _ReactionButton extends StatefulWidget {
  const _ReactionButton({required this.option, required this.onTap});

  final LiveReactionOption option;
  final VoidCallback onTap;

  @override
  State<_ReactionButton> createState() => _ReactionButtonState();
}

class _ReactionButtonState extends State<_ReactionButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
    lowerBound: 1,
    upperBound: 1.35,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    _controller.forward().then((_) => _controller.reverse());
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        width: 40,
        height: 40,
        decoration: const BoxDecoration(
          color: LiveTheme.chip,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: ScaleTransition(
          scale: _controller,
          child: Text(
            widget.option.emoji,
            style: const TextStyle(fontSize: 20),
          ),
        ),
      ),
    );
  }
}
