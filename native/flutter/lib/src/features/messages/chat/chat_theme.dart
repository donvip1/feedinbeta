import 'package:flutter/material.dart';

/// Design tokens for the native chat experience.
///
/// The palette deliberately follows the modern slate/sky visual language used
/// by the native messaging concept instead of inheriting Feedin's pink social
/// surfaces. Everything remains `const` and Flutter-only so every messaging
/// widget can share the same predictable dark theme.
///
/// Usage:
///   color: ChatColors.primary,
///   decoration: BoxDecoration(gradient: ChatGradients.outgoingBubble),
///   borderRadius: ChatRadii.bubble,
///   style: ChatTextStyles.messageBody,
class ChatColors {
  const ChatColors._();

  // Brand / primary (Telegram-inspired sky blue).
  static const Color primary = Color(0xFF2481CC);
  static const Color primaryForeground = Color(0xFFFFFFFF);
  static const Color primaryGlow = Color(0xFF38BDF8); // sky-400
  static const Color accent = Color(0xFF38BDF8);

  // Surfaces (Tailwind slate-950 / slate-900 / slate-800).
  static const Color background = Color(0xFF020617);
  static const Color card = Color(0xFF0F172A);
  static const Color popover = Color(0xFF0F172A);

  // Neutrals.
  static const Color muted = Color(0xFF1E293B);
  static const Color secondary = Color(0xFF1E293B);
  static const Color border = Color(0xFF1E293B);
  static const Color input = Color(0xFF1E293B);
  static const Color composerFill = Color(0xE61E293B);
  static const Color threadMidpoint = Color(0x66111C30);

  // Text.
  static const Color foreground = Color(0xFFF1F5F9); // slate-100
  static const Color mutedForeground = Color(0xFF94A3B8); // slate-400
  static const Color subtleForeground = Color(0xFF64748B); // slate-500

  // Status / accents.
  static const Color destructive = Color(0xFFEF4343); // hsl(0 84% 60%)
  static const Color readTick = Color(0xFF7DD3FC); // sky-300
  static const Color online = Color(0xFF10B981); // emerald-500 online dot
  static const Color activeNow = Color(0xFF38BDF8); // sky-400 'Active now'
  static const Color amberWarning = Color(0xFFF59E0B); // amber-500 warnings
  static const Color recording = Color(0xFFEF4343); // red recording dot

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color barrier = Color(0x80000000); // black/50 modal backdrop
  static const Color primaryFaint = Color(0x1A38BDF8); // sky-400 @ 10%
  static const Color primarySoft = Color(0x3338BDF8); // sky-400 @ 20%
  static const Color onlineRing = background; // dot border matches bg

  // Bubble surfaces.
  static const Color outgoingBubble = Color(0xFF2481CC);
  static const Color incomingBubble = Color(0xFF1E293B);
  static const Color incomingBubbleBorder = Color(0xFF334155);

  // Inbox row surfaces. Unread and selected states gain contrast without
  // becoming detached cards, which keeps long native lists calm and scannable.
  static const Color rowCard = Color(0x520F172A); // slate-900 @ 32%
  static const Color rowCardUnread = Color(0xCC172033);
  static const Color rowCardSelected = Color(0xE61E293B); // slate-800 @ 90%
  static const Color rowCardBorder = Color(0x661E293B);
  static const Color rowCardSelectedBorder = Color(0x8038BDF8);
  static const Color incomingBubbleBorderSoft = Color(0x80334155);
}

/// Restrained gradients used for emphasis within the slate chat surface.
class ChatGradients {
  const ChatGradients._();

  /// Telegram-blue outgoing bubble with a subtle sky lift.
  static const LinearGradient outgoingBubble = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2481CC), Color(0xFF0EA5E9)],
  );

  static const LinearGradient sendAction = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0284C7), Color(0xFF38BDF8)],
  );

  /// Blue -> cyan voice-note send button.
  static const LinearGradient voiceSend = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFF0284C7), Color(0xFF22D3EE)],
  );

  /// Avatar initials fallback fill.
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF0369A1), Color(0xFF38BDF8)],
  );

  /// Modern avatar/story ring.
  static const LinearGradient story = LinearGradient(
    begin: Alignment.bottomLeft,
    end: Alignment.topRight,
    colors: [Color(0xFF38BDF8), Color(0xFF0EA5E9), Color(0xFF14B8A6)],
  );
}

/// Corner radii. Web `--radius` = 0.75rem = 12px (lg=12, md=10, sm=8).
class ChatRadii {
  const ChatRadii._();

  static const double lg = 12;
  static const double md = 10;
  static const double sm = 8;
  static const double pill = 999;
  static const double sheet = 16; // mobile bottom sheet rounded-t-2xl
  static const double grouped =
      6; // tail corner for grouped bubbles (rounded-md)
  static const double bubbleRadius = 16; // web rounded-2xl
  static const double rowCard = 12; // web inbox row rounded-xl

