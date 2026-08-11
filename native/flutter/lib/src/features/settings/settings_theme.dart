/// Screen-local design tokens for the Settings parity refinement.
///
/// These values are COPIED (never imported) from the shared chat/notifications
/// surface tokens so Settings matches the rest of the native app while keeping
/// features decoupled. Everything here is `const` and depends only on the
/// Flutter SDK so it analyzes cleanly on its own.
///
/// Web parity references:
///   - src/components/settings/CacheSettings.tsx (titled cards, destructive btn)
///   - src/components/settings/PrivacySettingsPanel.tsx (tinted-icon toggle rows)
///   - src/components/settings/EncryptionSettings.tsx (status banners, headers)
///   - src/components/ui/card.tsx / switch.tsx (card + switch primitives)
library;

import 'package:flutter/material.dart';

/// Core palette — copied 1:1 from the brand dark theme (hsl(222 47% …)).
class SettingsColors {
  const SettingsColors._();

  // Brand / primary (web #F04299, hsl(330 85% 60%)).
  static const Color primary = Color(0xFFF04299);
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
  static const Color destructiveForeground = Color(0xFFFFFFFF);
  static const Color online = Color(0xFF10B981); // emerald-500
  static const Color amberWarning = Color(0xFFF59E0B); // amber-500
  static const Color blueInfo = Color(0xFF3B82F6); // blue-500

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color primarySoft = Color(0x1AF04299); // primary @ 10%
  static const Color mutedSoft = Color(0x66131C2B); // muted/50 fill
  static const Color iconBubble = Color(0x14F8FAFC); // muted icon bubble
  static const Color destructiveSoft = Color(0x1AEF4343); // destructive @ 10%
  static const Color onlineSoft = Color(0x1A10B981); // online @ 10%
  static const Color amberSoft = Color(0x1AF59E0B); // amber @ 10%

  /// Dim overlay painted over a thumbnail while an upload is in flight, so the
  /// spinner stays legible against arbitrary image content. background @ 60%.
  static const Color scrim = Color(0x99080C16);
}

/// Per-status accents for storage/maintenance banners.
class SettingsGradients {
  const SettingsGradients._();

  /// Brand primary -> accent (web bg-gradient-primary).
  static const LinearGradient primary = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );
}

/// Corner radii (web --radius 0.75rem = 12px).
class SettingsRadii {
  const SettingsRadii._();

  static const double lg = 12;
  static const double md = 10;
  static const double sm = 8;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(md));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
}

/// Spacing & sizing.
class SettingsSpacing {
  const SettingsSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double iconBubble = 38; // p-2 rounded-lg tinted bubble
}

/// Text styles. `fontFamily` left unset so the app font is inherited.
class SettingsTextStyles {
  const SettingsTextStyles._();

  /// Screen title ('Settings').
  static const TextStyle screenTitle = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: SettingsColors.foreground,
  );

  /// Card header title.
  static const TextStyle cardTitle = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: SettingsColors.foreground,
  );

  /// Card header description (muted).
  static const TextStyle cardDescription = TextStyle(
    fontSize: 13,
    height: 1.35,
    color: SettingsColors.mutedForeground,
  );

  /// Toggle / row title.
  static const TextStyle rowTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: SettingsColors.foreground,
  );

  /// Toggle / row description (muted).
  static const TextStyle rowDescription = TextStyle(
    fontSize: 13,
    height: 1.3,
    color: SettingsColors.mutedForeground,
  );

  /// Diagnostic chip / stat label.
  static const TextStyle statLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: SettingsColors.mutedForeground,
  );

  /// Diagnostic chip / stat value.
  static const TextStyle statValue = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: SettingsColors.foreground,
  );

  /// Action-button label.
  static const TextStyle button = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w700,
  );

  /// Status-banner message.
  static const TextStyle banner = TextStyle(fontSize: 13, height: 1.35);
}
