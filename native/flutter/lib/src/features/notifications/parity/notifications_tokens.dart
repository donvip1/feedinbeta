/// Screen-local design tokens for the Notifications parity rebuild.
///
/// These values are COPIED (never imported) from the chat surface tokens at
/// `native/flutter/lib/src/features/messages/chat/chat_theme.dart` so the
/// Notifications screen matches the rest of the app while keeping features
/// decoupled. Everything here is `const` and depends only on the Flutter SDK
/// so it analyzes cleanly on its own.
///
/// Web parity references:
///   - src/components/notifications/NotificationItem.tsx (typed cards, deep links)
///   - src/components/notifications/NotificationPreferences.tsx (toggle list)
///   - src/components/notifications/NotificationBell.tsx (bell + badge)
///   - src/components/notifications/BadgeCelebration.tsx (badge gradients/icons)
///
/// Usage:
///   color: NotificationColors.primary,
///   borderRadius: NotificationRadii.card,
///   style: NotificationTextStyles.cardTitleUnread,
///   final accent = NotificationTypePalette.accentFor(NotificationKind.like);
library;

import 'package:flutter/material.dart';

/// Core palette — copied 1:1 from `ChatColors`.
class NotificationColors {
  const NotificationColors._();

  // Brand / primary (web messaging surface #F04299, hsl(330 85% 60%)).
  static const Color primary = Color(0xFFF04299);
  static const Color primaryForeground = Color(0xFFFFFFFF);
  static const Color primaryGlow = Color(0xFFF0759E);
  static const Color accent = Color(0xFFE963BC);

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
  static const Color destructiveForeground = Color(0xFFFFFFFF);
  static const Color online = Color(0xFF10B981); // emerald-500
  static const Color amberWarning = Color(0xFFF59E0B); // amber-500

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color barrier = Color(0x99000000); // black/60 modal backdrop
  static const Color barrierSoft = Color(0x33000000); // black/20 panel backdrop
  // Unread row tint == web `bg-accent/50` -> primary @ 10% (ChatColors.primaryFaint).
  static const Color unreadTint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(0x33F04299); // primary @ 20%
  // Soft fill behind a tinted type icon (accent @ ~14%); used per-type at runtime.
  static const Color iconBubbleFallback = Color(0x24F04299);
}

/// Per-notification-type accent palette + icon map.
///
/// Ports the web per-category icon/color assignment (lucide -> Material):
///   like        Heart / pink (#F04299)
///   comment     MessageCircle / blue (#3B82F6)
///   reply       MessageCircle / blue (#3B82F6)
///   mention     AtSign / blue (#3B82F6)
///   follow      Users / purple (#8B5CF6)
///   message     MessageCircle / green (#10B981)
///   friend      UserPlus / cyan (#06B6D4)
///   story       Zap / yellow (#F59E0B)
///   system      Bell / muted (default)
///   badge       Award / primary
class NotificationTypePalette {
  const NotificationTypePalette._();

  // Per-type accent colors (literal Tailwind palette values for parity).
  static const Color likePink = Color(0xFFF04299);
  static const Color commentBlue = Color(0xFF3B82F6); // blue-500
  static const Color followPurple = Color(0xFF8B5CF6); // violet-500
  static const Color messageGreen = Color(0xFF10B981); // emerald-500
  static const Color friendCyan = Color(0xFF06B6D4); // cyan-500
  static const Color storyYellow = Color(0xFFF59E0B); // amber-500
  static const Color systemMuted = Color(0xFF94A3B8); // muted-foreground
  static const Color badgeGold = Color(0xFFF59E0B);

  /// Accent color for a notification kind (used for type-badge fill + icon).
  static Color accentFor(NotificationKindToken kind) {
    return switch (kind) {
      NotificationKindToken.like => likePink,
      NotificationKindToken.comment => commentBlue,
      NotificationKindToken.reply => commentBlue,
      NotificationKindToken.mention => commentBlue,
      NotificationKindToken.follow => followPurple,
      NotificationKindToken.message => messageGreen,
      NotificationKindToken.friendRequest => friendCyan,
      NotificationKindToken.friendRequestAccepted => friendCyan,
      NotificationKindToken.story => storyYellow,
      NotificationKindToken.badge => badgeGold,
      NotificationKindToken.system => systemMuted,
    };
  }

