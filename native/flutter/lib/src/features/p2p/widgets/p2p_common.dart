import 'package:flutter/material.dart';

import '../p2p_theme.dart';

/// Formats a whole number with thousands separators (e.g. 12500 -> "12,500").
String p2pFormatInt(num value) {
  final digits = value.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i != 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

/// Formats a money amount in major units with up to 2 decimals and separators.
String p2pFormatMoney(double value, {String symbol = ''}) {
  final rounded = (value * 100).round() / 100;
  final whole = rounded.truncate();
  final fraction = ((rounded - whole) * 100).round().abs();
  final wholeStr = p2pFormatInt(whole);
  final body = fraction == 0
      ? wholeStr
      : '$wholeStr.${fraction.toString().padLeft(2, '0')}';
  return '$symbol$body';
}

/// Compact "time ago" label (e.g. "3m ago", "2h ago", "5d ago").
String p2pTimeAgo(int millis) {
  final diff = DateTime.now().difference(
    DateTime.fromMillisecondsSinceEpoch(millis),
  );
  if (diff.inSeconds < 60) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  final weeks = (diff.inDays / 7).floor();
  if (weeks < 5) return '${weeks}w ago';
  final months = (diff.inDays / 30).floor();
  if (months < 12) return '${months}mo ago';
  return '${(diff.inDays / 365).floor()}y ago';
}

/// Gradient-ringed glyph used across P2P empty states, mirroring the messaging
/// empty-state treatment (a washed circle with a glowing gradient icon).
class P2PGradientGlyph extends StatelessWidget {
  const P2PGradientGlyph({super.key, required this.icon, this.size = 84});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    final inner = size * 0.72;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0x1AFF3D9A),
        boxShadow: P2PTheme.pinkGlow,
      ),
      child: Container(
        width: inner,
        height: inner,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: P2PTheme.glyphGradient,
        ),
        child: Icon(icon, size: inner * 0.46, color: Colors.white),
      ),
    );
  }
}

/// Centered empty/placeholder state with a glyph, title and subtitle.
class P2PEmptyState extends StatelessWidget {
  const P2PEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.action,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(P2PTheme.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            P2PGradientGlyph(icon: icon),
            const SizedBox(height: P2PTheme.lg),
            Text(title, style: P2PTheme.sectionTitle),
            const SizedBox(height: P2PTheme.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: P2PTheme.muted,
            ),
            if (action != null) ...[
              const SizedBox(height: P2PTheme.lg),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Centered error state with a retry action. Used when a marketplace / orders
/// read throws, so the user gets an honest failure + retry instead of an
/// infinite spinner.
class P2PErrorState extends StatelessWidget {
  const P2PErrorState({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onRetry,
  });

  final String title;
  final String subtitle;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(P2PTheme.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const P2PGradientGlyph(icon: Icons.wifi_off_rounded),
            const SizedBox(height: P2PTheme.lg),
            Text(title, style: P2PTheme.sectionTitle),
            const SizedBox(height: P2PTheme.sm),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: P2PTheme.muted,
            ),
            const SizedBox(height: P2PTheme.lg),
            P2PPrimaryButton(
              label: 'Retry',
              icon: Icons.refresh_rounded,
              expand: false,
              onPressed: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}

/// Small rounded pill used for meta labels (rate, window, escrow, status).
class P2PChip extends StatelessWidget {
  const P2PChip({
    super.key,
    required this.label,
    this.icon,
    this.color,
    this.background,
  });

  final String label;
  final IconData? icon;
  final Color? color;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final fg = color ?? P2PTheme.mutedForeground;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background ?? P2PTheme.surface,
        borderRadius: const BorderRadius.all(Radius.circular(8)),
        border: Border.all(color: P2PTheme.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: fg,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

/// Circular avatar with a gradient fallback initial. Network avatars are only
/// used when [avatarUrl] is a non-empty http(s) URL.
class P2PAvatar extends StatelessWidget {
  const P2PAvatar({super.key, required this.label, this.avatarUrl, this.size = 40});

  final String label;
  final String? avatarUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = avatarUrl;
    final hasImage = url != null && url.startsWith('http');
    final initial = label.trim().isEmpty
        ? '?'
        : label.trim().substring(0, 1).toUpperCase();

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: P2PTheme.glyphGradient,
      ),
      clipBehavior: Clip.antiAlias,
      child: hasImage
          ? Image.network(
              url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _initial(initial),
            )
          : _initial(initial),
    );
  }

  Widget _initial(String initial) => Text(
    initial,
    style: TextStyle(
      color: Colors.white,
      fontWeight: FontWeight.w800,
      fontSize: size * 0.4,
    ),
  );
}

/// Primary gradient button used for the main P2P call-to-action.
class P2PPrimaryButton extends StatelessWidget {
  const P2PPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.busy = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final child = Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: enabled ? P2PTheme.brandGradient : null,
        color: enabled ? null : P2PTheme.surface,
        borderRadius: P2PTheme.chipRadius,
        boxShadow: enabled ? P2PTheme.pinkGlow : null,
      ),
      child: busy
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(
                    icon,
                    size: 18,
                    color: enabled
                        ? Colors.white
                        : P2PTheme.faintForeground,
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: enabled ? Colors.white : P2PTheme.faintForeground,
                  ),
                ),
              ],
            ),
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: P2PTheme.chipRadius,
        onTap: enabled ? onPressed : null,
        child: expand ? SizedBox(width: double.infinity, child: child) : child,
      ),
    );
  }
}
