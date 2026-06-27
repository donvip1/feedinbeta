/// Full-screen celebratory overlay for badge / role_promotion / plan_upgrade.
///
/// Port of `src/components/notifications/BadgeCelebration.tsx`. The web version
/// uses framer-motion; here the same choreography is driven by a small set of
/// [AnimationController]s (no new deps). Pure presentational: emits [onDismiss]
/// only. The trigger / event source and persistence are out of scope. Designed
/// to be pushed by the host via `showGeneralDialog` / `Overlay`.
///
/// Choreography (mirrors the web transitions):
///   - backdrop fades 0 -> 1 over [NotificationMotion.celebrationFade]
///   - 12 particles fan at 30deg steps, animate outward ~160px with
///     opacity 0->1->0 and scale 0->1.5->0, staggered 0.05s, eased out
///   - badge pops in: scale 0->1.3->1, rotate -180->0 over
///     [NotificationMotion.celebrationEntrance] using [NotificationMotion.spring]
///   - badge glow loops between [NotificationShadows.celebrationGlowLow] and
///     [NotificationShadows.celebrationGlowHigh] (nice-to-have, isolated)
///   - title fades up after the badge, dismiss hint fades in last
///   - auto-dismiss after [NotificationMotion.celebrationAutoDismiss], then the
///     same fade-out as a tap.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../notifications_tokens.dart';
import '../notifications_view_models.dart';

/// Number of particles in the burst (web `Array.from({ length: 12 })`).
const int _kParticleCount = 12;

/// Per-particle outward travel distance in logical px (web `* 160`).
const double _kParticleRadius = 160;

/// Particle dot diameter (web `w-3 h-3` == 12px).
const double _kParticleSize = 12;

/// Web `delay: 0.3 + i*0.05` then `duration: 1.5` for each particle.
const double _kParticleStartDelay = 0.3; // seconds before the first particle
const double _kParticleStagger = 0.05; // seconds between particles
const double _kParticleDuration = 1.5; // seconds each particle animates

/// Full-screen badge celebration overlay.
///
/// Consumes [BadgeCelebrationViewModel] and the Notifications design tokens.
class BadgeCelebrationCard extends StatefulWidget {
  const BadgeCelebrationCard({
    super.key,
    required this.viewModel,
    required this.onDismiss,
  });

  /// Resolved celebration content (type / title / optional message).
  final BadgeCelebrationViewModel viewModel;

  /// Fired once the fade-out completes (tap or auto-dismiss). The host owns
  /// removal of the overlay / route.
  final VoidCallback onDismiss;

  @override
  State<BadgeCelebrationCard> createState() => _BadgeCelebrationCardState();
}