  /// Material icon for a notification kind (lucide equivalent).
  static IconData iconFor(NotificationKindToken kind) {
    return switch (kind) {
      NotificationKindToken.like => Icons.favorite, // Heart
      NotificationKindToken.comment => Icons.mode_comment, // MessageCircle
      NotificationKindToken.reply => Icons.reply, // reply arrow
      NotificationKindToken.mention => Icons.alternate_email, // AtSign
      NotificationKindToken.follow => Icons.group, // Users
      NotificationKindToken.message => Icons.chat_bubble, // MessageCircle
      NotificationKindToken.friendRequest => Icons.person_add_alt_1, // UserPlus
      NotificationKindToken.friendRequestAccepted => Icons.how_to_reg,
      NotificationKindToken.story => Icons.bolt, // Zap
      NotificationKindToken.badge => Icons.workspace_premium, // Award
      NotificationKindToken.system => Icons.notifications, // Bell
    };
  }

  /// 14%-alpha fill behind the tinted type icon for a kind.
  /// (Computed at call time so the accent stays the single source of truth.)
  static Color iconBubbleFor(NotificationKindToken kind) {
    return accentFor(kind).withValues(alpha: 0.14);
  }
}

/// Lightweight token-layer mirror of the presentational notification kinds.
///
/// Kept in the token file (rather than importing the view-model file) so the
/// per-type icon/color map is fully self-contained. The view-model file
/// re-exports the same enum shape via [NotificationKind]; both share names so
/// callers map 1:1.
enum NotificationKindToken {
  like,
  comment,
  reply,
  mention,
  follow,
  message,
  friendRequest,
  friendRequestAccepted,
  story,
  badge,
  system,
}

/// Linear gradients — copied from `ChatGradients` plus the per-badge-key
/// celebration gradients ported from BadgeCelebration.tsx (literal Tailwind
/// palette values, NOT tokens).
class NotificationGradients {
  const NotificationGradients._();

  /// Avatar initials fallback fill (ChatGradients.avatarFallback).
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Gradient 'Save Preferences' button (web from-pink-500 to-blue-500).
  static const LinearGradient saveAction = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFF04299), Color(0xFF3B82F6)],
  );

  /// Default badge gradient fallback (brand primary -> accent).
  static const LinearGradient badgeDefault = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  // Per-badge-key 3-stop gradients (super_admin..popular), Tailwind literals.
  static const LinearGradient badgeSuperAdmin = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF59E0B), Color(0xFFEF4444), Color(0xFFF97316)],
  ); // amber-500 -> red-500 -> orange-500
  static const LinearGradient badgeDeveloper = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF8B5CF6), Color(0xFF9333EA), Color(0xFF6366F1)],
  ); // violet-500 -> purple-600 -> indigo-500
  static const LinearGradient badgeAdmin = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3B82F6), Color(0xFF06B6D4), Color(0xFF14B8A6)],
  ); // blue-500 -> cyan-500 -> teal-500
  static const LinearGradient badgeModerator = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF22C55E), Color(0xFF10B981), Color(0xFF14B8A6)],
  ); // green-500 -> emerald-500 -> teal-500
  static const LinearGradient badgePremium = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEAB308), Color(0xFFF97316), Color(0xFFF59E0B)],
  ); // yellow-500 -> orange-500 -> amber-500
  static const LinearGradient badgePro = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFA855F7), Color(0xFFEC4899), Color(0xFFF43F5E)],
  ); // purple-500 -> pink-500 -> rose-500
  static const LinearGradient badgePopular = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFFA855F7)],
  ); // blue-500 -> indigo-500 -> purple-500
}

/// Corner radii — copied from `ChatRadii` (web --radius 0.75rem = 12px).
class NotificationRadii {
  const NotificationRadii._();

  static const double lg = 12;
  static const double md = 10;
  static const double sm = 8;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(md));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
}

/// Spacing & sizing — copied from `ChatSpacing`.
class NotificationSpacing {
  const NotificationSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double rowMinHeight =
      64; // notification row (web p-4 + 40 avatar)
  static const double avatarMd = 40; // inbox/notification row avatar
  static const double typeBadge = 18; // corner type-badge diameter
  static const double unreadDot = 8; // primary unread dot
  static const double bellBadge = 18; // bell count badge diameter
  static const double celebrationBadge = 112; // 28*4 = w-28 h-28
  static const double celebrationIcon = 56; // w-14 h-14
}

/// Box shadows for the celebration glow (copied from `ChatShadows`).
class NotificationShadows {
  const NotificationShadows._();

