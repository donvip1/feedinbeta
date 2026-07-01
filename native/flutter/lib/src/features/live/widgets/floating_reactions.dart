import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../live_theme.dart';

/// A bottom-anchored overlay of emoji that float up, drift, spin, and fade out,
/// mirroring the web `FloatingReactions` physics (`PhysicsReaction`). Callers
/// push emoji — optionally with a sender name — via a
/// [FloatingReactionsController].
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

  /// Enqueue [emoji] to float up. Optionally attribute it to [senderName], which
  /// renders a small name badge under the emoji (web parity). Safe to call
  /// rapidly; the overlay caps how many float at once.
  void add(String emoji, {String? senderName}) {
    _pending.add(_PendingReaction(emoji, senderName));
    notifyListeners();
  }

  List<_PendingReaction> _drain() {
    final drained = List<_PendingReaction>.of(_pending);
    _pending.clear();
    return drained;
  }
}

class _PendingReaction {
  _PendingReaction(this.emoji, this.senderName);

  final String emoji;
  final String? senderName;
  final String id =
      '${DateTime.now().microsecondsSinceEpoch}-'
      '${math.Random().nextInt(1 << 32)}';
}

class _FloatingReactionsOverlayState extends State<FloatingReactionsOverlay> {
  final List<_PendingReaction> _active = [];

  /// Cap concurrent emoji so a gift/reaction storm cannot spawn unbounded
  /// animation controllers.
  static const _maxActive = 40;

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
    setState(() {
      _active.addAll(drained);
      if (_active.length > _maxActive) {
        _active.removeRange(0, _active.length - _maxActive);
      }
    });
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
              senderName: reaction.senderName,
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
    required this.senderName,
    required this.onDone,
  });

  final String emoji;
  final String? senderName;
  final VoidCallback onDone;

  @override
  State<_FloatingEmoji> createState() => _FloatingEmojiState();
}

class _FloatingEmojiState extends State<_FloatingEmoji>
    with SingleTickerProviderStateMixin {
  static final _random = math.Random();

  late final AnimationController _controller = AnimationController(
    vsync: this,
    // Web uses 2.5–4s; match that spread.
    duration: Duration(milliseconds: 2500 + _random.nextInt(1500)),
  );

  late final double _horizontalDrift = (_random.nextDouble() - 0.5) * 90;
  late final double _startRight = 16 + _random.nextDouble() * 48;
  late final double _baseRotation = (_random.nextDouble() - 0.5) * 0.5;
  late final double _peakScale = 1.0 + _random.nextDouble() * 0.5;

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
        final rise = 260 * Curves.easeOut.transform(t);
        final opacity = t < 0.15
            ? t / 0.15
            : (1 - ((t - 0.15) / 0.85)).clamp(0.0, 1.0);
        // Organic wobble on the way up.
        final wobble = math.sin(t * math.pi * 3) * 6;
        final scale = 0.3 + (_peakScale - 0.3) * Curves.easeOut.transform(t);
        return Positioned(
          right: _startRight + _horizontalDrift * t + wobble,
          bottom: 24 + rise,
          child: Opacity(
            opacity: opacity,
            child: Transform.rotate(
              angle: _baseRotation + math.sin(t * math.pi * 2) * 0.15,
              child: Transform.scale(scale: scale, child: child),
            ),
          ),
        );
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.emoji,
            style: const TextStyle(
              fontSize: 32,
              shadows: [Shadow(color: Color(0x80FF6464), blurRadius: 18)],
            ),
          ),
          if (widget.senderName != null && widget.senderName!.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 2),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
              constraints: const BoxConstraints(maxWidth: 88),
              decoration: BoxDecoration(
                color: LiveTheme.chip,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                widget.senderName!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
