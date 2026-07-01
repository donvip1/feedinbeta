import 'package:flutter/material.dart';

/// Design tokens for the 1:1 chat experience, ported 1:1 from the web app's
/// dark-mode CSS variables (src/index.css) and tailwind.config.ts.
///
/// Everything here is `const` and depends only on the Flutter SDK so it
/// analyzes cleanly on its own and can be shared by every chat widget without
/// reaching into [Theme.of] (the existing app theme primary `#FF3D9A` is close
/// but NOT exact — the web messaging surface uses `#F04299`).
///
/// Usage:
///   color: ChatColors.primary,
///   decoration: BoxDecoration(gradient: ChatGradients.outgoingBubble),
///   borderRadius: ChatRadii.bubble,
///   style: ChatTextStyles.messageBody,
class ChatColors {
  const ChatColors._();

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
  static const Color readTick = Color(0xFF7DD3FC); // sky-300, read receipts
  static const Color online = Color(0xFF10B981); // emerald-500 online dot
  static const Color activeNow = Color(0xFF38BDF8); // sky-400 'Active now'
  static const Color amberWarning = Color(0xFFF59E0B); // amber-500 warnings
  static const Color recording = Color(0xFFEF4343); // red recording dot

  // Translucent helpers (precomputed; avoid runtime withOpacity in const ctx).
  static const Color barrier = Color(0x80000000); // black/50 modal backdrop
  static const Color primaryFaint = Color(0x1AF04299); // primary @ 10%
  static const Color primarySoft = Color(
    0x33F04299,
  ); // primary @ 20% (search hl)
  static const Color onlineRing = background; // dot border matches bg

  // The other-user bubble surface (card with a subtle border).
  static const Color incomingBubble = card;
  static const Color incomingBubbleBorder = border;

  // Inbox card-row surfaces. The web `TikTokConversationItem` frames every row
  // as a rounded card: a faint `bg-muted/20` fill with a `border-border/40`
  // hairline, swapping to a primary wash + ring when selected.
  static const Color rowCard = Color(0x331D283A); // muted @ 20%
  static const Color rowCardBorder = Color(0x661D283A); // border @ 40%
  static const Color rowCardSelectedBorder = Color(0x33F04299); // primary @ 20%
  static const Color incomingBubbleBorderSoft = Color(0x801D283A); // border/50
}

/// Linear gradients matching the web `--gradient-*` tokens.
class ChatGradients {
  const ChatGradients._();

  /// Outgoing bubble + send FAB. Web `--gradient-accent`
  /// (135deg #F04299 -> #BB67E4) is used for the send action; the outgoing
  /// bubble itself uses `--gradient-primary` (135deg #F04299 -> #ED5E76).
  static const LinearGradient outgoingBubble = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFED5E76)],
  );

  static const LinearGradient sendAction = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFBB67E4)],
  );

  /// Pink -> blue voice-note send button (parity with VoiceRecorder send).
  static const LinearGradient voiceSend = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0xFFF04299), Color(0xFF3B82F6)],
  );

  /// Avatar initials fallback fill.
  static const LinearGradient avatarFallback = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFF04299), Color(0xFFE963BC)],
  );

  /// Stories ring (45deg #FF3399 -> #F42547 -> #FF7733).
  static const LinearGradient story = LinearGradient(
    begin: Alignment.bottomLeft,
    end: Alignment.topRight,
    colors: [Color(0xFFFF3399), Color(0xFFF42547), Color(0xFFFF7733)],
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
  static const double grouped = 6; // tail corner for grouped bubbles (rounded-md)
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

  /// shadow-pink: 0 4px 20px rgba(#F04299, .25)
  static const List<BoxShadow> pink = [
    BoxShadow(color: Color(0x40F04299), blurRadius: 20, offset: Offset(0, 4)),
  ];

  /// shadow-glow: 0 0 40px rgba(#F0759E, .5)
  static const List<BoxShadow> glow = [
    BoxShadow(color: Color(0x80F0759E), blurRadius: 40),
  ];

  /// shadow-elegant: 0 10px 30px -10px rgba(#F04299, .4)
  static const List<BoxShadow> elegant = [
    BoxShadow(
      color: Color(0x66F04299),
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
  static const double avatarMd = 44; // inbox row avatar (web w-11 h-11)
  static const double avatarLg = 48; // header avatar
  static const double onlineDot = 12; // header presence dot
  static const double inboxOnlineDot = 16; // inbox row dot (web w-4 h-4)
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
    fontSize: 14,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    color: ChatColors.foreground,
  );

  static const TextStyle headerName = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w700,
    color: ChatColors.foreground,
  );

  static const TextStyle previewMuted = TextStyle(
    fontSize: 13,
    color: ChatColors.mutedForeground,
  );

  static const TextStyle previewUnread = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: ChatColors.foreground,
  );

  static const TextStyle subtitle = TextStyle(
    fontSize: 12,
    color: ChatColors.mutedForeground,
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