  /// shadow-glow: 0 0 40px rgba(#F0759E, .5)
  static const List<BoxShadow> glow = [
    BoxShadow(color: Color(0x80F0759E), blurRadius: 40),
  ];

  /// White glow pulse low frame (web 0 0 20px rgba(255,255,255,0.3)).
  static const List<BoxShadow> celebrationGlowLow = [
    BoxShadow(color: Color(0x4DFFFFFF), blurRadius: 20),
  ];

  /// White glow pulse high frame (web 0 0 60px rgba(255,255,255,0.6)).
  static const List<BoxShadow> celebrationGlowHigh = [
    BoxShadow(color: Color(0x99FFFFFF), blurRadius: 60),
  ];

  /// Soft card elevation for the bell quick panel / popovers.
  static const List<BoxShadow> sheet = [
    BoxShadow(color: Color(0x66000000), blurRadius: 24, offset: Offset(0, 8)),
  ];
}

/// Text styles for the Notifications surface. `fontFamily` left unset so the
/// app font is inherited; only size/weight/height/color are pinned for parity.
class NotificationTextStyles {
  const NotificationTextStyles._();

  /// Screen title ('Notifications').
  static const TextStyle screenTitle = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w800,
    color: NotificationColors.foreground,
  );

  /// Card title, read state (web text-sm).
  static const TextStyle cardTitleRead = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.3,
    color: NotificationColors.foreground,
  );

  /// Card title, unread state (web font-semibold).
  static const TextStyle cardTitleUnread = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    height: 1.3,
    color: NotificationColors.foreground,
  );

  /// Optional muted message body (line-clamp-2).
  static const TextStyle cardMessage = TextStyle(
    fontSize: 14,
    height: 1.3,
    color: NotificationColors.mutedForeground,
  );

  /// Relative timestamp (web text-xs muted).
  static const TextStyle timestamp = TextStyle(
    fontSize: 12,
    color: NotificationColors.mutedForeground,
  );

  /// Date section header (Today / Yesterday / This Week / date).
  static const TextStyle sectionLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: NotificationColors.mutedForeground,
  );

  /// Bell badge count text.
  static const TextStyle bellBadge = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    height: 1,
    color: NotificationColors.destructiveForeground,
  );

  /// Preference row title.
  static const TextStyle prefTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: NotificationColors.foreground,
  );

  /// Preference row description (muted).
  static const TextStyle prefDescription = TextStyle(
    fontSize: 13,
    height: 1.3,
    color: NotificationColors.mutedForeground,
  );

  /// Filter tab label.
  static const TextStyle filterTab = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
  );

  /// Empty-state headline.
  static const TextStyle emptyHeadline = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    color: NotificationColors.foreground,
  );

  /// Empty-state subtext.
  static const TextStyle emptySubtext = TextStyle(
    fontSize: 14,
    color: NotificationColors.mutedForeground,
  );

  /// Avatar initial fallback letter.
  static const TextStyle avatarInitial = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: NotificationColors.primaryForeground,
  );

  /// Save button label.
  static const TextStyle saveButton = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    color: NotificationColors.primaryForeground,
  );

  /// Celebration title (web text-2xl bold white).
  static const TextStyle celebrationTitle = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );

  /// Celebration message (web text-sm white/80).
  static const TextStyle celebrationMessage = TextStyle(
    fontSize: 14,
    height: 1.35,
    color: Color(0xCCFFFFFF),
  );

  /// Celebration dismiss hint (web text-xs white/50).
  static const TextStyle celebrationHint = TextStyle(
    fontSize: 12,
    color: Color(0x80FFFFFF),
  );
}

/// Animation durations/curves used across Notifications micro-interactions.
class NotificationMotion {
  const NotificationMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 320);

  // Celebration timing (ported from BadgeCelebration.tsx).
  static const Duration celebrationFade = Duration(milliseconds: 500);
  static const Duration celebrationEntrance = Duration(milliseconds: 800);
  static const Duration celebrationAutoDismiss = Duration(milliseconds: 3500);
  static const Duration glowPulse = Duration(milliseconds: 2000);
  static const Duration particleBurst = Duration(milliseconds: 1500);

  // Spring overshoot for the badge pop (web cubic-bezier 0.34,1.56,0.64,1).
  static const Curve spring = Cubic(0.34, 1.56, 0.64, 1);
  static const Curve emphasized = Cubic(0.32, 0.72, 0, 1);
}
