import 'package:flutter/material.dart';

/// Design tokens for the TikTok-style immersive feed.
///
/// Everything is `static const` so the values can be embedded inside `const`
/// widgets across the immersive feed widgets.
class FeedImmersiveTheme {
  const FeedImmersiveTheme._();

  // --- Brand colors ---
  static const Color brandPink = Color(0xFFFF3D9A);
  static const Color brandOrange = Color(0xFFFF7A45);
  static const Color brandDeepPurple = Color(0xFF6B1FB3);

  // --- Action accent colors ---
  static const Color likeActive = Color(0xFFFF2D55);
  static const Color saveActive = brandPink;

  // --- Action rail chip surfaces ---
  /// Default translucent backing behind each rail glyph (web `bg-black/40`).
  static const Color railChip = Color(0x66000000);

  /// Chip tint when the like control is active (web `bg-pink-500/90`).
  static const Color likeChip = Color(0xE6FF2D55);

  /// Chip tint when the save control is active.
  static const Color saveChip = Color(0xE6FF3D9A);

  // --- On-media text/icon colors ---
  static const Color onMedia = Colors.white;
  static const Color onMediaMuted = Color(0xB3FFFFFF); // white @ 70%

  // --- Gradients ---
  static const LinearGradient brandGradient = LinearGradient(
    colors: [brandPink, brandOrange],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Scrim under the bottom-left overlay so caption/author text stays legible.
  static const LinearGradient bottomScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x00000000), Color(0xCC000000), Color(0xF2000000)],
    stops: [0.45, 0.8, 1.0],
  );

  /// Scrim under a top bar.
  static const LinearGradient topScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x99000000), Color(0x00000000)],
  );

  /// Background for media-less or not-yet-loaded posts.
  static const LinearGradient fallbackMediaGradient = LinearGradient(
    colors: [brandPink, brandDeepPurple],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // --- Shadows ---
  /// Two-layer soft shadow that keeps text/icons legible over bright media.
  static const List<Shadow> textShadow = [
    Shadow(color: Color(0x99000000), blurRadius: 4, offset: Offset(0, 1)),
    Shadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 2)),
  ];

  // --- Text styles ---
  static const TextStyle countLabel = TextStyle(
    color: onMedia,
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.1,
    shadows: textShadow,
  );

  static const TextStyle authorName = TextStyle(
    color: onMedia,
    fontSize: 16,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.2,
    shadows: textShadow,
  );

  static const TextStyle caption = TextStyle(
    color: onMedia,
    fontSize: 14,
    fontWeight: FontWeight.w500,
    height: 1.32,
    letterSpacing: 0.05,
    shadows: textShadow,
  );

  static const TextStyle handle = TextStyle(
    color: onMediaMuted,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    shadows: textShadow,
  );

  /// Smaller muted meta row text (location, audio).
  static const TextStyle metaLabel = TextStyle(
    color: onMediaMuted,
    fontSize: 12.5,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
    shadows: textShadow,
  );

  // --- Sizing tokens ---
  static const double avatarSize = 48;
  static const double railGap = 16;
  static const double railIconSize = 26;

  /// Diameter of the circular chip behind each rail glyph.
  static const double railChipSize = 46;

  // --- Motion tokens ---
  /// Quick tap "pop" on rail/icon press.
  static const Duration motionPop = Duration(milliseconds: 160);

  /// Standard micro-interaction (tab underline, color cross-fades, dots).
  static const Duration motionFast = Duration(milliseconds: 220);

  /// Layout/size changes such as caption expand & page settle.
  static const Duration motionMedium = Duration(milliseconds: 300);

  /// The double-tap heart burst.
  static const Duration motionBurst = Duration(milliseconds: 720);

  /// Springy press feedback curve used across rail controls.
  static const Curve popCurve = Curves.easeOutBack;

  /// Smooth settle curve for size/opacity transitions.
  static const Curve settleCurve = Curves.easeOutCubic;

  /// Scale a control pops to on press.
  static const double pressPopScale = 1.22;

  // --- Pill / chip surfaces (more/less toggle, counters) ---
  static const Color pillBackground = Color(0xB3000000); // black @ 70%
  static const Color pillBorder = Color(0x1AFFFFFF); // white @ 10%

  /// Compact uppercase label used by the caption more/less pill.
  static const TextStyle pillLabel = TextStyle(
    color: onMedia,
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.6,
    height: 1.0,
  );
}
