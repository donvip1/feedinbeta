import 'package:flutter/material.dart';

/// Design tokens for the groups / message-rooms experience.
///
/// These are ported 1:1 from the web app's dark-mode CSS variables
/// (src/index.css, tailwind.config.ts) — the SAME token set the 1:1 chat
/// surface uses (see features/messages/chat/chat_theme.dart). They are
/// duplicated here (rather than imported from the messages feature) so this
/// module is fully self-contained and does not couple to another feature's
/// folder. Everything is `const` and depends only on the Flutter SDK, so it
/// analyzes cleanly on its own.
class GroupColors {
  const GroupColors._();

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
  static const Color online = Color(0xFF10B981); // emerald-500 online dot
  static const Color activeNow = Color(0xFF38BDF8); // sky-400 'Active now'
  static const Color ownerBadge = Color(0xFFFACC15); // yellow-400 owner crown
  static const Color adminBadge = Color(0xFF60A5FA); // blue-400 admin shield

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color barrier = Color(0x80000000); // black/50 modal backdrop
  static const Color primaryFaint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(0x33F04299); // primary @ 20%
  static const Color ownerBadgeBg = Color(0x33FACC15); // yellow @ 20%
  static const Color adminBadgeBg = Color(0x3360A5FA); // blue @ 20%

  // The other-user bubble surface (card with a subtle border).
  static const Color incomingBubble = card;
  static const Color incomingBubbleBorder = border;

  // Row-card surfaces (mirrors the web `TikTokConversationItem`): a faint
  // `bg-muted/20` fill with a `border-border/40` hairline.
  static const Color rowCard = Color(0x331D283A); // muted @ 20%
  static const Color rowCardBorder = Color(0x661D283A); // border @ 40%
}

/// Linear gradients matching the web `--gradient-*` tokens.
class GroupGradients {
  const GroupGradients._();

  /// Outgoing bubble (web `--gradient-primary`, 135deg #F04299 -> #ED5E76).
  static const LinearGradient outgoingBubble = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFED5E76)],
  );

  /// Send action + primary FAB (web `--gradient-accent`, #F04299 -> #BB67E4).
  static const LinearGradient sendAction = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFBB67E4)],
  );

  /// Group avatar fallback fill (web `from-primary/20 to-primary/40`).
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );
}

/// Corner radii. Web `--radius` = 0.75rem = 12px (lg=12, md=10, sm=8).
class GroupRadii {
  const GroupRadii._();

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
class GroupShadows {
  const GroupShadows._();

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
class GroupSpacing {
  const GroupSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double listItemMinHeight = 52;
  static const double headerHeight = 56; // h-14
  static const double avatarSm = 32; // member/bubble avatar
  static const double avatarMd = 44; // list row avatar (web w-11 h-11)
  static const double avatarLg = 56; // group header avatar
  static const double bubbleMaxWidthFraction = 0.78; // maxWidth 78%
}

/// Text styles for the groups surface. `fontFamily` is left unset so styles
/// inherit the app font; only size/weight/height/color are pinned for parity.
class GroupTextStyles {
  const GroupTextStyles._();

  static const TextStyle messageBody = TextStyle(
    fontSize: 15,
    height: 1.35,
    color: GroupColors.foreground,
  );

  static const TextStyle timestamp = TextStyle(
    fontSize: 11,
    color: GroupColors.mutedForeground,
  );

  static const TextStyle groupName = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    color: GroupColors.foreground,
  );

  static const TextStyle headerName = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: GroupColors.foreground,
  );

  static const TextStyle previewMuted = TextStyle(
    fontSize: 13,
    color: GroupColors.mutedForeground,
  );

  static const TextStyle previewUnread = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: GroupColors.foreground,
  );

  static const TextStyle subtitle = TextStyle(
    fontSize: 12,
    color: GroupColors.mutedForeground,
  );

  static const TextStyle senderLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    color: GroupColors.primaryGlow,
  );

  static const TextStyle badge = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: GroupColors.primaryForeground,
  );

  static const TextStyle sectionLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: GroupColors.mutedForeground,
  );

  static const TextStyle roleBadge = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
  );
}

/// Standard animation durations used across group micro-interactions.
class GroupMotion {
  const GroupMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
}