class _BadgeCelebrationCardState extends State<BadgeCelebrationCard>
    with TickerProviderStateMixin {
  /// Backdrop + content opacity (0 -> 1 on enter, 1 -> 0 on dismiss).
  late final AnimationController _fade;

  /// Badge pop-out + title/hint reveal timeline.
  late final AnimationController _entrance;

  /// Looping white glow pulse around the badge (nice-to-have).
  late final AnimationController _glow;

  /// Particle burst timeline (covers the staggered window). Guarded so it can
  /// be cut without breaking the core overlay.
  late final AnimationController _particles;

  /// One-shot auto-dismiss timer.
  Timer? _autoDismiss;

  /// Latched so a tap during auto-dismiss (or vice-versa) only fires once.
  bool _dismissing = false;

  // --- Particle window math (shared by controller duration + per-dot curve).
  // Last particle starts at delay + (count-1)*stagger and runs for duration.
  static const double _particleWindowSeconds =
      _kParticleStartDelay +
      (_kParticleCount - 1) * _kParticleStagger +
      _kParticleDuration;

  @override
  void initState() {
    super.initState();

    _fade = AnimationController(
      vsync: this,
      duration: NotificationMotion.celebrationFade,
    )..forward();

    _entrance = AnimationController(
      vsync: this,
      // Run long enough to also cover the delayed title (0.5s) + hint (1.5s)
      // reveals that the web schedules after the 0.8s badge pop.
      duration: const Duration(milliseconds: 2000),
    )..forward();

    _glow = AnimationController(
      vsync: this,
      duration: NotificationMotion.glowPulse,
    )..repeat(reverse: true);

    _particles = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: (_particleWindowSeconds * 1000).round()),
    )..forward();

    _autoDismiss = Timer(
      NotificationMotion.celebrationAutoDismiss,
      _beginDismiss,
    );
  }

  @override
  void dispose() {
    _autoDismiss?.cancel();
    _fade.dispose();
    _entrance.dispose();
    _glow.dispose();
    _particles.dispose();
    super.dispose();
  }

  /// Reverses the fade then fires [BadgeCelebrationCard.onDismiss] once.
  void _beginDismiss() {
    if (_dismissing) return;
    _dismissing = true;
    _autoDismiss?.cancel();
    if (!mounted) {
      widget.onDismiss();
      return;
    }
    _fade.reverse().whenComplete(() {
      if (mounted) widget.onDismiss();
    });
  }

  // --- Pure style resolution (inline; keeps the file self-contained). -------

  IconData get _badgeIcon {
    switch (widget.viewModel.badgeKey) {
      case 'super_admin':
      case 'premium':
        return Icons.workspace_premium; // Crown substitute
      case 'developer':
        return Icons.code;
      case 'admin':
        return Icons.shield;
      case 'moderator':
        return Icons.star;
      case 'pro':
        return Icons.auto_awesome; // Sparkles
      case 'popular':
        return Icons.bolt; // Zap
      default:
        return Icons.star;
    }
  }

  LinearGradient get _badgeGradient {
    switch (widget.viewModel.badgeKey) {
      case 'super_admin':
        return NotificationGradients.badgeSuperAdmin;
      case 'developer':
        return NotificationGradients.badgeDeveloper;
      case 'admin':
        return NotificationGradients.badgeAdmin;
      case 'moderator':
        return NotificationGradients.badgeModerator;
      case 'premium':
        return NotificationGradients.badgePremium;
      case 'pro':
        return NotificationGradients.badgePro;
      case 'popular':
        return NotificationGradients.badgePopular;
      default:
        return NotificationGradients.badgeDefault;
    }
  }

  @override
  Widget build(BuildContext context) {
    final gradient = _badgeGradient;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _beginDismiss,
      child: FadeTransition(
        opacity: _fade,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Backdrop: black/60 + blur (web bg-black/60 backdrop-blur-sm).
            BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
              child: Container(color: NotificationColors.barrier),
            ),
            // Centered choreography.
            Center(
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  // (a) Particle burst — isolated nice-to-have flourish.
                  _ParticleBurst(controller: _particles, gradient: gradient),
                  // (b) + (c) Badge pop-out, title, hint.
                  _BadgeContent(
                    entrance: _entrance,
                    glow: _glow,
                    gradient: gradient,
                    icon: _badgeIcon,
                    title: widget.viewModel.title,
                    message: widget.viewModel.message,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The 12-particle outward burst. Driven by a single controller; each particle
/// resolves its own staggered interval. Kept in its own widget so it can be
/// removed wholesale without touching the core badge content.
class _ParticleBurst extends StatelessWidget {
  const _ParticleBurst({required this.controller, required this.gradient});

  final AnimationController controller;
  final LinearGradient gradient;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        return Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            for (int i = 0; i < _kParticleCount; i++) _buildParticle(i),
          ],
        );
      },
    );
  }

  Widget _buildParticle(int index) {
    // Web: angle = (i * 30) * (pi / 180).
    final angle = (index * 30) * (math.pi / 180);

    // Per-particle local progress within the shared window.
    final start = _kParticleStartDelay + index * _kParticleStagger;
    final begin = start / _BadgeCelebrationCardState._particleWindowSeconds;
    final end =
        (start + _kParticleDuration) /
        _BadgeCelebrationCardState._particleWindowSeconds;
    final t = _interval(controller.value, begin, end, Curves.easeOut);

    // opacity: [0, 1, 0] keyframed over t.
    final opacity = _keyframe3(t, 0, 1, 0);
    // scale: [0, 1.5, 0] keyframed over t.
    final scale = _keyframe3(t, 0, 1.5, 0);
    // Outward travel uses linear progress so dots keep moving as they fade.
    final dist = t * _kParticleRadius;
    final dx = math.cos(angle) * dist;
    final dy = math.sin(angle) * dist;

    return Transform.translate(
      offset: Offset(dx, dy),
      child: Transform.scale(
        scale: scale,
        child: Opacity(
          opacity: opacity.clamp(0.0, 1.0),
          child: Container(
            width: _kParticleSize,
            height: _kParticleSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: gradient,
            ),
          ),
        ),
      ),
    );
  }
}

/// Badge circle (pop + glow) plus the delayed title and dismiss hint.
class _BadgeContent extends StatelessWidget {
  const _BadgeContent({
    required this.entrance,
    required this.glow,
    required this.gradient,
    required this.icon,
    required this.title,
    required this.message,
  });

