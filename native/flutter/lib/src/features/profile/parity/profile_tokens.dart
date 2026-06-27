import 'package:flutter/material.dart';

/// Screen-local design tokens for the Profile parity rebuild.
///
/// The VALUES here are COPIED 1:1 from the chat token set
/// (`features/messages/chat/chat_theme.dart`) so the Profile surface matches
/// the rest of the app, WITHOUT importing the messages feature (keeping the two
/// features decoupled). Everything is `const` and depends only on the Flutter
/// SDK so this file analyzes cleanly on its own and can be shared by every
/// profile widget without reaching into [Theme.of].
///
/// Anything that is genuinely Profile-specific (the text-post 3-stop gradient,
/// the role/plan gradient maps, the per-network social brand colors, the
/// black/70 badge + black/20 video scrim helpers) lives here too and is clearly
/// labelled as such.
///
/// Usage:
///   color: ProfileColors.primary,
///   decoration: BoxDecoration(gradient: ProfileGradients.avatarFallback),
///   borderRadius: ProfileRadii.card,
///   style: ProfileTextStyles.statValue,
class ProfileColors {
  const ProfileColors._();

  // --- Brand / primary (copied from ChatColors). ---
  static const Color primary = Color(0xFFF04299); // hsl(330 85% 60%)
  static const Color primaryForeground = Color(0xFFFFFFFF);
  static const Color primaryGlow = Color(0xFFF0759E); // hsl(340 80% 70%)
  static const Color accent = Color(0xFFE963BC); // hsl(320 75% 65%)

  // --- Surfaces (copied from ChatColors). ---
  static const Color background = Color(0xFF080C16); // hsl(222 47% 6%)
  static const Color card = Color(0xFF0B111E); // hsl(222 47% 8%)
  static const Color popover = Color(0xFF0B111E);

  /// card/50 (bg-card/50): #0B111E @ 50% — translucent Details/Social cards.
  static const Color cardTranslucent = Color(0x800B111E);

  /// card/30 (bg-card/30): #0B111E @ 30% — posts-grid container background.
  static const Color cardFaint = Color(0x4D0B111E);

  // --- Neutrals (copied from ChatColors; muted==secondary==border==input). ---
  static const Color muted = Color(0xFF1D283A); // hsl(217 33% 17%)
  static const Color secondary = Color(0xFF1D283A);
  static const Color border = Color(0xFF1D283A);
  static const Color input = Color(0xFF1D283A);

  /// muted/50 — subtle hover surface on list rows (web hover:bg-muted/50).
  static const Color mutedHover = Color(0x801D283A);

  // --- Text (copied from ChatColors). ---
  static const Color foreground = Color(0xFFF8FAFC); // hsl(210 40% 98%)
  static const Color mutedForeground = Color(0xFF94A3B8); // hsl(215 20% 65%)

  // --- Status / accents (copied from ChatColors). ---
  static const Color destructive = Color(0xFFEF4343); // hsl(0 84% 60%)
  static const Color online = Color(0xFF10B981); // emerald-500
  static const Color amberWarning = Color(0xFFF59E0B); // amber-500

  // --- Translucent helpers (precomputed; copied from ChatColors). ---
  static const Color barrier = Color(0x80000000); // black/50 modal backdrop
  static const Color primaryFaint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(0x33F04299); // primary @ 20%

  /// destructive/10 — Clear-history / Delete ghost-button hover wash.
  static const Color destructiveFaint = Color(0x1AEF4343);

  // --- Profile-specific overlay helpers. ---
  /// black/70 — view-count pill on post tiles (bg-black/70).
  static const Color tileBadgeScrim = Color(0xB3000000);

  /// black/20 — video-tile play-overlay scrim (bg-black/20).
  static const Color videoScrim = Color(0x33000000);

  /// black/40 — full-screen image-viewer backdrop.
  static const Color imageViewerBackdrop = Color(0xCC000000);

