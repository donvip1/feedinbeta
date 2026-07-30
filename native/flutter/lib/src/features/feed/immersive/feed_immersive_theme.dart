import 'package:flutter/material.dart';

/// Design tokens for FeedIn's immersive feed.
///
/// Everything is `static const` so the values can be embedded inside `const`
/// widgets across the immersive feed widgets.
class FeedImmersiveTheme {
  const FeedImmersiveTheme._();

  // -------------------------------------------------------------------------
  // Color system
  // -------------------------------------------------------------------------
  static const Color brandPink = Color(0xFFFF3D9A);
  static const Color brandOrange = Color(0xFFFF7A45);
  static const Color brandDeepPurple = Color(0xFF6B1FB3);
  static const Color brandViolet = Color(0xFF8B5CF6);

  /// Accent for @mentions in captions — distinct from the pink used for
  /// #hashtags, mirroring the prototype's cyan mention treatment.
  static const Color mentionCyan = Color(0xFF22D3EE);
  static const Color canvas = Color(0xFF070A12);
  static const Color mediaBackdrop = Colors.black;
  static const Color surface = Color(0xFF101521);
  static const Color surfaceElevated = Color(0xFF171E2E);
  static const Color mediaPlaceholder = Color(0xFF111111);
  static const Color ink = Colors.white;
  static const Color inkMuted = Color(0xB3FFFFFF);
  static const Color inkSubtle = Color(0x80FFFFFF);
  static const Color divider = Color(0x24FFFFFF);

  static const Color likeActive = Color(0xFFFF2D55);
  static const Color saveActive = brandPink;
  static const Color refeedActive = Color(0xFF55E68A);
  static const Color error = Color(0xFFFF6B7A);

  // Glass surfaces preserve media visibility while creating a stable control
  // contrast layer.
  static const Color glassSurface = Color(0x66101828);
  static const Color glassSurfaceStrong = Color(0xB30B101C);
  static const Color glassBorder = Color(0x33FFFFFF);
  static const Color glassHighlight = Color(0x22FFFFFF);
  static const Color glassFocusBorder = Color(0x66FFFFFF);
  static const Color overlayControlSoft = Color(0x40000000);
  static const Color railChip = Color(0x66000000);
  static const Color likeChip = Color(0xE6FF2D55);
  static const Color saveChip = Color(0xE6FF3D9A);
  static const Color refeedChip = Color(0x3322C55E);

  // Overlay strengths are named so scrims can be tuned without scattering
  // unexplained alpha literals throughout the feed.
  static const Color overlayBottomSoft = Color(0x66000000);
  static const Color overlayBottomStrong = Color(0xCC000000);
  static const Color overlayBottomMax = Color(0xF2000000);
  static const Color overlayTopStrong = Color(0x99000000);
  static const Color overlayControl = Color(0x55000000);
  static const Color progressBuffered = Color(0x66FFFFFF);
  static const Color progressTrack = Color(0x33FFFFFF);
  static const Color indicatorInactive = Color(0x61FFFFFF);
  static const Color mediaGlyphMuted = Color(0x66FFFFFF);
  static const Color audioDiscSurface = Color(0xDD101521);
  static const Color brandGlowColor = Color(0x55FF3D9A);

  // State opacity is separate from scrim colors: these values animate whole
  // widgets, while the overlay colors above tune media contrast.
  static const double opacityHidden = 0;
  static const double opacityDisabled = 0.38;
  static const double opacityInactive = 0.82;
  static const double opacityVisible = 1;

  // Backward-compatible aliases used by existing immersive widgets.
  static const Color onMedia = ink;
  static const Color onMediaMuted = inkMuted;

