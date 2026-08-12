import 'package:flutter/material.dart';

import '../../core/brand/brand_mark.dart';

/// Branded launch animation shown while the session check runs.
///
/// The pre-Flutter native splash (`flutter_native_splash`) paints the same
/// dark background + logo during cold start; this Dart splash takes over
/// seamlessly and animates the mark in — a soft glow ring plus a scale/fade
/// "zoom into place" — before the app advances to the feed or login.
///
/// [onFinished] fires once the entrance animation settles. The host
/// ([AuthGate]) also waits on its own session check, so the app only advances
/// when both the animation and the check are done — guaranteeing the brand
/// moment is always seen without adding artificial delay on a slow check.
class AnimatedSplash extends StatefulWidget {
  const AnimatedSplash({super.key, required this.onFinished});

  final VoidCallback onFinished;

  /// Brand-dark background, matching `feedin_app.dart`'s scaffold and the native
  /// splash color so there is no seam when this widget takes over.
  static const _background = Color(0xFF070A12);

  @override
  State<AnimatedSplash> createState() => _AnimatedSplashState();
}

class _AnimatedSplashState extends State<AnimatedSplash>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _fade;
  late final Animation<double> _glow;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );

    // Scale settles slightly past 1.0 for a gentle "pop" (easeOutBack), while
    // the logo and its glow fade in over the first ~60% of the timeline.
    _scale = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    _fade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.6, curve: Curves.easeOut),
    );
    _glow = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.1, 1, curve: Curves.easeInOut),
    );

    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) widget.onFinished();
    });
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AnimatedSplash._background,
      child: Center(
        child: FadeTransition(
          opacity: _fade,
          child: ScaleTransition(
            scale: _scale,
            child: AnimatedBuilder(
              animation: _glow,
              builder: (context, child) {
                return DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(
                          0xFFFF3D9A,
                        ).withValues(alpha: 0.35 * _glow.value),
                        blurRadius: 48 * _glow.value,
                        spreadRadius: 8 * _glow.value,
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
    );
  }
}
