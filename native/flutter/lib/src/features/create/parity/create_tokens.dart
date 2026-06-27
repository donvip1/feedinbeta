import 'package:flutter/material.dart';

/// Design tokens for the Create surface (post composer, media gallery picker,
/// stories create & viewer, and the upload-progress / queue UI).
///
/// Per the cross-screen-consistency rule these VALUES are copied verbatim from
/// the shared chat token set (`features/messages/chat/chat_theme.dart`) so the
/// whole app matches — but this file does NOT import the messages feature, to
/// keep the features decoupled. Everything here is `const` and depends only on
/// the Flutter SDK so it analyzes cleanly on its own and never reaches into
/// [Theme.of].
///
/// Usage:
///   color: CreateColors.primary,
///   decoration: BoxDecoration(gradient: CreateGradients.storyRing),
///   borderRadius: CreateRadii.card,
///   style: CreateTextStyles.composerHint,
class CreateColors {
  const CreateColors._();

  // Brand / primary (web messaging surface uses #F04299, copied here).
  static const Color primary = Color(0xFFF04299); // hsl(330 85% 60%)
  static const Color primaryForeground = Color(0xFFFFFFFF);
  static const Color primaryGlow = Color(0xFFF0759E); // hsl(340 80% 70%)
  static const Color accent = Color(0xFFE963BC); // hsl(320 75% 65%)

  // Surfaces.
  static const Color background = Color(0xFF080C16); // hsl(222 47% 6%)
  static const Color card = Color(0xFF0B111E); // hsl(222 47% 8%)
  static const Color popover = Color(0xFF0B111E);

  // Neutrals (muted == secondary == border == input in dark mode).
  static const Color muted = Color(0xFF1D283A); // hsl(217 33% 17%)
  static const Color secondary = Color(0xFF1D283A);
  static const Color border = Color(0xFF1D283A);
  static const Color input = Color(0xFF1D283A);

  // Text.
  static const Color foreground = Color(0xFFF8FAFC); // hsl(210 40% 98%)
  static const Color mutedForeground = Color(0xFF94A3B8); // hsl(215 20% 65%)

  // Status / accents.
  static const Color destructive = Color(0xFFEF4343); // hsl(0 84% 60%)
  static const Color success = Color(0xFF10B981); // emerald-500 (upload done)
  static const Color online = Color(0xFF10B981);
  static const Color amberWarning = Color(0xFFF59E0B); // amber-500 warnings

  // On-media foreground (story viewer / full-bleed media overlays).
  static const Color onMedia = Color(0xFFFFFFFF);

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color barrier = Color(0x80000000); // black/50 modal backdrop
  static const Color scrimStrong = Color(0xCC000000); // black/80 story overlay
  static const Color primaryFaint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(0x33F04299); // primary @ 20%
  static const Color whiteFaint = Color(0x1AFFFFFF); // white @ 10%
  static const Color whiteSoft = Color(0x33FFFFFF); // white @ 20%
  static const Color whiteTrack = Color(
    0x4DFFFFFF,
  ); // white @ 30% (segment track)
  static const Color blackTile = Color(0xFF000000); // camera/black picker bg
  static const Color videoScrim = Color(
    0x66000000,
  ); // dark scrim on video tiles
}

/// Linear gradients matching the web `--gradient-*` tokens + the two story
/// ring variants (classic + tiktok).
class CreateGradients {
  const CreateGradients._();

  /// Primary action gradient (Post button, story share). Web `--gradient-accent`
  /// (135deg #F04299 -> #BB67E4).
  static const LinearGradient primaryAction = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFBB67E4)],
  );

  /// Pink -> blue share/send gradient (parity with StoryShareButton).
  static const LinearGradient shareAction = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFF04299), Color(0xFF3B82F6)],
  );

  /// Avatar initials fallback fill.
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Classic stories ring (45deg #FF3399 -> #F42547 -> #FF7733). Copied from
  /// ChatGradients.story so the bar matches the rest of the app.
  static const LinearGradient storyRing = LinearGradient(
    begin: Alignment.bottomLeft,
    end: Alignment.topRight,
    colors: [Color(0xFFFF3399), Color(0xFFF42547), Color(0xFFFF7733)],
  );

  /// TikTok-style ring (yellow #FACC15 -> pink #EC4899 -> purple #9333EA).
  static const LinearGradient tiktokRing = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFACC15), Color(0xFFEC4899), Color(0xFF9333EA)],
  );

  /// Top scrim for story media legibility (black -> transparent).
  static const LinearGradient topScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x99000000), Color(0x00000000)],
  );

  /// Bottom scrim for story media legibility (transparent -> black).
  static const LinearGradient bottomScrim = LinearGradient(
    begin: Alignment.bottomCenter,
    end: Alignment.topCenter,
    colors: [Color(0x99000000), Color(0x00000000)],
  );

  /// Neutral placeholder fill shown while media loads / for missing sources.
  static const LinearGradient mediaPlaceholder = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF111827), Color(0xFF1D283A)],
  );
}

