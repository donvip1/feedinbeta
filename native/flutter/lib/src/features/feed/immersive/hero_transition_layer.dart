import 'package:flutter/material.dart';

/// Wraps a circular avatar in a [Hero] so it flies smoothly between the action
/// rail and the creator preview, staying clipped to a disc for the whole
/// flight (no rectangular morph) and following a gentle centre arc.
///
/// Use the same [tag] on the source (rail) and destination (preview) avatars.
class CreatorAvatarHero extends StatelessWidget {
  const CreatorAvatarHero({super.key, required this.tag, required this.child});

  final Object tag;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Hero(
      tag: tag,
      createRectTween: (begin, end) =>
          MaterialRectCenterArcTween(begin: begin, end: end),
      flightShuttleBuilder:
          (flightContext, animation, direction, fromContext, toContext) {
            // Render the destination's avatar during the flight, clipped
            // circular, so the disc simply grows/shrinks between endpoints.
            final toHero = toContext.widget as Hero;
            return ClipOval(child: toHero.child);
          },
      child: child,
    );
  }
}
