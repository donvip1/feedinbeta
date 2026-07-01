import 'package:flutter/material.dart';

/// Design tokens for the full-screen, immersive call surfaces (outgoing,
/// incoming, in-call). Self-contained (depends only on the Flutter SDK) so the
/// calls module analyzes independently of the rest of the app.
///
/// Ported from the web call components under `src/components/calls/`
/// (`IncomingCall.tsx`, `CallControls.tsx`, `Call.tsx`): a dark
/// slate -> purple -> slate gradient backdrop, a pink brand primary, green
/// "accept", and red "decline / end". Values mirror the chat surface's dark
/// palette (`chat_theme.dart`) where they overlap so the two features feel
/// cohesive.
class CallColors {
  const CallColors._();

  // Brand primary (shared with chat surface).
  static const Color primary = Color(0xFFF04299);
  static const Color primaryForeground = Color(0xFFFFFFFF);

  // Immersive backdrop gradient stops (web
  // `from-slate-900 via-purple-900 to-slate-900`).
  static const Color backdropTop = Color(0xFF0F172A); // slate-900
  static const Color backdropMid = Color(0xFF3B0764); // purple-950/900 blend
  static const Color backdropBottom = Color(0xFF0F172A); // slate-900

  // Ambient blobs behind the avatar (web pink/blue blurred circles).
  static const Color blobPink = Color(0x33EC4899); // pink-500 @ 20%
  static const Color blobBlue = Color(0x333B82F6); // blue-500 @ 20%

  // Foreground text.
  static const Color foreground = Color(0xFFF8FAFC);
  static const Color mutedForeground = Color(0xFFCBD5E1); // slate-300
  static const Color subtle = Color(0xFF94A3B8); // slate-400

  // Action button surfaces.
  static const Color accept = Color(0xFF16A34A); // green-600
  static const Color acceptHi = Color(0xFF22C55E); // green-500
  static const Color decline = Color(0xFFDC2626); // red-600
  static const Color declineHi = Color(0xFFEF4444); // red-500

  // Neutral control chip (web `bg-white/10`).
  static const Color controlChip = Color(0x1AFFFFFF); // white @ 10%
  static const Color controlChipActive = Color(0x33FFFFFF); // white @ 20%
  static const Color controlIcon = Color(0xFFFFFFFF);

  // Danger-tinted / active control states.
  static const Color mutedControlBg = Color(0x33EF4444); // red-500 @ 20%
  static const Color mutedControlFg = Color(0xFFF87171); // red-400
  static const Color activeControlBg = Color(0x33F04299); // primary @ 20%
  static const Color activeControlFg = Color(0xFFF472B6); // pink-400

  // Video placeholder surfaces.
  static const Color videoPlaceholder = Color(0xFF000000);
  static const Color videoPlaceholderTop = Color(0xFF111827); // gray-900
  static const Color videoPlaceholderBottom = Color(0xFF1F2937); // gray-800
  static const Color localTileBorder = Color(0x33FFFFFF); // white @ 20%

  // Status dot colours.
  static const Color online = Color(0xFF22C55E); // green-500
  static const Color connecting = Color(0xFFEAB308); // yellow-500

  // Avatar ring.
  static const Color avatarRing = primary;
}

/// The full-screen call backdrop gradient (web
/// `bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900`).
class CallGradients {
  const CallGradients._();

  static const LinearGradient backdrop = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      CallColors.backdropTop,
      CallColors.backdropMid,
      CallColors.backdropBottom,
    ],
  );

  /// Avatar initials fallback fill (web `from-pink-600 to-rose-600`).
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDB2777), Color(0xFFE11D48)],
  );

  /// Video placeholder gradient.
  static const LinearGradient videoPlaceholder = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      CallColors.videoPlaceholderTop,
      CallColors.videoPlaceholderBottom,
    ],
  );
}

/// Sizing constants for the immersive call layout.
class CallSizing {
  const CallSizing._();

  static const double heroAvatar = 144; // web w-36 h-36
  static const double controlButton = 56; // web w-14 h-14
  static const double primaryActionButton = 80; // web w-20 h-20 (decline)
  static const double acceptActionButton = 96; // web w-24 h-24 (accept)
  static const double endCallButton = 64; // web w-16 h-16
  static const double localVideoWidth = 108;
  static const double localVideoHeight = 156;
}

/// Text styles for the call surfaces.
class CallTextStyles {
  const CallTextStyles._();

  static const TextStyle callerName = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: CallColors.foreground,
  );

  static const TextStyle statusLine = TextStyle(
    fontSize: 18,
    color: CallColors.mutedForeground,
  );

  static const TextStyle duration = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w500,
    letterSpacing: 1,
    color: CallColors.foreground,
  );

  static const TextStyle actionLabel = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: CallColors.mutedForeground,
  );

  static const TextStyle avatarInitial = TextStyle(
    fontSize: 44,
    fontWeight: FontWeight.w600,
    color: CallColors.primaryForeground,
  );
}

/// Standard animation durations for call micro-interactions (ring pulse etc.).
class CallMotion {
  const CallMotion._();

  static const Duration ringPulse = Duration(milliseconds: 1400);
  static const Duration fast = Duration(milliseconds: 180);
}