  // -------------------------------------------------------------------------
  // Gradients
  // -------------------------------------------------------------------------
  static const LinearGradient brandGradient = LinearGradient(
    colors: [brandPink, brandOrange],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Scrim under the bottom-left overlay so caption/author text stays legible.
  static const LinearGradient bottomScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Colors.transparent, overlayBottomStrong, overlayBottomMax],
    stops: [0.45, 0.8, 1.0],
  );

  /// Scrim under a top bar.
  static const LinearGradient topScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [overlayTopStrong, Colors.transparent],
  );

  static const LinearGradient sideScrim = LinearGradient(
    begin: Alignment.bottomLeft,
    end: Alignment.topRight,
    colors: [overlayBottomSoft, Colors.transparent],
  );

  /// Background for media-less or not-yet-loaded posts.
  static const LinearGradient fallbackMediaGradient = LinearGradient(
    colors: [brandPink, brandDeepPurple],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const SweepGradient audioDiscGradient = SweepGradient(
    colors: [brandPink, brandOrange, brandDeepPurple, brandPink],
  );

  // -------------------------------------------------------------------------
  // Elevation, glow, blur, and shadows
  // -------------------------------------------------------------------------
  static const double elevationNone = 0;
  static const double elevationControl = 4;
  static const double elevationFloating = 10;
  static const double elevationOverlay = 16;
  static const double blurControl = 8;
  static const double blurPill = 10;
  static const double blurStrong = 14;
  static const double glowBrand = 14;
  static const double glowHeart = 24;

  static const List<Shadow> textShadow = [
    Shadow(color: Color(0x99000000), blurRadius: 4, offset: Offset(0, 1)),
    Shadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 2)),
  ];
  static const List<BoxShadow> controlShadow = [
    BoxShadow(color: Color(0x55000000), blurRadius: 9, offset: Offset(0, 3)),
  ];
  static const List<BoxShadow> floatingShadow = [
    BoxShadow(color: Color(0x66000000), blurRadius: 16, offset: Offset(0, 4)),
  ];
  static const List<BoxShadow> brandGlow = [
    BoxShadow(color: brandGlowColor, blurRadius: glowBrand),
  ];
  static const List<BoxShadow> mediaControlShadow = [
    BoxShadow(color: overlayControl, blurRadius: 10, offset: Offset(0, 2)),
  ];

  // -------------------------------------------------------------------------
  // Typography
  // -------------------------------------------------------------------------
  static const TextStyle textPost = TextStyle(
    color: ink,
    fontSize: 28,
    height: 1.25,
    fontWeight: FontWeight.w800,
    shadows: textShadow,
  );
  static const TextStyle countLabel = TextStyle(
    color: ink,
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.1,
    shadows: textShadow,
  );

  static const TextStyle authorName = TextStyle(
    color: ink,
    fontSize: 16,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.2,
    shadows: textShadow,
  );

  static const TextStyle caption = TextStyle(
    color: ink,
    fontSize: 14,
    fontWeight: FontWeight.w500,
    height: 1.32,
    letterSpacing: 0.05,
    shadows: textShadow,
  );

  static const TextStyle handle = TextStyle(
    color: inkMuted,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    shadows: textShadow,
  );

  /// Smaller muted meta row text (location, audio).
  static const TextStyle metaLabel = TextStyle(
    color: inkMuted,
    fontSize: 12.5,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
    shadows: textShadow,
  );

  static const TextStyle chipLabel = TextStyle(
    color: ink,
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.05,
    shadows: textShadow,
  );
  static const TextStyle pillLabel = TextStyle(
    color: ink,
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.6,
    height: 1.0,
  );

  // -------------------------------------------------------------------------
  // Radius, spacing, icon sizes, and touch targets
  // -------------------------------------------------------------------------
  static const double radiusXs = 6;
  static const double radiusSm = 10;
  static const double radiusMd = 14;
  static const double radiusLg = 18;
  static const double radiusPill = 999;
  static const double spacingXs = 4;
  static const double spacingSm = 8;
  static const double spacingMd = 12;
  static const double spacingLg = 16;
  static const double spacingXl = 24;
  static const double avatarSize = 38;
  static const double railWidth = 44;
  static const double railMaxWidth = 52;
  static const double postRailInset = 64;
  static const double railRightInset = 10;
  static const double railGap = 6.5;
  static const double railIconSize = 18;
  static const double railChipSize = 35;
  static const double contentHorizontalPadding = 18;
  static const double overlayBottomPadding = 30;
  static const double overlayBottomHeight = 390;
  static const double overlayVignetteWidth = 260;
  static const double overlayVignetteHeight = 280;
  static const double carouselIndicatorBottom = 90;
  static const double carouselDotSize = 6;
  static const double carouselDotActiveWidth = 18;
  static const double overlayRadius = radiusLg;
  static const double iconXs = 14;
  static const double iconSm = 18;
  static const double iconMd = 22;
  static const double iconLg = 26;
  static const double iconXl = 48;
  static const double iconHero = 120;
  static const double touchTargetMin = 44;
  static const double touchTargetCompact = 48;
  static const double touchTargetAction = 50;
  static const double loadingIndicatorSm = 28;
  static const double loadingIndicatorMd = 34;
  static const double playbackFeedbackIcon = 56;
  static const double playbackFeedbackPadding = 14;
  static const double progressTrackHeight = 3;
  static const double audioDiscSize = 38;
  static const double audioDiscInset = 3;
  static const double muteControlRightInset = 10;
  static const double muteControlBottomInset = 14;

  // -------------------------------------------------------------------------
  // Motion durations and curves
  // -------------------------------------------------------------------------
  static const Duration motionInstant = Duration(milliseconds: 90);
  static const Duration motionPress = Duration(milliseconds: 150);
  static const Duration motionPop = Duration(milliseconds: 180);
  static const Duration motionFast = Duration(milliseconds: 220);
  static const Duration motionMedium = Duration(milliseconds: 300);
  static const Duration motionCaption = Duration(milliseconds: 340);
  static const Duration motionCarousel = Duration(milliseconds: 260);
  static const Duration motionSheet = Duration(milliseconds: 360);
  static const Duration motionSheetReverse = Duration(milliseconds: 260);
  static const Duration motionStatus = Duration(milliseconds: 280);
  static const Duration motionPlaybackFeedback = Duration(milliseconds: 240);
  static const Duration motionPlaybackFade = Duration(milliseconds: 190);
  static const Duration motionPlaybackVisible = Duration(milliseconds: 600);
  static const Duration motionBurst = Duration(milliseconds: 720);
  static const Duration motionLoading = Duration(milliseconds: 1200);
  static const Curve popCurve = Curves.easeOutBack;
  static const Curve settleCurve = Curves.easeOutCubic;
  static const Curve premiumSettleCurve = Cubic(0.22, 1, 0.36, 1);
  static const Curve sheetCurve = Cubic(0.16, 1, 0.3, 1);
  static const Curve sheetReverseCurve = Cubic(0.7, 0, 0.84, 0);
  static const Curve gentleCurve = Curves.easeInOut;
  static const double pressScale = 0.92;
  static const double hoverScale = 1.04;
  static const double pressPopScale = 1.22;

  // -------------------------------------------------------------------------
  // Pill / chip surfaces
  // -------------------------------------------------------------------------
  static const Color pillBackground = Color(0xB3000000); // black @ 70%
  static const Color pillBorder = Color(0x1AFFFFFF); // white @ 10%

  // -------------------------------------------------------------------------
  // Live indicator (feed tab)
  // -------------------------------------------------------------------------
  static const Color liveDot = brandPink;
  static const double liveDotSize = 7;
  static const Color liveDotGlow = Color(0x99FF3D9A);
  static const Duration motionLivePulse = Duration(milliseconds: 1100);

  // -------------------------------------------------------------------------
  // Glass bottom navigation
  // -------------------------------------------------------------------------
  /// Translucent canvas so the blurred media/backdrop shows through the bar,
  /// matching the prototype's `bg-feed-dark/95 backdrop-blur-xl` nav.
  static const Color navGlassSurface = Color(0xF0070A12);
  static const Color navBorderTop = Color(0x1FFFFFFF);
  static const double navBlur = 18;
  static const double navHeight = 64;

  /// Gradient create pill (center "+" action).
  static const LinearGradient createPillGradient = LinearGradient(
    colors: [brandPink, brandViolet],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );
  static const List<BoxShadow> createPillGlow = [
    BoxShadow(color: Color(0x4DFF3D9A), blurRadius: 16, offset: Offset(0, 4)),
  ];
  static const double createPillWidth = 48;
  static const double createPillHeight = 40;

  // -------------------------------------------------------------------------
  // Comment sheet surfaces
  // -------------------------------------------------------------------------
  static const Color sheetBarrier = Color(0xB3000000); // black @ 70%
  static const double sheetBarrierBlur = 6;
  static const Color sheetSurface = surface;
  static const Color sheetInputSurface = canvas;
  static const double sheetRadius = 28;
  static const double sheetHeightFactor = 0.66;
}