  static const BorderRadius bubble = BorderRadius.all(
    Radius.circular(bubbleRadius),
  );
  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius row = BorderRadius.all(Radius.circular(rowCard));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius sheetTop = BorderRadius.only(
    topLeft: Radius.circular(sheet),
    topRight: Radius.circular(sheet),
  );

  /// Grouped-bubble radii matching the web `ModernMessageBubble`: the bubble is
  /// `rounded-2xl` (16) everywhere except the single tail corner nearest the
  /// sender, which softens to [grouped] (6, web `rounded-md`). The own side
  /// always pins the bottom-right tail; incoming pins the bottom-left. Mid-run
  /// bubbles additionally soften the *top* tail corner so a vertical run reads
  /// as one connected column.
  static BorderRadius groupedBubble({
    required bool isMine,
    required bool isFirstInGroup,
    required bool isLastInGroup,
  }) {
    const big = Radius.circular(bubbleRadius);
    const small = Radius.circular(grouped);
    if (isMine) {
      return BorderRadius.only(
        topLeft: big,
        bottomLeft: big,
        topRight: isFirstInGroup ? big : small,
        bottomRight: isLastInGroup ? big : small,
      );
    }
    return BorderRadius.only(
      topRight: big,
      bottomRight: big,
      topLeft: isFirstInGroup ? big : small,
      bottomLeft: isLastInGroup ? big : small,
    );
  }
}

/// Box shadows matching `--shadow-*` (dark mode values).
class ChatShadows {
  const ChatShadows._();

  /// Backward-compatible name used by existing widgets; now a sky-blue glow.
  static const List<BoxShadow> pink = [
    BoxShadow(color: Color(0x402481CC), blurRadius: 18, offset: Offset(0, 4)),
  ];

  /// Focus glow for elevated primary controls.
  static const List<BoxShadow> glow = [
    BoxShadow(color: Color(0x6638BDF8), blurRadius: 36),
  ];

  /// Soft blue elevation for selected/highlighted surfaces.
  static const List<BoxShadow> elegant = [
    BoxShadow(
      color: Color(0x522481CC),
      blurRadius: 30,
      spreadRadius: -10,
      offset: Offset(0, 10),
    ),
  ];

  /// Soft neutral elevation used by sheets / popovers.
  static const List<BoxShadow> sheet = [
    BoxShadow(color: Color(0x66000000), blurRadius: 24, offset: Offset(0, -4)),
  ];
}

/// Spacing & sizing constants (44px tap targets, 52px list rows, 56px header).
class ChatSpacing {
  const ChatSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;

  static const double tapTarget = 44;
  static const double listItemMinHeight = 52;
  static const double headerHeight = 56; // h-14
  static const double avatarSm = 28; // 7x7 bubble avatar (~28px)
  static const double avatarMd = 50; // prominent native inbox avatar
  static const double avatarLg = 48; // header avatar
  static const double onlineDot = 12; // header presence dot
  static const double inboxOnlineDot = 14;
  static const double bubbleMaxWidthFraction = 0.75; // maxWidth 75%
  static const double scrollAwayThreshold = 150; // px before FAB shows
}

/// Text styles for the chat surface. Web font is Inter; the app currently
/// ships Roboto — these styles leave `fontFamily` unset so they inherit the
/// app font, and only pin size/weight/height/color for parity.
class ChatTextStyles {
  const ChatTextStyles._();

  static const TextStyle messageBody = TextStyle(
    fontSize: 15,
    height: 1.35,
    color: ChatColors.foreground,
  );

  static const TextStyle emojiOnly = TextStyle(fontSize: 40, height: 1.1);

  static const TextStyle timestamp = TextStyle(
    fontSize: 11,
    color: ChatColors.mutedForeground,
  );

  static const TextStyle conversationName = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.15,
    color: ChatColors.foreground,
  );

  static const TextStyle headerName = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: ChatColors.foreground,
  );

  static const TextStyle previewMuted = TextStyle(
    fontSize: 13,
    height: 1.25,
    color: ChatColors.mutedForeground,
  );

  static const TextStyle previewUnread = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    height: 1.25,
    color: ChatColors.foreground,
  );

  static const TextStyle subtitle = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: ChatColors.subtleForeground,
  );

  static const TextStyle daySeparator = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: ChatColors.mutedForeground,
  );

  static const TextStyle badge = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: ChatColors.primaryForeground,
  );

  static const TextStyle sectionLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.4,
    color: ChatColors.mutedForeground,
  );

  static const TextStyle actionItem = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w500,
    color: ChatColors.foreground,
  );
}

/// Standard animation durations/curves used across chat micro-interactions.
class ChatMotion {
  const ChatMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 320);
  static const Curve spring = Curves.easeOutBack;
  static const Curve emphasized = Cubic(0.32, 0.72, 0, 1);
}