/// Corner radii. Web `--radius` = 0.75rem = 12px (lg=12, md=10, sm=8).
class CreateRadii {
  const CreateRadii._();

  static const double lg = 12;
  static const double md = 10;
  static const double sm = 8;
  static const double pill = 999;
  static const double sheet = 16; // bottom sheet rounded-t-2xl

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius field = BorderRadius.all(Radius.circular(md));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius sheetTop = BorderRadius.only(
    topLeft: Radius.circular(sheet),
    topRight: Radius.circular(sheet),
  );
}

/// Spacing & sizing constants (44px tap targets, 56px header).
class CreateSpacing {
  const CreateSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double headerHeight = 56; // h-14

  // Stories bar.
  static const double storyCircle = 64; // avatar diameter in the bar
  static const double storyRingWidth = 3; // gradient ring thickness
  static const double storyAvatar = 56; // inner avatar inside the ring

  // Story viewer.
  static const double progressSegmentHeight = 2; // 2px segment bars
  static const double storyAspect = 9 / 16; // 9:16 portrait preview/viewer

  // Media tray.
  static const double trayColumns = 3;
  static const double trayBadge = 22; // numbered selection badge diameter
}

/// Text styles for the Create surface. Web font is Inter; the app ships Roboto —
/// these leave `fontFamily` unset so they inherit the app font and only pin
/// size/weight/height/color for parity.
class CreateTextStyles {
  const CreateTextStyles._();

  static const TextStyle composerInput = TextStyle(
    fontSize: 15,
    height: 1.4,
    color: CreateColors.foreground,
  );

  static const TextStyle composerHint = TextStyle(
    fontSize: 15,
    height: 1.4,
    color: CreateColors.mutedForeground,
  );

  static const TextStyle sectionLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: CreateColors.mutedForeground,
  );

  static const TextStyle title = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: CreateColors.foreground,
  );

  static const TextStyle headline = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.3,
    color: CreateColors.foreground,
  );

  static const TextStyle pillLabel = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: CreateColors.foreground,
  );

  static const TextStyle pillLabelSelected = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: CreateColors.primaryForeground,
  );

  static const TextStyle buttonLabel = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: CreateColors.primaryForeground,
  );

  static const TextStyle counter = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: CreateColors.mutedForeground,
  );

  static const TextStyle helper = TextStyle(
    fontSize: 12,
    color: CreateColors.mutedForeground,
  );

  static const TextStyle warning = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: CreateColors.amberWarning,
  );

  static const TextStyle badge = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w800,
    color: CreateColors.primaryForeground,
  );

  static const TextStyle durationChip = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: CreateColors.onMedia,
  );

  // Story viewer overlay text (always on dark media).
  static const TextStyle storyAuthor = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w700,
    color: CreateColors.onMedia,
  );

  static const TextStyle storyTimestamp = TextStyle(
    fontSize: 12,
    color: Color(0xCCFFFFFF), // white @ 80%
  );

  static const TextStyle storyLabel = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: CreateColors.foreground,
  );

  static const TextStyle reactionBurst = TextStyle(fontSize: 96, height: 1.0);

  // Upload progress.
  static const TextStyle uploadStatus = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: CreateColors.foreground,
  );

  static const TextStyle uploadPercent = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: CreateColors.primary,
  );

  static const TextStyle overlayLabel = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: CreateColors.foreground,
  );
}

/// Shadows reused on cards / floating toasts (copied from chat values).
class CreateShadows {
  const CreateShadows._();

  /// shadow-pink: 0 4px 20px rgba(#F04299, .25)
  static const List<BoxShadow> pink = [
    BoxShadow(color: Color(0x40F04299), blurRadius: 20, offset: Offset(0, 4)),
  ];

  /// Soft neutral elevation for floating toast / sheets.
  static const List<BoxShadow> sheet = [
    BoxShadow(color: Color(0x66000000), blurRadius: 24, offset: Offset(0, -4)),
  ];

  static const List<BoxShadow> toast = [
    BoxShadow(color: Color(0x59000000), blurRadius: 18, offset: Offset(0, 6)),
  ];
}

/// Standard animation durations/curves used across Create micro-interactions.
class CreateMotion {
  const CreateMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 320);

  /// Story segment auto-advance durations (web parity: image 5s, video 15s).
  static const Duration storyImage = Duration(milliseconds: 5000);
  static const Duration storyVideo = Duration(milliseconds: 15000);

  /// Center reaction-burst float-up lifetime.
  static const Duration reactionBurst = Duration(milliseconds: 1500);

  static const Curve emphasized = Cubic(0.32, 0.72, 0, 1);
  static const Curve spring = Curves.easeOutBack;
}
