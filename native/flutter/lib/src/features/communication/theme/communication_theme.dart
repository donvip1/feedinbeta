import 'package:flutter/material.dart';

/// Design tokens for the Communication Platform surfaces (chats, calls, spaces),
/// distilled from the owner's UX north-star preview: dark slate surfaces, a
/// pink→purple brand gradient, and an emerald "secure/encrypted" accent, on the
/// Inter type family with glass surfaces.
///
/// Everything is `static const` so it can live inside `const` widgets. Mirrors
/// the structure of `FeedImmersiveTheme` for consistency across the app.
class CommunicationTheme {
  const CommunicationTheme._();

  // -- Surfaces (slate) -------------------------------------------------------
  static const Color canvas = Color(0xFF0F172A); // feed.dark
  static const Color surface = Color(0xFF1E293B); // feed.surface
  static const Color surfaceCard = Color(0xFF090D16); // feed.card
  static const Color surfaceRaised = Color(0xFF334155);

  // -- Brand + accents --------------------------------------------------------
  static const Color brandPink = Color(0xFFEC4899); // feed.accent
  static const Color brandPurple = Color(0xFFA855F7);
  static const Color infoBlue = Color(0xFF2481CC); // feed.blue
  static const Color secureEmerald = Color(0xFF10B981); // feed.emerald
  static const Color danger = Color(0xFFF43F5E); // rose-500 (end call)

  // -- Ink --------------------------------------------------------------------
  static const Color ink = Color(0xFFF1F5F9); // slate-100
  static const Color inkMuted = Color(0xFF94A3B8); // slate-400
  static const Color inkSubtle = Color(0xFF64748B); // slate-500

  // -- Glass ------------------------------------------------------------------
  static const Color glassSurface = Color(0x66101828);
  static const Color glassStrong = Color(0xCC0B101C);
  static const Color glassBorder = Color(0x1AFFFFFF); // white @ 10%

  // -- Gradients --------------------------------------------------------------
  static const LinearGradient brandGradient = LinearGradient(
    colors: [brandPink, brandPurple],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );
  static const LinearGradient secureBanner = LinearGradient(
    colors: [Color(0x6610B981), Color(0xFF0F172A)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  // -- Radius / spacing -------------------------------------------------------
  static const double radiusSm = 10;
  static const double radiusMd = 14;
  static const double radiusLg = 18;
  static const double radiusXl = 24;
  static const double radiusPill = 999;
  static const double spaceXs = 4;
  static const double spaceSm = 8;
  static const double spaceMd = 12;
  static const double spaceLg = 16;
  static const double spaceXl = 24;

  // -- Motion -----------------------------------------------------------------
  static const Duration motionPress = Duration(milliseconds: 150);
  static const Duration motionFast = Duration(milliseconds: 220);
  static const Duration motionMedium = Duration(milliseconds: 300);
  static const Curve settleCurve = Cubic(0.22, 1, 0.36, 1);

  // -- Typography (Inter) -----------------------------------------------------
  static const String fontFamily = 'Inter';
  static const TextStyle titleLarge = TextStyle(
    color: ink,
    fontSize: 20,
    fontWeight: FontWeight.w900,
  );
  static const TextStyle threadTitle = TextStyle(
    color: ink,
    fontSize: 15,
    fontWeight: FontWeight.w700,
  );
  static const TextStyle threadPreview = TextStyle(
    color: inkMuted,
    fontSize: 12,
    fontWeight: FontWeight.w500,
  );
  static const TextStyle secureLabel = TextStyle(
    color: secureEmerald,
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.2,
  );
  static const TextStyle callTimer = TextStyle(
    color: inkMuted,
    fontSize: 12,
    fontWeight: FontWeight.w700,
  );
}
