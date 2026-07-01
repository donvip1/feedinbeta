import 'dart:math' as math;

import 'package:flutter/material.dart';

/// A bottom-right overlay of emoji that float up and fade out, mirroring the web
/// `FloatingReactions`. Callers push emoji strings via a [FloatingReactionsController].
class FloatingReactionsOverlay extends StatefulWidget {
  const FloatingReactionsOverlay({super.key, required this.controller});

  final FloatingReactionsController controller;

  @override
  State<FloatingReactionsOverlay> createState() =>
      _FloatingReactionsOverlayState();
}

/// Lets an ancestor push reaction emoji into the overlay without a rebuild.
class FloatingReactionsController extends ChangeNotifier {
  final List<_PendingReaction> _pending = [];

  /// Enqueue [emoji] to float up. Safe to call rapidly.
  void add(String emoji) {
    _pending.add(_PendingReaction(emoji));
    notifyListeners();
  }

  List<_PendingReaction> _drain() {
    final drained = List<_PendingReaction>.of(_pending);
    _pending.clear();
    return drained;
  }
}

class _PendingReaction {
  _PendingReaction(this.emoji);

  final String emoji;
  final String id = '${DateTime.now().microsecondsSinceEpoch}-'
      '${math.Random().nextInt(1 << 32)}';
}

class _FloatingReactionsOverlayState extends State<FloatingReactionsOverlay> {
  final List<_PendingReaction> _active = [];

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onController);
  }

  @override
  void didUpdateWidget(covariant FloatingReactionsOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onController);
      widget.controller.addListener(_onController);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onController);
    super.dispose();
  }

  void _onController() {
    final drained = widget.controller._drain();
    if (drained.isEmpty || !mounted) return;
    setState(() => _active.addAll(drained));
  }

  void _remove(String id) {
    if (!mounted) return;
    setState(() => _active.removeWhere((r) => r.id == id));
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          for (final reaction in _active)
            _FloatingEmoji(
              key: ValueKey(reaction.id),
              emoji: reaction.emoji,
              onDone: () => _remove(reaction.id),
            ),
        ],
      ),
    );
  }
}

class _FloatingEmoji extends StatefulWidget {
  const _FloatingEmoji({
    super.key,
    required this.emoji,
    required this.onDone,
  });

  final String emoji;
  final VoidCallback onDone;

  @override
  State<_FloatingEmoji> createState() => _FloatingEmojiState();
}

class _FloatingEmojiState extends State<_FloatingEmoji>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );

  late final double _horizontalDrift =
      (math.Random().nextDouble() - 0.5) * 60;
  late final double _startRight = 16 + math.Random().nextDouble() * 40;

  @override
  void initState() {
    super.initState();
    _controller.forward().whenComplete(widget.onDone);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        final rise = 220 * Curves.easeOut.transform(t);
        final opacity = t < 0.15
            ? t / 0.15
            : (1 - ((t - 0.15) / 0.85)).clamp(0.0, 1.0);
        return Positioned(
          right: _startRight + _horizontalDrift * t,
          bottom: 24 + rise,
          child: Opacity(
            opacity: opacity,
            child: Transform.scale(
              scale: 0.8 + 0.4 * math.sin(t * math.pi),
              child: child,
            ),
          ),
        );
      },
      child: Text(widget.emoji, style: const TextStyle(fontSize: 30)),
    );
  }
}