  // --- Per-network social brand colors (Profile-specific). ---
  // Single-color networks render as a flat fill; the two gradient networks
  // (Instagram, Website) use ProfileGradients.* below.
  static const Color socialTwitter = Color(0xFF3B82F6); // blue-500
  static const Color socialLinkedin = Color(0xFF1D4ED8); // blue-700
  static const Color socialFacebook = Color(0xFF2563EB); // blue-600
  static const Color socialTiktokBg = Color(0xFFFFFFFF); // white
  static const Color socialTiktokFg = Color(0xFF000000); // black text/icon
  static const Color socialYoutube = Color(0xFFDC2626); // red-600
}

/// Linear gradients. Brand gradients are copied from `ChatGradients`; the
/// remaining role/plan/social/text-post gradients are Profile-specific maps
/// that mirror the web tailwind `from-*/to-*` utilities.
class ProfileGradients {
  const ProfileGradients._();

  /// Avatar initials fallback fill (copied from ChatGradients.avatarFallback):
  /// primary -> accent, top-left to bottom-right (web from-primary to-accent).
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Cover placeholder when no cover_url. Web: from-primary/40 via-accent/30
  /// to-background. Retuned onto chat tokens per the spec.
  static const LinearGradient coverPlaceholder = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0x66F04299), Color(0x4DE963BC), Color(0xFF080C16)],
    stops: [0.0, 0.45, 1.0],
  );

  /// Generic action gradient (Follow / Chat buttons): primary -> accent,
  /// left to right (web bg-gradient-to-r from-primary to-accent).
  static const LinearGradient action = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Text-only post tile: 3-stop purple -> pink -> orange (web
  /// from-purple-600 via-pink-500 to-orange-500). Distinct from chat gradients.
  static const LinearGradient textPostTile = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF9333EA), Color(0xFFEC4899), Color(0xFFF97316)],
  );

  // --- Role badge gradients (br = bottom-right, web bg-gradient-to-br). ---
  static const LinearGradient roleSuperAdmin = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF59E0B), Color(0xFFEF4444)], // amber-500 -> red-500
  );
  static const LinearGradient roleDeveloper = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF8B5CF6), Color(0xFF9333EA)], // violet-500 -> purple-600
  );
  static const LinearGradient roleAdmin = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3B82F6), Color(0xFF06B6D4)], // blue-500 -> cyan-500
  );
  static const LinearGradient roleModerator = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF22C55E), Color(0xFF10B981)], // green-500 -> emerald-500
  );

  // --- Plan badge gradients. ---
  static const LinearGradient planPremium = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEAB308), Color(0xFFF97316)], // yellow-500 -> orange-500
  );
  static const LinearGradient planPro = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFA855F7), Color(0xFFEC4899)], // purple-500 -> pink-500
  );
  static const LinearGradient planPopular = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3B82F6), Color(0xFF6366F1)], // blue-500 -> indigo-500
  );

  // --- Social brand gradients (the two networks that use gradients). ---
  static const LinearGradient socialInstagram = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFDB2777), Color(0xFFE11D48)], // pink-600 -> rose-600
  );
  static const LinearGradient socialWebsite = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFF9333EA), Color(0xFF2563EB)], // purple-600 -> blue-600
  );
}

/// Corner radii. Web `--radius` = 0.75rem = 12px (lg=12, md=10, sm=8); copied
/// from `ChatRadii`. Social card rounded-xl == lg(12); social pills rounded-lg
/// == sm(8); badge pills rounded-full == pill.
class ProfileRadii {
  const ProfileRadii._();

  static const double lg = 12;
  static const double md = 10;
  static const double sm = 8;
  static const double pill = 999;
  static const double sheet = 16; // bottom sheet rounded-t-2xl

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius sheetTop = BorderRadius.only(
    topLeft: Radius.circular(sheet),
    topRight: Radius.circular(sheet),
  );
}

/// Spacing & sizing constants. Base scale copied from `ChatSpacing`; the
/// Profile-specific sizes (cover height, avatar diameter, etc.) are added.
class ProfileSpacing {
  const ProfileSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;

