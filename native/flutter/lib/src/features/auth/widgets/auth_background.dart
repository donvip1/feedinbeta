import 'package:flutter/material.dart';

import '../auth_theme.dart';

/// Full-bleed brand background for the auth screens.
///
/// Paints the app's pink→orange brand gradient edge-to-edge with a couple of
/// soft light blooms for depth, then floats [child] on top. There are no
/// cards, borders, or boxes — everything above sits directly on the gradient.
class AuthBackground extends StatelessWidget {
  const AuthBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AuthGradients.brand),
      child: Stack(
        children: [
          // Soft top-left light bloom.
          const Positioned(
            top: -120,
            left: -80,
            child: _Bloom(size: 320, color: Color(0x33FFFFFF)),
          ),
          // Warmer bloom drifting off the bottom-right.
          const Positioned(
            bottom: -140,
            right: -100,
            child: _Bloom(size: 360, color: Color(0x2AFFFFFF)),
          ),
          // Gentle darkening toward the bottom keeps footer text legible.
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x00000000), Color(0x1A000000)],
                ),
              ),
            ),
          ),
          Positioned.fill(child: child),
        ],
      ),
    );
  }
}

/// A soft circular glow used to add depth to the flat gradient.
class _Bloom extends StatelessWidget {
  const _Bloom({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color, color.withValues(alpha: 0)],
          ),
        ),
      ),
    );
  }
}
