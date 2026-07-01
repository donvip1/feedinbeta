import 'package:flutter/material.dart';

/// Design tokens for the Telegram-style Channels experience.
///
/// These are ported 1:1 from the web app's dark-mode CSS variables
/// (src/index.css, tailwind.config.ts) — the SAME token set the chat / groups
/// surfaces use (see features/groups/groups_theme.dart). They are duplicated
/// here (rather than imported from another feature) so this module is fully
/// self-contained and does not couple to another feature's folder. Everything
/// is `const` and depends only on the Flutter SDK, so it analyzes cleanly on
/// its own.
class ChannelColors {
  const ChannelColors._();

  // Brand / primary.
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
  static const Color online = Color(0xFF10B981); // emerald-500
  static const Color verified = Color(0xFF38BDF8); // sky-400 verified tick
  static const Color ownerBadge = Color(0xFFFACC15); // yellow-400 admin crown

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color barrier = Color(0x80000000); // black/50 modal backdrop
  static const Color primaryFaint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(0x33F04299); // primary @ 20%
  static const Color ownerBadgeBg = Color(0x33FACC15); // yellow @ 20%
  static const Color verifiedBg = Color(0x3338BDF8); // sky @ 20%

  // The broadcast post surface (card with a subtle border).
  static const Color postBubble = card;
  static const Color postBubbleBorder = border;

  // Row-card surfaces (mirrors the web `TikTokConversationItem`): a faint
  // `bg-muted/20` fill with a `border-border/40` hairline.
  static const Color rowCard = Color(0x331D283A); // muted @ 20%
  static const Color rowCardBorder = Color(0x661D283A); // border @ 40%
}

/// Linear gradients matching the web `--gradient-*` tokens.
class ChannelGradients {
  const ChannelGradients._();

  /// Send action + primary FAB (web `--gradient-accent`, #F04299 -> #BB67E4).
  static const LinearGradient sendAction = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFBB67E4)],
  );

  /// Channel avatar fallback fill (web `from-primary/20 to-primary/40`).
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Channel header banner wash used behind the header block.
  static const LinearGradient headerWash = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x33F04299), Color(0x00080C16)],
  );
}

/// Corner radii. Web `--radius` = 0.75rem = 12px (lg=12, md=10, sm=8).
class ChannelRadii {
  const ChannelRadii._();

  static const double lg = 12;
  static const double md = 10;
  static const double sm = 8;
  static const double pill = 999;
  static const double sheet = 16; // mobile bottom sheet rounded-t-2xl
  static const double bubbleRadius = 16; // web rounded-2xl

  static const BorderRadius bubble = BorderRadius.all(
    Radius.circular(bubbleRadius),
  );
  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius sheetTop = BorderRadius.only(
    topLeft: Radius.circular(sheet),
    topRight: Radius.circular(sheet),
  );
}

/// Box shadows matching `--shadow-*` (dark mode values).
class ChannelShadows {
  const ChannelShadows._();

  /// shadow-pink: 0 4px 20px rgba(#F04299, .25)
  static const List<BoxShadow> pink = [
    BoxShadow(color: Color(0x40F04299), blurRadius: 20, offset: Offset(0, 4)),
  ];

  /// shadow-glow: 0 0 40px rgba(#F0759E, .5)
  static const List<BoxShadow> glow = [
    BoxShadow(color: Color(0x80F0759E), blurRadius: 40),
  ];

  /// Soft neutral elevation used by sheets / popovers.
  static const List<BoxShadow> sheet = [
    BoxShadow(color: Color(0x66000000), blurRadius: 24, offset: Offset(0, -4)),
  ];
}

/// Spacing & sizing constants (44px tap targets, 52px list rows, 56px header).
class ChannelSpacing {
  const ChannelSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double listItemMinHeight = 64;
  static const double headerHeight = 56; // h-14
  static const double avatarSm = 32;
  static const double avatarMd = 48; // list row avatar
  static const double avatarLg = 72; // channel header avatar
  static const double postMaxWidthFraction = 0.86; // broadcast cards are wide
}

/// Text styles for the channels surface. `fontFamily` is left unset so styles
/// inherit the app font; only size/weight/height/color are pinned for parity.
class ChannelTextStyles {
  const ChannelTextStyles._();

  static const TextStyle postBody = TextStyle(
    fontSize: 15,
    height: 1.4,
    color: ChannelColors.foreground,
  );

  static const TextStyle timestamp = TextStyle(
    fontSize: 11,
    color: ChannelColors.mutedForeground,
  );

  static const TextStyle channelName = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    color: ChannelColors.foreground,
  );

  static const TextStyle headerName = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.3,
    color: ChannelColors.foreground,
  );

  static const TextStyle previewMuted = TextStyle(
    fontSize: 13,
    color: ChannelColors.mutedForeground,
  );

  static const TextStyle subtitle = TextStyle(
    fontSize: 12,
    color: ChannelColors.mutedForeground,
  );

  static const TextStyle badge = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: ChannelColors.primaryForeground,
  );

  static const TextStyle sectionLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: ChannelColors.mutedForeground,
  );

  static const TextStyle screenTitle = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.5,
    color: ChannelColors.foreground,
  );
}

/// Standard animation durations used across channel micro-interactions.
class ChannelMotion {
  const ChannelMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
}
