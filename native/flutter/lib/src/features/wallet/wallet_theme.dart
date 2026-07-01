import 'package:flutter/material.dart';

/// Screen-local design tokens for the Wallet / credit-token feature.
///
/// Values are COPIED 1:1 from the Profile parity token set
/// (`features/profile/parity/profile_tokens.dart`) so the Wallet surface
/// matches the rest of the dark-premium app WITHOUT importing another feature
/// (keeping the wallet module self-contained and independently analyzable).
///
/// Anything genuinely wallet-specific (the balance-card gradient, package /
/// tier tier-accent colors, the credit/token amber accent) lives here too and
/// is clearly labelled.
class WalletColors {
  const WalletColors._();

  // --- Brand / primary (copied from ProfileColors). ---
  static const Color primary = Color(0xFFF04299); // hsl(330 85% 60%)
  static const Color primaryForeground = Color(0xFFFFFFFF);
  static const Color accent = Color(0xFFE963BC); // hsl(320 75% 65%)

  // --- Surfaces (copied from ProfileColors). ---
  static const Color background = Color(0xFF080C16); // hsl(222 47% 6%)
  static const Color card = Color(0xFF0B111E); // hsl(222 47% 8%)

  /// card/50 — translucent cards.
  static const Color cardTranslucent = Color(0x800B111E);

  /// card/30 — faint container backgrounds.
  static const Color cardFaint = Color(0x4D0B111E);

  // --- Neutrals (muted == secondary == border == input). ---
  static const Color muted = Color(0xFF1D283A); // hsl(217 33% 17%)
  static const Color secondary = Color(0xFF1D283A);
  static const Color border = Color(0xFF1D283A);
  static const Color input = Color(0xFF1D283A);

  /// muted/50 — subtle hover / inactive pill surface.
  static const Color mutedHover = Color(0x801D283A);

  // --- Text (copied from ProfileColors). ---
  static const Color foreground = Color(0xFFF8FAFC); // hsl(210 40% 98%)
  static const Color mutedForeground = Color(0xFF94A3B8); // hsl(215 20% 65%)

  // --- Status / accents. ---
  static const Color destructive = Color(0xFFEF4343); // hsl(0 84% 60%)
  static const Color success = Color(0xFF10B981); // emerald-500
  static const Color warning = Color(0xFFF59E0B); // amber-500

  /// The credit / token accent (web uses amber "coins"): gold.
  static const Color token = Color(0xFFF5B301);

  // --- Translucent helpers (precomputed). ---
  static const Color barrier = Color(0x99000000); // black/60 modal backdrop
  static const Color primaryFaint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(0x33F04299); // primary @ 20%
  static const Color successFaint = Color(0x1A10B981); // success @ 10%
  static const Color destructiveFaint = Color(0x1AEF4343); // destructive @ 10%
  static const Color tokenFaint = Color(0x1AF5B301); // token @ 10%

  // --- Package / tier accent colors (web PackageCard tier styling). ---
  static const Color tierPremium = Color(0xFFF59E0B); // amber-500
  static const Color tierPro = primary;
  static const Color tierReseller = Color(0xFFA855F7); // purple-500
}

/// Linear gradients for the Wallet surface.
class WalletGradients {
  const WalletGradients._();

  /// Balance-card fill (web bg-gradient primary -> accent hero).
  static const LinearGradient balance = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Primary action gradient (Buy / Subscribe CTAs).
  static const LinearGradient action = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Premium package tint (web from-amber via-yellow to-orange).
  static const LinearGradient premium = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF59E0B), Color(0xFFF97316)],
  );

  /// Reseller package tint (web from-purple via-violet to-indigo).
  static const LinearGradient reseller = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF8B5CF6), Color(0xFF6366F1)],
  );

  /// Bonus badge (web from-green to-emerald).
  static const LinearGradient bonus = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFF22C55E), Color(0xFF10B981)],
  );
}

/// Corner radii (web --radius = 0.75rem = 12px).
class WalletRadii {
  const WalletRadii._();

  static const double lg = 16; // rounded-2xl cards
  static const double md = 12;
  static const double sm = 8;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius inner = BorderRadius.all(Radius.circular(md));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius sheetTop = BorderRadius.only(
    topLeft: Radius.circular(lg),
    topRight: Radius.circular(lg),
  );
}

/// Spacing & sizing constants.
class WalletSpacing {
  const WalletSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double packageCardWidth = 300;
}

/// Text styles for the Wallet surface. Leaves `fontFamily` unset so styles
/// inherit the app font; only pins size/weight/height/color.
class WalletTextStyles {
  const WalletTextStyles._();

  /// The big balance number (web text-4xl font-bold).
  static const TextStyle balanceValue = TextStyle(
    fontSize: 40,
    fontWeight: FontWeight.w800,
    height: 1.05,
    letterSpacing: -0.5,
    color: WalletColors.primaryForeground,
  );

  /// Balance sub-line (≈ local currency).
  static const TextStyle balanceSub = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: Color(0xE6FFFFFF), // white @ 90%
  );

  /// Uppercase "BALANCE" / section eyebrow.
  static const TextStyle eyebrow = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
    color: WalletColors.mutedForeground,
  );

  /// Section title (card headers).
  static const TextStyle sectionTitle = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: WalletColors.foreground,
  );

  /// Card / package name.
  static const TextStyle cardTitle = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    color: WalletColors.foreground,
  );

  /// Large credit count in a package (web text-4xl).
  static const TextStyle packageCredits = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w800,
    height: 1.0,
    color: WalletColors.foreground,
  );

  /// Price (web text-3xl font-bold primary).
  static const TextStyle price = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w800,
    color: WalletColors.primary,
  );

  /// Body / row primary text.
  static const TextStyle rowTitle = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: WalletColors.foreground,
  );

  /// Muted secondary / meta text.
  static const TextStyle rowMuted = TextStyle(
    fontSize: 12.5,
    color: WalletColors.mutedForeground,
  );

  /// Bold transaction amount.
  static const TextStyle amount = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w800,
  );

  /// Badge pill text.
  static const TextStyle badge = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    color: WalletColors.primaryForeground,
  );

  /// Button label.
  static const TextStyle button = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w700,
    color: WalletColors.primaryForeground,
  );

  /// Empty-state title.
  static const TextStyle emptyTitle = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: WalletColors.mutedForeground,
  );

  /// Empty-state subtitle.
  static const TextStyle emptySubtitle = TextStyle(
    fontSize: 12.5,
    color: WalletColors.mutedForeground,
  );
}