  final AnimationController entrance;
  final AnimationController glow;
  final LinearGradient gradient;
  final IconData icon;
  final String title;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: entrance,
      builder: (context, _) {
        final v = entrance.value;

        // Badge pop occupies the first 0.8s of the ~2s entrance timeline.
        // (0.8 / 2.0 = 0.4 of the controller.)
        final popT = _interval(v, 0, 0.4, NotificationMotion.spring);
        // scale: [0, 1.3, 1]; rotate: [-180, 10, 0] (degrees) over popT.
        final scale = _keyframe3(popT, 0, 1.3, 1);
        final rotateDeg = _keyframe3(popT, -180, 10, 0);
        final rotate = rotateDeg * (math.pi / 180);

        // Title reveal: web delay 0.5s, duration 0.5s -> 0.25..0.5 of timeline.
        final titleT = _interval(v, 0.25, 0.5, Curves.easeOut);
        // Hint reveal: web delay 1.5s -> ~0.75 onward.
        final hintT = _interval(v, 0.75, 1.0, Curves.easeOut);

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Transform.rotate(
              angle: rotate,
              child: Transform.scale(
                scale: scale.clamp(0.0, 2.0),
                child: _GlowingBadge(
                  glow: glow,
                  gradient: gradient,
                  icon: icon,
                ),
              ),
            ),
            const SizedBox(height: NotificationSpacing.lg),
            // Title (+ optional message) fade up.
            Opacity(
              opacity: titleT.clamp(0.0, 1.0),
              child: Transform.translate(
                offset: Offset(0, (1 - titleT).clamp(0.0, 1.0) * 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: NotificationTextStyles.celebrationTitle,
                    ),
                    if (message != null && message!.isNotEmpty) ...[
                      const SizedBox(height: NotificationSpacing.sm),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 280),
                        child: Text(
                          message!,
                          textAlign: TextAlign.center,
                          style: NotificationTextStyles.celebrationMessage,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: NotificationSpacing.lg),
            // Delayed dismiss hint.
            Opacity(
              opacity: hintT.clamp(0.0, 1.0),
              child: Text(
                'Tap anywhere to dismiss',
                style: NotificationTextStyles.celebrationHint,
              ),
            ),
          ],
        );
      },
    );
  }
}

/// The 112px gradient circle with a looping white glow and centered badge icon.
class _GlowingBadge extends StatelessWidget {
  const _GlowingBadge({
    required this.glow,
    required this.gradient,
    required this.icon,
  });

  final AnimationController glow;
  final LinearGradient gradient;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: glow,
      builder: (context, child) {
        // Lerp the single-shadow frame between low and high glow.
        final low = NotificationShadows.celebrationGlowLow.first;
        final high = NotificationShadows.celebrationGlowHigh.first;
        final shadow = BoxShadow(
          color: Color.lerp(low.color, high.color, glow.value)!,
          blurRadius: lerpDouble(low.blurRadius, high.blurRadius, glow.value),
        );
        return Container(
          width: NotificationSpacing.celebrationBadge,
          height: NotificationSpacing.celebrationBadge,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: gradient,
            boxShadow: [shadow],
          ),
          child: child,
        );
      },
      child: Center(
        child: Icon(
          icon,
          size: NotificationSpacing.celebrationIcon,
          color: Colors.white,
        ),
      ),
    );
  }
}

// --- Small pure animation helpers. ------------------------------------------

/// Maps a global controller value `v` onto a sub-interval `[begin, end]`,
/// returning the eased local progress in `[0, 1]` (0 before, 1 after).
double _interval(double v, double begin, double end, Curve curve) {
  if (end <= begin) return v >= end ? 1 : 0;
  final t = ((v - begin) / (end - begin)).clamp(0.0, 1.0);
  return curve.transform(t);
}

/// Three-keyframe interpolation `[a, b, c]` evenly over `t` in `[0, 1]`
/// (mirrors framer-motion array keyframes like `[0, 1.5, 0]`).
double _keyframe3(double t, double a, double b, double c) {
  if (t <= 0) return a;
  if (t >= 1) return c;
  if (t < 0.5) {
    return a + (b - a) * (t / 0.5);
  }
  return b + (c - b) * ((t - 0.5) / 0.5);
}

/// Linear double lerp (avoids importing extra utilities).
double lerpDouble(double a, double b, double t) => a + (b - a) * t;
