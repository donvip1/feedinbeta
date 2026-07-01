import 'package:flutter/material.dart';

import '../data/live_models.dart';
import '../live_theme.dart';

/// A small pulsing red "LIVE" pill (web `.animate-pulse` LIVE badge).
class LivePill extends StatelessWidget {
  const LivePill({
    super.key,
    this.color = LiveTheme.liveRed,
    this.label = 'LIVE',
  });

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color,
        borderRadius: LiveTheme.pillRadius,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const _PulseDot(),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot();

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.35, end: 1).animate(_controller),
      child: Container(
        width: 6,
        height: 6,
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

/// A translucent viewer/listener count chip (`users` glyph + formatted count).
class ViewerCountChip extends StatelessWidget {
  const ViewerCountChip({
    super.key,
    required this.count,
    this.icon = Icons.remove_red_eye_outlined,
  });

  final int count;
  final IconData icon;

  static String formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}k';
    return count.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: const BoxDecoration(
        color: LiveTheme.chip,
        borderRadius: LiveTheme.pillRadius,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: LiveTheme.onSurface),
          const SizedBox(width: 4),
          Text(formatCount(count), style: LiveTheme.countLabel),
        ],
      ),
    );
  }
}

/// Circular avatar with a gradient initials fallback used across the module.
class LiveAvatar extends StatelessWidget {
  const LiveAvatar({super.key, required this.profile, this.size = 36});

  final LiveProfile? profile;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = profile?.avatarUrl;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LiveTheme.brandGradient,
        image: (url != null && url.isNotEmpty)
            ? DecorationImage(image: NetworkImage(url), fit: BoxFit.cover)
            : null,
        border: Border.all(color: LiveTheme.chipBorder),
      ),
      alignment: Alignment.center,
      child: (url == null || url.isEmpty)
          ? Text(
              profile?.initial ?? 'U',
              style: TextStyle(
                color: Colors.white,
                fontSize: size * 0.42,
                fontWeight: FontWeight.w800,
              ),
            )
          : null,
    );
  }
}
