import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../live_theme.dart';

/// A center-stage celebratory burst shown when a gift lands in a live room,
/// mirroring the web `FullScreenGiftEffect`: the gift glyph pops in, radiating
/// sparkles fan out, and an optional `sender sent a gift` caption fades.
///
/// This is a pure-client FIT effect (no new dependency): gifts still float via
/// [FloatingReactionsOverlay], but a burst makes the moment feel special the way
/// the web full-screen effect does. Bursts are queued and shown one at a time.
class GiftBurstOverlay extends StatefulWidget {
  const GiftBurstOverlay({super.key, required this.controller});

  final GiftBurstController controller;

  @override
  State<GiftBurstOverlay> createState() => _GiftBurstOverlayState();
}

/// Enqueue gift bursts from an ancestor without rebuilding it.
class GiftBurstController extends ChangeNotifier {
  final List<GiftBurst> _pending = [];

  /// Show a burst for [emoji], optionally captioned with [senderName] and the
  /// gift's [label].
  void add(String emoji, {String? senderName, String? label}) {
    _pending.add(GiftBurst(emoji: emoji, senderName: senderName, label: label));
    notifyListeners();
  }

  List<GiftBurst> _drain() {
    final drained = List<GiftBurst>.of(_pending);
    _pending.clear();
    return drained;
  }
}

class GiftBurst {
  const GiftBurst({required this.emoji, this.senderName, this.label});

  final String emoji;
  final String? senderName;
  final String? label;
}

class _GiftBurstOverlayState extends State<GiftBurstOverlay> {
  final List<GiftBurst> _queue = [];
  GiftBurst? _current;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onController);
  }

  @override
  void didUpdateWidget(covariant GiftBurstOverlay oldWidget) {
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
    // Cap the backlog so a gift storm cannot queue indefinitely.
    _queue.addAll(drained);
    if (_queue.length > 6) _queue.removeRange(0, _queue.length - 6);
    _maybeShowNext();
  }

  void _maybeShowNext() {
    if (_current != null || _queue.isEmpty || !mounted) return;
    setState(() => _current = _queue.removeAt(0));
  }

  void _onBurstDone() {
    if (!mounted) return;
    setState(() => _current = null);
    _maybeShowNext();
  }

  @override
  Widget build(BuildContext context) {
    final current = _current;
    return IgnorePointer(
      child: Align(
        alignment: const Alignment(0, -0.2),
        child: current == null
            ? const SizedBox.shrink()
            : _GiftBurstAnimation(
                key: ValueKey(current),
                burst: current,
                onDone: _onBurstDone,
              ),
      ),
    );
  }
}

class _GiftBurstAnimation extends StatefulWidget {
  const _GiftBurstAnimation({
    super.key,
    required this.burst,
    required this.onDone,
  });

  final GiftBurst burst;
  final VoidCallback onDone;

  @override
  State<_GiftBurstAnimation> createState() => _GiftBurstAnimationState();
}

class _GiftBurstAnimationState extends State<_GiftBurstAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );

  static const _sparkleCount = 8;

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
        // Pop in (0–0.25), hold, then fade + drift up (0.7–1).
        final popIn = Curves.elasticOut.transform((t / 0.35).clamp(0.0, 1.0));
        final scale = 0.4 + 0.9 * popIn;
        final fade = t < 0.7 ? 1.0 : (1 - (t - 0.7) / 0.3).clamp(0.0, 1.0);
        final rise = t < 0.7 ? 0.0 : -40 * ((t - 0.7) / 0.3);
        return Opacity(
          opacity: fade,
          child: Transform.translate(
            offset: Offset(0, rise),
            child: SizedBox(
              width: 240,
              height: 240,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Radiating sparkles.
                  for (var i = 0; i < _sparkleCount; i++) _sparkle(i, t),
                  Transform.scale(scale: scale, child: child),
                ],
              ),
            ),
          ),
        );
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.burst.emoji,
            style: const TextStyle(
              fontSize: 72,
              shadows: [Shadow(color: Color(0xAAFFC24A), blurRadius: 32)],
            ),
          ),
          if (_caption != null)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: LiveTheme.chip,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: LiveTheme.chipBorder),
              ),
              child: Text(
                _caption!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String? get _caption {
    final sender = widget.burst.senderName;
    final label = widget.burst.label;
    if (sender != null && sender.isNotEmpty && label != null) {
      return '$sender sent a $label';
    }
    if (label != null) return label;
    return null;
  }

  Widget _sparkle(int index, double t) {
    final angle = (index / _sparkleCount) * 2 * math.pi;
    final distance = 40 + 70 * Curves.easeOut.transform(t.clamp(0.0, 1.0));
    final sparkleFade = (1 - t).clamp(0.0, 1.0);
    return Transform.translate(
      offset: Offset(math.cos(angle) * distance, math.sin(angle) * distance),
      child: Opacity(
        opacity: sparkleFade,
        child: Icon(
          Icons.auto_awesome_rounded,
          size: 16,
          color: Colors.amberAccent.withValues(alpha: 0.9),
        ),
      ),
    );
  }
}