  // --- Header sizing (web parity). ---
  static const double coverHeight = 256; // web h-64
  static const double avatarDiameter = 128; // web w-32/h-32
  static const double avatarBorderWidth = 4; // web 4px background-colored ring
  static const double avatarOverlap = 80; // web -mt-20 pull-up over cover

  // --- Avatar sizes used in tiles/rows (web w-12 = 48). ---
  static const double avatarRow = 48;

  // --- Scrollable list heights (web fixed pixel heights). ---
  static const double modalListHeight = 400; // ScrollArea h-[400px]
  static const double postsGridMaxHeight = 480; // grid max-h-[480px]
  static const double historyCollapsedMaxHeight = 300; // max-h-[300px]
  static const double historyExpandedHeight = 400; // h-[400px]
}

/// Text styles for the Profile surface. Leaves `fontFamily` unset so styles
/// inherit the app font; only pins size/weight/height/color for parity.
class ProfileTextStyles {
  const ProfileTextStyles._();

  /// Centered display name (web text-2xl font-bold).
  static const TextStyle displayName = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    height: 1.2,
    color: ProfileColors.foreground,
  );

  /// @handle line (web muted-foreground).
  static const TextStyle handle = TextStyle(
    fontSize: 15,
    color: ProfileColors.mutedForeground,
  );

  /// Bio paragraph (relaxed line height).
  static const TextStyle bio = TextStyle(
    fontSize: 14,
    height: 1.55,
    color: ProfileColors.foreground,
  );

  /// Bold stat value (web text-2xl font-bold).
  static const TextStyle statValue = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    color: ProfileColors.foreground,
  );

  /// Muted stat label under the value (web text-xs muted).
  static const TextStyle statLabel = TextStyle(
    fontSize: 12,
    color: ProfileColors.mutedForeground,
  );

  /// Meta row text (location / occupation / website pill).
  static const TextStyle meta = TextStyle(
    fontSize: 13,
    color: ProfileColors.mutedForeground,
  );

  /// Card section header ("Social Links", "View History").
  static const TextStyle sectionTitle = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: ProfileColors.foreground,
  );

  /// Row primary name (modals / history rows).
  static const TextStyle rowName = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: ProfileColors.foreground,
  );

  /// Row secondary @username / muted body (modals / history rows).
  static const TextStyle rowMuted = TextStyle(
    fontSize: 13,
    color: ProfileColors.mutedForeground,
  );

  /// Badge pill text (web text-[10px] font-semibold white).
  static const TextStyle badge = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w600,
    color: ProfileColors.primaryForeground,
  );

  /// Social pill label (web text-sm font-medium white).
  static const TextStyle socialPill = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: ProfileColors.primaryForeground,
  );

  /// 'Last 48h' / 'Not Friends' tiny muted pill text.
  static const TextStyle tinyPill = TextStyle(
    fontSize: 11,
    color: ProfileColors.mutedForeground,
  );

  /// White caption inside a text-only post tile (web text-xs font-medium).
  static const TextStyle textTileCaption = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.25,
    color: ProfileColors.primaryForeground,
  );

  /// Empty-state title (centered muted).
  static const TextStyle emptyTitle = TextStyle(
    fontSize: 14,
    color: ProfileColors.mutedForeground,
  );

  /// Empty-state sub-line (centered, fainter).
  static const TextStyle emptySubtitle = TextStyle(
    fontSize: 12,
    color: ProfileColors.mutedForeground,
  );
}

/// Box shadows for the Profile surface (copied / adapted from `ChatShadows`).
class ProfileShadows {
  const ProfileShadows._();

  /// Avatar elevation (web shadow on the 128px avatar ring).
  static const List<BoxShadow> avatar = [
    BoxShadow(color: Color(0x40000000), blurRadius: 16, offset: Offset(0, 6)),
  ];

  /// Badge pill soft shadow (web shadow-md).
  static const List<BoxShadow> badge = [
    BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2)),
  ];

  /// Social pill shadow (web shadow-lg).
  static const List<BoxShadow> socialPill = [
    BoxShadow(color: Color(0x40000000), blurRadius: 12, offset: Offset(0, 4)),
  ];
}
