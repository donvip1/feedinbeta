import 'package:flutter/material.dart';

/// Design tokens for the "find friends from contacts" surface.
///
/// Ported 1:1 from the brand dark theme (hsl(222 47% …)) — the SAME token set
/// the chat / channels / settings surfaces use. Duplicated here (rather than
/// imported from another feature) so this module is fully self-contained and
/// does not couple to another feature's folder. Everything is `const` and
/// depends only on the Flutter SDK, so it analyzes cleanly on its own.
class ContactsColors {
  const ContactsColors._();

  // Brand / primary.
  static const Color primary = Color(0xFFF04299); // hsl(330 85% 60%)
  static const Color primaryForeground = Color(0xFFFFFFFF);

  // Surfaces.
  static const Color background = Color(0xFF080C16); // hsl(222 47% 6%)
  static const Color card = Color(0xFF0B111E); // hsl(222 47% 8%)
  static const Color cardElevated = Color(0xFF111A2B); // subtle inner fill

  // Neutrals (muted == secondary == border == input in dark mode).
  static const Color muted = Color(0xFF1D283A); // hsl(217 33% 17%)
  static const Color border = Color(0xFF1D283A);

  // Text.
  static const Color foreground = Color(0xFFF8FAFC); // hsl(210 40% 98%)
  static const Color mutedForeground = Color(0xFF94A3B8); // hsl(215 20% 65%)

  // Status / accents.
  static const Color destructive = Color(0xFFEF4343); // hsl(0 84% 60%)
  static const Color online = Color(0xFF10B981); // emerald-500

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color primaryFaint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(0x33F04299); // primary @ 20%
  static const Color mutedSoft = Color(0x66131C2B); // muted/50 fill
  static const Color rowCard = Color(0x331D283A); // muted @ 20%
  static const Color rowCardBorder = Color(0x661D283A); // border @ 40%
}

/// Linear gradients matching the web `--gradient-*` tokens.
class ContactsGradients {
  const ContactsGradients._();

  /// Primary action gradient (web `--gradient-accent`, #F04299 -> #BB67E4).
  static const LinearGradient primary = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFBB67E4)],
  );

  /// Avatar fallback fill (web `from-primary/20 to-primary/40`).
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );
}

/// Box shadows matching `--shadow-*` (dark mode values).
class ContactsShadows {
  const ContactsShadows._();

  /// shadow-pink: 0 4px 20px rgba(#F04299, .25)
  static const List<BoxShadow> pink = [
    BoxShadow(color: Color(0x40F04299), blurRadius: 20, offset: Offset(0, 4)),
  ];

  /// shadow-glow: 0 0 40px rgba(#F0759E, .5)
  static const List<BoxShadow> glow = [
    BoxShadow(color: Color(0x80F0759E), blurRadius: 40),
  ];
}

/// Corner radii (web `--radius` = 0.75rem = 12px).
class ContactsRadii {
  const ContactsRadii._();

  static const double lg = 12;
  static const double md = 10;
  static const double sm = 8;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(md));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
}

/// Spacing & sizing constants.
class ContactsSpacing {
  const ContactsSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double avatar = 44; // list row avatar
}

/// Text styles for the contacts surface. `fontFamily` is left unset so styles
/// inherit the app font; only size/weight/height/color are pinned for parity.
class ContactsTextStyles {
  const ContactsTextStyles._();

  static const TextStyle screenTitle = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.5,
    color: ContactsColors.foreground,
  );

  static const TextStyle sectionLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: ContactsColors.mutedForeground,
  );

  static const TextStyle rowTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    color: ContactsColors.foreground,
  );

  static const TextStyle rowSubtitle = TextStyle(
    fontSize: 13,
    color: ContactsColors.mutedForeground,
  );

  static const TextStyle emptyTitle = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.3,
    color: ContactsColors.foreground,
  );

  static const TextStyle emptyBody = TextStyle(
    fontSize: 13,
    height: 1.4,
    color: ContactsColors.mutedForeground,
  );
}
