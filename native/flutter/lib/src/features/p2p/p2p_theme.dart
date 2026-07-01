import 'package:flutter/material.dart';

/// Design tokens for the P2P credit marketplace.
///
/// Mirrors the dark, premium look of the immersive feed
/// (`feed_immersive_theme.dart`) while staying self-contained so the P2P module
/// has no cross-feature dependency. Everything is `static const` so tokens can
/// be embedded in `const` widgets.
class P2PTheme {
  const P2PTheme._();

  // --- Surfaces ---
  /// App/page background — near-black with a faint warm tint.
  static const Color background = Color(0xFF0B0B0F);

  /// Elevated card surface.
  static const Color card = Color(0xFF15151C);

  /// Slightly brighter surface for nested rows / inputs.
  static const Color surface = Color(0xFF1D1D26);

  /// Hairline borders / dividers.
  static const Color border = Color(0x1FFFFFFF); // white @ 12%
  static const Color borderStrong = Color(0x33FFFFFF); // white @ 20%

  // --- Brand accents (shared with immersive feed) ---
  static const Color brandPink = Color(0xFFFF3D9A);
  static const Color brandOrange = Color(0xFFFF7A45);
  static const Color brandPurple = Color(0xFF6B1FB3);

  static const Color primary = brandPink;
  static const Color primaryForeground = Colors.white;

  // --- Text ---
  static const Color foreground = Color(0xFFF5F5F7);
  static const Color mutedForeground = Color(0xB3FFFFFF); // white @ 70%
  static const Color faintForeground = Color(0x80FFFFFF); // white @ 50%

  // --- Status colors ---
  static const Color success = Color(0xFF34D399);
  static const Color warning = Color(0xFFFBBF24);
  static const Color danger = Color(0xFFFF453A);
  static const Color info = Color(0xFF3B82F6);

  // --- Gradients ---
  static const LinearGradient brandGradient = LinearGradient(
    colors: [brandPink, brandOrange],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient glyphGradient = LinearGradient(
    colors: [brandPink, brandPurple],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // --- Shadows ---
  static const List<BoxShadow> cardShadow = [
    BoxShadow(color: Color(0x66000000), blurRadius: 18, offset: Offset(0, 8)),
  ];

  static const List<BoxShadow> pinkGlow = [
    BoxShadow(color: Color(0x59FF3D9A), blurRadius: 20, offset: Offset(0, 6)),
  ];

  // --- Radii ---
  static const BorderRadius cardRadius = BorderRadius.all(Radius.circular(18));
  static const BorderRadius chipRadius = BorderRadius.all(Radius.circular(12));
  static const BorderRadius sheetTop = BorderRadius.vertical(
    top: Radius.circular(24),
  );

  // --- Spacing ---
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  // --- Text styles ---
  static const TextStyle screenTitle = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.5,
    color: foreground,
  );

  static const TextStyle sectionTitle = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.2,
    color: foreground,
  );

  static const TextStyle cardTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: foreground,
  );

  static const TextStyle body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: foreground,
    height: 1.35,
  );

  static const TextStyle muted = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: mutedForeground,
  );

  static const TextStyle meta = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: faintForeground,
    letterSpacing: 0.1,
  );

  static const TextStyle amount = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.4,
    color: foreground,
  );
}
