import 'package:flutter/material.dart';

import 'feed_immersive_theme.dart';

/// Handle used to fire the double-tap heart burst from outside the widget.
///
/// The post card holds one of these and calls [fire] on a double-tap (from the
/// media layer or a text card); the burst widget owns its own ticker so the
/// parent no longer needs a [TickerProvider].
class HeartBurstController {
  _HeartBurstState? _state;

  void fire() => _state?._fire();

  bool get isAttached => _state != null;
}

/// Centered double-tap "like" burst: a heart that pops with a settle overshoot
/// while a soft ring expands outward and fades. Purely decorative and wrapped
/// in [IgnorePointer]/[RepaintBoundary] so it never intercepts gestures or
/// repaints the media beneath it.
class HeartBurst extends StatefulWidget {
  const HeartBurst({super.key, required this.controller});

  final HeartBurstController controller;

  @override
  State<HeartBurst> createState() => _HeartBurstState();
}

class _HeartBurstState extends State<HeartBurst>
    with SingleTickerProviderStateMixin {
  late final AnimationController _burst;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;
  late final Animation<double> _ringScale;
  late final Animation<double> _ringOpacity;

  @override
  void initState() {
    super.initState();
    widget.controller._state = this;
    _burst = AnimationController(
      vsync: this,
      duration: FeedImmersiveTheme.motionBurst,
    );
    _scale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.4, end: 1.15)
            .chain(CurveTween(curve: FeedImmersiveTheme.popCurve)),
        weight: 45,
      ),
      TweenSequenceItem(tween: ConstantTween(1.15), weight: 25),
      TweenSequenceItem(
        tween: Tween(begin: 1.15, end: 1.45)
            .chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve)),
        weight: 30,
      ),
    ]).animate(_burst);
    _opacity = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 1.0)
            .chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve)),
        weight: 25,
      ),
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 40),
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 0.0)
            .chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve)),
        weight: 35,
      ),
    ]).animate(_burst);
    _ringScale = Tween(begin: 0.2, end: 1.9)
        .chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve))
        .animate(
          CurvedAnimation(parent: _burst, curve: const Interval(0.0, 0.6)),
        );
    _ringOpacity = Tween(begin: 0.55, end: 0.0)
        .chain(CurveTween(curve: FeedImmersiveTheme.premiumSettleCurve))
        .animate(
          CurvedAnimation(parent: _burst, curve: const Interval(0.0, 0.55)),
        );
  }

  void _fire() => _burst.forward(from: 0);

  @override
  void dispose() {
    if (widget.controller._state == this) widget.controller._state = null;
    _burst.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _burst,
            builder: (context, child) {
              if (_burst.isDismissed) return const SizedBox.shrink();
              return Stack(
                alignment: Alignment.center,
                children: [
                  Opacity(
                    opacity: _ringOpacity.value.clamp(0.0, 1.0),
                    child: Transform.scale(
                      scale: _ringScale.value,
                      child: Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: FeedImmersiveTheme.likeActive,
                            width: 6,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Opacity(
                    opacity: _opacity.value.clamp(0.0, 1.0),
                    child: Transform.scale(scale: _scale.value, child: child),
                  ),
                ],
              );
            },
            child: const Icon(
              Icons.favorite,
              color: FeedImmersiveTheme.likeActive,
              size: 120,
              shadows: FeedImmersiveTheme.textShadow,
            ),
          ),
        ),
      ),
    );
  }
}
