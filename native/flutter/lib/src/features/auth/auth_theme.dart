/// Screen-local design tokens for the Auth onboarding / sign-in parity polish.
///
/// COPIED (never imported) from the shared brand dark theme so Auth matches the
/// rest of the native app while staying decoupled. Everything is `const` and
/// depends only on the Flutter SDK so it analyzes cleanly on its own.
///
/// Web parity references:
///   - src/components/auth/SignInForm.tsx  (icon inputs, gradient submit, glow)
///   - src/components/auth/SignUpForm.tsx  (h-11 inputs, h-12 buttons)
///   - src/components/auth/ForgotPasswordForm.tsx (back link + gradient send)
library;

import 'package:flutter/material.dart';

/// Core palette — copied 1:1 from the brand dark theme (hsl(222 47% …)).
class AuthColors {
  const AuthColors._();

  // Brand / primary (web #F04299, hsl(330 85% 60%)) + accent (#E963BC).
  static const Color primary = Color(0xFFF04299);
  static const Color primaryGlow = Color(0xFFF0759E);
  static const Color accent = Color(0xFFE963BC);
  static const Color primaryForeground = Color(0xFFFFFFFF);

  // Surfaces.
  static const Color background = Color(0xFF080C16); // hsl(222 47% 6%)
  static const Color card = Color(0xFF0B111E); // hsl(222 47% 8%)
  static const Color input = Color(0xFF101826); // input field fill

  // Neutrals.
  static const Color muted = Color(0xFF1D283A); // hsl(217 33% 17%)
  static const Color border = Color(0xFF1D283A);

  // Text.
  static const Color foreground = Color(0xFFF8FAFC); // hsl(210 40% 98%)
  static const Color mutedForeground = Color(0xFF94A3B8); // hsl(215 20% 65%)

  // Status.
  static const Color destructive = Color(0xFFEF4343); // hsl(0 84% 60%)
  static const Color online = Color(0xFF10B981); // emerald-500

  // Translucent helpers.
  static const Color primarySoft = Color(0x1AF04299); // primary @ 10%
  static const Color destructiveSoft = Color(0x1AEF4343); // destructive @ 10%
  static const Color onlineSoft = Color(0x1A10B981); // online @ 10%
  static const Color mutedSoft = Color(0x66131C2B); // muted/50 fill

  // --- Brand gradient palette (copied from FeedImmersiveTheme) ---
  // The app's pink→orange brand used full-bleed behind the auth screens.
  static const Color brandPink = Color(0xFFFF3D9A);
  static const Color brandOrange = Color(0xFFFF7A45);

  // On-brand ink used for text/icons floating over the gradient.
  static const Color onBrand = Color(0xFFFFFFFF);
  static const Color onBrandMuted = Color(0xCCFFFFFF); // white @ 80%
  static const Color onBrandFaint = Color(0x99FFFFFF); // white @ 60%

  // Frosted surfaces that float over the gradient (borderless, glassy).
  static const Color glassFill = Color(0x1FFFFFFF); // white @ 12%
  static const Color glassFillStrong = Color(0x33FFFFFF); // white @ 20%
  static const Color glassLine = Color(0x40FFFFFF); // white @ 25% divider
  static const Color glassLineFaint = Color(0x24FFFFFF); // white @ 14% divider
  static const Color onBrandError = Color(0xFFFFE1E1); // soft error ink
  static const Color onBrandErrorFill = Color(0x33FF3D3D); // error wash
}

/// Gradients — the web `bg-gradient-primary` brand fill.
class AuthGradients {
  const AuthGradients._();

  static const LinearGradient primary = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Subtle brand wash behind the onboarding logo mark.
  static const LinearGradient brandMark = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Full-bleed pink→orange brand gradient behind the auth screens.
  /// Matches the app brand (FeedImmersiveTheme.brandGradient).
  static const LinearGradient brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AuthColors.brandPink, AuthColors.brandOrange],
  );
}

/// Brand glow shadow (web shadow-glow: 0 0 40px rgba(#F0759E, .5)).
class AuthShadows {
  const AuthShadows._();

  static const List<BoxShadow> glow = [
    BoxShadow(color: Color(0x66F0759E), blurRadius: 32, offset: Offset(0, 8)),
  ];

  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x40000000), blurRadius: 28, offset: Offset(0, 12)),
  ];
}

/// Corner radii (web --radius 0.75rem = 12px).
class AuthRadii {
  const AuthRadii._();

  static const double xl = 16;
  static const double lg = 12;
  static const double md = 10;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius field = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
}

/// Spacing & sizing.
class AuthSpacing {
  const AuthSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 28;

  static const double fieldHeight = 52; // web h-11/h-12 inputs/buttons
  static const double buttonHeight = 52;
}

/// Text styles. `fontFamily` left unset so the app font is inherited.
class AuthTextStyles {
  const AuthTextStyles._();

  /// Onboarding brand wordmark.
  static const TextStyle brand = TextStyle(
    fontSize: 34,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.5,
    color: AuthColors.foreground,
  );

  /// Onboarding tagline.
  static const TextStyle tagline = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w800,
    height: 1.15,
    color: AuthColors.foreground,
  );

  /// Card headline ('Welcome back').
  static const TextStyle headline = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w800,
    color: AuthColors.foreground,
  );

  /// Card subhead (muted).
  static const TextStyle subhead = TextStyle(
    fontSize: 14,
    height: 1.35,
    color: AuthColors.mutedForeground,
  );

  /// Field label.
  static const TextStyle label = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AuthColors.foreground,
  );

  /// Text entered in a field.
  static const TextStyle field = TextStyle(
    fontSize: 15,
    color: AuthColors.foreground,
  );

  /// Primary-button label.
  static const TextStyle button = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: AuthColors.primaryForeground,
  );

  /// Secondary/link button label.
  static const TextStyle link = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AuthColors.primary,
  );

  /// Status-notice message.
  static const TextStyle notice = TextStyle(fontSize: 13, height: 1.35);

  /// 'Or continue with' divider caption.
  static const TextStyle divider = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.6,
    color: AuthColors.mutedForeground,
  );

  // --- On-brand styles (white ink floating over the gradient) ---

  /// Brand wordmark shown over the gradient.
  static const TextStyle brandOnGradient = TextStyle(
    fontSize: 34,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.5,
    color: AuthColors.onBrand,
  );

  /// Screen headline ('Welcome back') over the gradient.
  static const TextStyle headlineOnBrand = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.3,
    color: AuthColors.onBrand,
  );

  /// Muted subhead over the gradient.
  static const TextStyle subheadOnBrand = TextStyle(
    fontSize: 15,
    height: 1.35,
    color: AuthColors.onBrandMuted,
  );

  /// Text typed into a borderless field over the gradient.
  static const TextStyle fieldOnBrand = TextStyle(
    fontSize: 16,
    color: AuthColors.onBrand,
  );

  /// Primary button label (brand-pink ink on the white CTA).
  static const TextStyle primaryButtonOnBrand = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.1,
    color: AuthColors.brandPink,
  );

  /// Google / frosted button label.
  static const TextStyle glassButton = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: AuthColors.onBrand,
  );
}
