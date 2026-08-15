import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../data/gift_models.dart';

enum GiftVisualState { idle, preview, send }

class GiftAssetView extends StatefulWidget {
  const GiftAssetView({
    super.key,
    required this.gift,
    this.state = GiftVisualState.idle,
    this.size = 112,
  });

  final GiftCatalogItem gift;
  final GiftVisualState state;
  final double size;

  @override
  State<GiftAssetView> createState() => _GiftAssetViewState();
}

class _GiftAssetViewState extends State<GiftAssetView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    return SizedBox.square(
      dimension: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final t = reduceMotion ? 0.15 : _controller.value;
          final transform = _motion(widget.gift.key, t, widget.state);
          return Transform.translate(
            offset: transform.offset,
            child: Transform.rotate(
              angle: transform.rotation,
              child: Transform.scale(
                scale: transform.scale,
                child: CustomPaint(
                  painter: _GiftPainter(
                    keyName: widget.gift.key,
                    tier: widget.gift.tier,
                    progress: t,
                    intensity: switch (widget.state) {
                      GiftVisualState.idle => 0.65,
                      GiftVisualState.preview => 1.0,
                      GiftVisualState.send => 1.35,
                    },
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  _GiftMotion _motion(String key, double t, GiftVisualState state) {
    final energy = state == GiftVisualState.send
        ? 1.8
        : state == GiftVisualState.preview
        ? 1.25
        : 1.0;
    final wave = math.sin(t * math.pi * 2);
    return switch (key) {
      'pulse-heart' => _GiftMotion(
        scale: 1 + 0.06 * energy * math.sin(t * math.pi * 4),
      ),
      'golden-star' => _GiftMotion(rotation: t * math.pi * 2 * energy),
      'coffee-break' => _GiftMotion(offset: Offset(0, -4 * wave)),
      'pizza-slice' => _GiftMotion(
        rotation: wave * 0.12 * energy,
        offset: Offset(0, -3 * wave),
      ),
      'ice-cream' => _GiftMotion(
        rotation: wave * 0.06,
        scale: 1 + 0.025 * wave,
      ),
      'dream-moon' => _GiftMotion(
        rotation: t * 0.35,
        offset: Offset(4 * wave, -3 * wave),
      ),
      'lightning' => _GiftMotion(
        offset: Offset(wave * 2 * energy, 0),
        scale: 1 + 0.04 * wave.abs(),
      ),
      'champion-trophy' => _GiftMotion(
        offset: Offset(0, -5 * wave.abs() * energy),
      ),
      'blazing-fire' => _GiftMotion(scale: 1 + 0.08 * wave.abs() * energy),
      'party-blast' => _GiftMotion(rotation: -0.22 + 0.08 * wave * energy),
      'celebration-cake' => _GiftMotion(
        offset: Offset(0, -4 * wave.abs()),
        scale: 1 + 0.025 * wave,
      ),
      'rainbow-vibes' => _GiftMotion(scale: 1 + 0.06 * wave * energy),
      'galaxy-rocket' => _GiftMotion(
        offset: Offset(2 * wave, -12 * t * energy),
        scale: 1 + 0.08 * t,
      ),
      'royal-crown' => _GiftMotion(
        offset: Offset(0, -5 + 4 * wave),
        rotation: wave * 0.04,
      ),
      'legendary-diamond' => _GiftMotion(
        rotation: t * math.pi * energy,
        scale: 1 + 0.05 * wave,
      ),
      'the-universe' => _GiftMotion(
        rotation: t * math.pi * 2,
        scale: 1 + 0.08 * wave,
      ),
      _ => _GiftMotion(offset: Offset(0, -3 * wave)),
    };
  }
}

class _GiftMotion {
  const _GiftMotion({
    this.offset = Offset.zero,
    this.rotation = 0,
    this.scale = 1,
  });
  final Offset offset;
  final double rotation;
  final double scale;
}

class _GiftPainter extends CustomPainter {
  const _GiftPainter({
    required this.keyName,
    required this.tier,
    required this.progress,
    required this.intensity,
  });

  final String keyName;
  final GiftTier tier;
  final double progress;
  final double intensity;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * 0.34;
    final colors = switch (tier) {
      GiftTier.basic => const [
        Color(0xFF35C6C3),
        Color(0xFFDF4D78),
        Color(0xFFFFD56A),
      ],
      GiftTier.premium => const [
        Color(0xFF9B8AFB),
        Color(0xFF35C6C3),
        Color(0xFFFF5D9E),
      ],
      GiftTier.exclusive => const [
        Color(0xFFFFD56A),
        Color(0xFFF4F6FF),
        Color(0xFF7D5CFF),
      ],
    };
    final glow = Paint()
      ..color = colors.first.withValues(alpha: 0.26 * intensity.clamp(0, 1.4))
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, 18 * intensity);
    canvas.drawCircle(center, radius * 1.05, glow);
    _particles(canvas, center, radius, colors);
    final paint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: colors,
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = Colors.white.withValues(alpha: 0.62)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    _drawShape(canvas, center, radius, paint, stroke);
  }

  void _particles(
    Canvas canvas,
    Offset center,
    double radius,
    List<Color> colors,
  ) {
    for (var i = 0; i < 9; i++) {
      final angle = i * 0.72 + progress * math.pi * 2 * (i.isEven ? 1 : -0.45);
      final orbit = radius * (1.15 + (i % 3) * 0.13);
      final point = center + Offset(math.cos(angle), math.sin(angle)) * orbit;
      canvas.drawCircle(
        point,
        1.2 + (i % 3) * 0.7 * intensity,
        Paint()..color = colors[i % colors.length].withValues(alpha: 0.75),
      );
    }
  }

  void _drawShape(Canvas c, Offset o, double r, Paint fill, Paint stroke) {
    switch (keyName) {
      case 'pulse-heart':
        final p = Path()..moveTo(o.dx, o.dy + r * .72);
        p.cubicTo(
          o.dx - r * 1.25,
          o.dy,
          o.dx - r * .72,
          o.dy - r,
          o.dx,
          o.dy - r * .36,
        );
        p.cubicTo(
          o.dx + r * .72,
          o.dy - r,
          o.dx + r * 1.25,
          o.dy,
          o.dx,
          o.dy + r * .72,
        );
        c.drawPath(p, fill);
        c.drawPath(p, stroke);
      case 'golden-star':
        final p = Path();
        for (var i = 0; i < 10; i++) {
          final a = -math.pi / 2 + i * math.pi / 5;
          final rr = i.isEven ? r : r * .43;
          final point = o + Offset(math.cos(a), math.sin(a)) * rr;
          i == 0 ? p.moveTo(point.dx, point.dy) : p.lineTo(point.dx, point.dy);
        }
        p.close();
        c.drawPath(p, fill);
        c.drawPath(p, stroke);
      case 'coffee-break':
        c.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: o, width: r * 1.45, height: r * 1.15),
            Radius.circular(r * .18),
          ),
          fill,
        );
        c.drawArc(
          Rect.fromCenter(
            center: Offset(o.dx + r * .72, o.dy),
            width: r * .72,
            height: r * .72,
          ),
          -math.pi / 2,
          math.pi,
          false,
          stroke..strokeWidth = r * .16,
        );
        for (var i = -1; i <= 1; i++) {
          c.drawArc(
            Rect.fromLTWH(
              o.dx + i * r * .28 - r * .14,
              o.dy - r * 1.25,
              r * .28,
              r * .8,
            ),
            0,
            math.pi,
            false,
            stroke..strokeWidth = 2,
          );
        }
      case 'pizza-slice':
        final p = Path()
          ..moveTo(o.dx, o.dy + r)
          ..lineTo(o.dx - r * .78, o.dy - r * .75)
          ..quadraticBezierTo(
            o.dx,
            o.dy - r * 1.05,
            o.dx + r * .78,
            o.dy - r * .75,
          )
          ..close();
        c.drawPath(p, fill);
        c.drawPath(p, stroke);
        for (final d in const [
          Offset(-.3, -.35),
          Offset(.28, -.2),
          Offset(0, .25),
        ]) {
          c.drawCircle(
            o + Offset(d.dx * r, d.dy * r),
            r * .13,
            Paint()..color = const Color(0xFFB5263E),
          );
        }
      case 'ice-cream':
        final cone = Path()
          ..moveTo(o.dx - r * .55, o.dy)
          ..lineTo(o.dx + r * .55, o.dy)
          ..lineTo(o.dx, o.dy + r)
          ..close();
        c.drawPath(cone, fill);
        for (final d in const [
          Offset(-.38, -.25),
          Offset(.38, -.25),
          Offset(0, -.62),
        ]) {
          c.drawCircle(o + Offset(d.dx * r, d.dy * r), r * .48, fill);
        }
      case 'dream-moon':
        final moon = Path.combine(
          PathOperation.difference,
          Path()..addOval(Rect.fromCircle(center: o, radius: r)),
          Path()..addOval(
            Rect.fromCircle(
              center: o + Offset(r * .42, -r * .12),
              radius: r * .82,
            ),
          ),
        );
        c.drawPath(moon, fill);
        c.drawPath(moon, stroke);
      case 'lightning':
        final p = Path()
          ..moveTo(o.dx + r * .18, o.dy - r)
          ..lineTo(o.dx - r * .62, o.dy + r * .08)
          ..lineTo(o.dx - r * .08, o.dy + r * .02)
          ..lineTo(o.dx - r * .3, o.dy + r)
          ..lineTo(o.dx + r * .7, o.dy - r * .22)
          ..lineTo(o.dx + r * .12, o.dy - r * .1)
          ..close();
        c.drawPath(p, fill);
        c.drawPath(p, stroke);
      case 'champion-trophy':
        final cup = Path()
          ..moveTo(o.dx - r * .7, o.dy - r * .75)
          ..quadraticBezierTo(
            o.dx - r * .55,
            o.dy + r * .25,
            o.dx,
            o.dy + r * .3,
          )
          ..quadraticBezierTo(
            o.dx + r * .55,
            o.dy + r * .25,
            o.dx + r * .7,
            o.dy - r * .75,
          )
          ..close();
        c.drawPath(cup, fill);
        c.drawRect(
          Rect.fromCenter(
            center: Offset(o.dx, o.dy + r * .72),
            width: r * 1.05,
            height: r * .25,
          ),
          fill,
        );
        c.drawLine(
          Offset(o.dx, o.dy + r * .25),
          Offset(o.dx, o.dy + r * .7),
          stroke..strokeWidth = r * .18,
        );
      case 'blazing-fire':
        final p = Path()
          ..moveTo(o.dx, o.dy + r)
          ..cubicTo(
            o.dx - r,
            o.dy + r * .4,
            o.dx - r * .65,
            o.dy - r * .35,
            o.dx - r * .08,
            o.dy - r,
          )
          ..cubicTo(
            o.dx + r * .05,
            o.dy - r * .35,
            o.dx + r * .9,
            o.dy - r * .25,
            o.dx + r * .55,
            o.dy + r * .5,
          )
          ..quadraticBezierTo(o.dx + r * .35, o.dy + r, o.dx, o.dy + r)
          ..close();
        c.drawPath(p, fill);
        c.drawPath(p, stroke);
      case 'party-blast':
        final p = Path()
          ..moveTo(o.dx - r * .8, o.dy + r * .65)
          ..lineTo(o.dx + r * .5, o.dy - r * .65)
          ..lineTo(o.dx + r * .78, o.dy - r * .38)
          ..lineTo(o.dx - r * .48, o.dy + r * .9)
          ..close();
        c.drawPath(p, fill);
        for (var i = 0; i < 5; i++) {
          c.drawCircle(
            o + Offset(r * (.15 + i * .18), -r * (.65 + (i % 2) * .22)),
            r * .08,
            fill,
          );
        }
      case 'celebration-cake':
        c.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(
              center: Offset(o.dx, o.dy + r * .28),
              width: r * 1.6,
              height: r * 1.05,
            ),
            Radius.circular(r * .16),
          ),
          fill,
        );
        c.drawRect(
          Rect.fromCenter(
            center: Offset(o.dx, o.dy - r * .55),
            width: r * .12,
            height: r * .7,
          ),
          fill,
        );
        c.drawCircle(
          Offset(o.dx, o.dy - r * .95),
          r * .13,
          Paint()..color = const Color(0xFFFFE36E),
        );
      case 'rainbow-vibes':
        for (var i = 0; i < 4; i++) {
          c.drawArc(
            Rect.fromCenter(
              center: Offset(o.dx, o.dy + r * .35),
              width: r * (2 - i * .3),
              height: r * (1.7 - i * .25),
            ),
            math.pi,
            math.pi,
            false,
            stroke
              ..color = [
                const Color(0xFFFF5D73),
                const Color(0xFFFFD56A),
                const Color(0xFF35C6C3),
                const Color(0xFF9B8AFB),
              ][i]
              ..strokeWidth = r * .16,
          );
        }
      case 'galaxy-rocket':
        c.drawOval(
          Rect.fromCenter(center: o, width: r * .85, height: r * 1.8),
          fill,
        );
        final nose = Path()
          ..moveTo(o.dx - r * .42, o.dy - r * .55)
          ..lineTo(o.dx, o.dy - r * 1.2)
          ..lineTo(o.dx + r * .42, o.dy - r * .55)
          ..close();
        c.drawPath(nose, fill);
        c.drawCircle(
          Offset(o.dx, o.dy - r * .25),
          r * .18,
          Paint()..color = const Color(0xFF18243F),
        );
        c.drawOval(
          Rect.fromCenter(
            center: Offset(o.dx, o.dy + r),
            width: r * .35,
            height: r * .9,
          ),
          Paint()..color = const Color(0xFF35C6C3),
        );
      case 'royal-crown':
        final p = Path()
          ..moveTo(o.dx - r, o.dy + r * .55)
          ..lineTo(o.dx - r * .78, o.dy - r * .65)
          ..lineTo(o.dx - r * .25, o.dy - r * .12)
          ..lineTo(o.dx, o.dy - r)
          ..lineTo(o.dx + r * .28, o.dy - r * .12)
          ..lineTo(o.dx + r * .82, o.dy - r * .68)
          ..lineTo(o.dx + r, o.dy + r * .55)
          ..close();
        c.drawPath(p, fill);
        c.drawPath(p, stroke);
        for (final x in [-.62, 0.0, .62]) {
          c.drawCircle(
            Offset(o.dx + r * x, o.dy - r * .55),
            r * .1,
            Paint()..color = const Color(0xFFFF5D9E),
          );
        }
      case 'legendary-diamond':
        final p = Path()
          ..moveTo(o.dx, o.dy + r)
          ..lineTo(o.dx - r, o.dy - r * .25)
          ..lineTo(o.dx - r * .55, o.dy - r)
          ..lineTo(o.dx + r * .55, o.dy - r)
          ..lineTo(o.dx + r, o.dy - r * .25)
          ..close();
        c.drawPath(p, fill);
        c.drawPath(p, stroke);
        c.drawLine(
          Offset(o.dx - r, o.dy - r * .25),
          Offset(o.dx + r, o.dy - r * .25),
          stroke,
        );
        c.drawLine(
          Offset(o.dx - r * .55, o.dy - r),
          Offset(o.dx, o.dy + r),
          stroke,
        );
        c.drawLine(
          Offset(o.dx + r * .55, o.dy - r),
          Offset(o.dx, o.dy + r),
          stroke,
        );
      case 'the-universe':
        c.drawCircle(o, r * .62, fill);
        for (var i = 0; i < 3; i++) {
          c.drawOval(
            Rect.fromCenter(
              center: o,
              width: r * (2 - i * .25),
              height: r * (.55 + i * .18),
            ),
            stroke..color = Colors.white.withValues(alpha: .65),
          );
        }
        for (final d in const [
          Offset(-.75, -.25),
          Offset(.82, .18),
          Offset(.25, -.9),
        ]) {
          c.drawCircle(o + Offset(d.dx * r, d.dy * r), r * .12, fill);
        }
      default:
        c.drawCircle(o, r * .75, fill);
        c.drawCircle(o, r * .75, stroke);
    }
  }

  @override
  bool shouldRepaint(covariant _GiftPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.keyName != keyName ||
      oldDelegate.intensity != intensity;
}
