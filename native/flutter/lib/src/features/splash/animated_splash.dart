import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/brand/brand_mark.dart';

/// Branded launch animation shown while the session check + feed pre-warm run.
///
/// The pre-Flutter native splash (`flutter_native_splash`) paints the same
/// dark background + logo during cold start; this Dart splash takes over
/// seamlessly: the mark zooms into place, then gently "breathes" during a hold
/// so the screen never looks frozen, before the app advances to the feed/login.
///
/// The hold lasts [minimumDuration] (~6s) on purpose: for a signed-in user the
/// feed cache pre-warms in the background during this window (up to 30 posts),
/// so by the time the splash clears the feed is already populated and scrolls
/// immediately. [onFinished] fires once that window elapses; [AuthGate] also
/// waits on its own session check, advancing only when both are done.
class AnimatedSplash extends StatefulWidget {
  const AnimatedSplash({
    super.key,
    required this.onFinished,
    this.minimumDuration = const Duration(seconds: 6),
  });

  final VoidCallback onFinished;

  /// How long the splash stays up before signalling completion, giving the
  /// background feed pre-warm time to land.
  final Duration minimumDuration;

  /// Brand-dark background, matching `feedin_app.dart`'s scaffold and the native
  /// splash color so there is no seam when this widget takes over.
  static const _background = Color(0xFF070A12);

  @override
  State<AnimatedSplash> createState() => _AnimatedSplashState();
}

class _AnimatedSplashState extends State<AnimatedSplash>
    with TickerProviderStateMixin {
  late final AnimationController _entrance;
  late final AnimationController _pulse;
  late final Animation<double> _scale;
  late final Animation<double> _fade;
  late final Animation<double> _glow;
  late final Animation<double> _breathe;
  Timer? _holdTimer;

  @override
  void initState() {
    super.initState();

    // Entrance: the logo pops into place and its glow fades in.
    _entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _scale = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _entrance, curve: Curves.easeOutBack),
    );
    _fade = CurvedAnimation(
      parent: _entrance,
      curve: const Interval(0, 0.6, curve: Curves.easeOut),
    );
    _glow = CurvedAnimation(
      parent: _entrance,
      curve: const Interval(0.1, 1, curve: Curves.easeInOut),
    );

    // Breathing pulse that runs during the ~6s hold so the brand feels alive
    // rather than frozen while feeds load underneath.
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _breathe = Tween<double>(begin: 1.0, end: 1.045).animate(
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
    );

    _entrance.forward().whenComplete(() {
      if (mounted) _pulse.repeat(reverse: true);
    });

    // Hold for the full minimum window, then advance.
    _holdTimer = Timer(widget.minimumDuration, () {
      if (mounted) widget.onFinished();
    });
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    _entrance.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AnimatedSplash._background,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FadeTransition(
              opacity: _fade,
              child: ScaleTransition(
                scale: _scale,
                child: ScaleTransition(
                  scale: _breathe,
                  child: AnimatedBuilder(
                    animation: Listenable.merge([_glow, _pulse]),
                    builder: (context, child) {
                      // Glow intensity fades in with the entrance, then swells
                      // subtly with each breath.
                      final intensity = _glow.value * (0.85 + 0.15 * _pulse.value);
                      return DecoratedBox(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(
                                0xFFFF3D9A,
                              ).withValues(alpha: 0.35 * intensity),
                              blurRadius: 48 * intensity,
                              spreadRadius: 8 * intensity,
                            ),
                          ],
                        ),
                        child: child,
                      );
                    },
                    child: const BrandMark(size: 132),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 44),
            // A quiet progress hint so the longer hold reads as "loading", not
            // "stuck". Fades in with the logo.
            FadeTransition(
              opacity: _fade,
              child: const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0x66FFFFFF)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
