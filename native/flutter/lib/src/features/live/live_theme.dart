import 'package:flutter/material.dart';

/// Design tokens for the live streaming + audio-space module.
///
/// Mirrors the immersive dark look of the feed (see the feed's
/// `FeedImmersiveTheme`) and the web live surfaces (`#050505` backgrounds,
/// red "LIVE" pill, purple space accent). Kept `static const` so the values can
/// be embedded in `const` widgets throughout the module.
class LiveTheme {
  const LiveTheme._();

  // --- Surfaces ---
  /// Near-black room/browse background (web live surfaces use `#050505`).
  static const Color background = Color(0xFF050505);
  static const Color surface = Color(0xFF121214);
  static const Color surfaceRaised = Color(0xFF1C1C20);

  // --- Brand / accent ---
  static const Color brandPink = Color(0xFFFF3D9A);
  static const Color brandOrange = Color(0xFFFF7A45);

  /// Video-stream accent (red "LIVE").
  static const Color liveRed = Color(0xFFFF2D55);

  /// Audio-space accent (purple).
  static const Color spacePurple = Color(0xFF9B5CFF);

  // --- On-surface text ---
  static const Color onSurface = Colors.white;
  static const Color onSurfaceMuted = Color(0xB3FFFFFF); // white @ 70%
  static const Color onSurfaceFaint = Color(0x80FFFFFF); // white @ 50%

  // --- Chip / pill surfaces ---
  static const Color chip = Color(0x66000000);
  static const Color chipBorder = Color(0x1AFFFFFF);
  static const Color glassSurface = Color(0x33000000);

  // --- Gradients ---
  static const LinearGradient brandGradient = LinearGradient(
    colors: [brandPink, brandOrange],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient streamFallback = LinearGradient(
    colors: [Color(0xE6871A2E), Color(0xE64A0D1B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient spaceFallback = LinearGradient(
    colors: [Color(0xE61B5E3A), Color(0xE60D3A24)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Scrim under the bottom-left overlay so card/room text stays legible.
  static const LinearGradient bottomScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x00000000), Color(0x99000000), Color(0xE6000000)],
    stops: [0.4, 0.75, 1.0],
  );

  static const LinearGradient topScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xB3000000), Color(0x00000000)],
  );

  // --- Text styles ---
  static const List<Shadow> textShadow = [
    Shadow(color: Color(0x99000000), blurRadius: 4, offset: Offset(0, 1)),
    Shadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 2)),
  ];

  static const TextStyle screenTitle = TextStyle(
    color: onSurface,
    fontSize: 22,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.4,
  );

  static const TextStyle sectionLabel = TextStyle(
    color: onSurfaceMuted,
    fontSize: 12,
    fontWeight: FontWeight.w800,
    letterSpacing: 1.2,
  );

  static const TextStyle cardTitle = TextStyle(
    color: onSurface,
    fontSize: 13,
    fontWeight: FontWeight.w700,
    height: 1.2,
    shadows: textShadow,
  );

  static const TextStyle cardHost = TextStyle(
    color: onSurfaceMuted,
    fontSize: 11,
    fontWeight: FontWeight.w600,
    shadows: textShadow,
  );

  static const TextStyle countLabel = TextStyle(
    color: onSurface,
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.2,
    shadows: textShadow,
  );

  static const TextStyle chatName = TextStyle(
    color: onSurface,
    fontSize: 12,
    fontWeight: FontWeight.w800,
  );

  static const TextStyle chatBody = TextStyle(
    color: Color(0xE6FFFFFF),
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.3,
  );

  // --- Radii ---
  static const BorderRadius cardRadius = BorderRadius.all(Radius.circular(18));
  static const BorderRadius pillRadius = BorderRadius.all(Radius.circular(999));
  static const BorderRadius sheetRadius = BorderRadius.vertical(
    top: Radius.circular(24),
  );
}
