import 'package:flutter/material.dart';

import '../call_models.dart';
import '../call_theme.dart';

/// Circular participant avatar for the call surfaces, with a gradient-filled
/// initials fallback (web `AvatarFallback`). Optionally shows a pulsing ring
/// (used by the outgoing/incoming screens while ringing).
class CallAvatar extends StatefulWidget {
  const CallAvatar({
    super.key,
    required this.participant,
    this.diameter = CallSizing.heroAvatar,
    this.ringing = false,
    this.borderColor = CallColors.avatarRing,
    this.borderWidth = 4,
  });

  final CallParticipant participant;
  final double diameter;

  /// When true, two expanding rings pulse behind the avatar (web `animate-ping`).
  final bool ringing;
  final Color borderColor;
  final double borderWidth;

  @override
  State<CallAvatar> createState() => _CallAvatarState();
}

class _CallAvatarState extends State<CallAvatar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: CallMotion.ringPulse,
  );

  @override
  void initState() {
    super.initState();
    if (widget.ringing) _controller.repeat();
  }

  @override
  void didUpdateWidget(covariant CallAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.ringing && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!widget.ringing && _controller.isAnimating) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final avatar = _buildAvatar();
    if (!widget.ringing) return avatar;

    return SizedBox(
      width: widget.diameter * 1.6,
      height: widget.diameter * 1.6,
      child: Stack(
        alignment: Alignment.center,
        children: [
          _buildPulseRing(0),
          _buildPulseRing(0.4),
          avatar,
        ],
      ),
    );
  }

  Widget _buildPulseRing(double phaseOffset) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = (_controller.value + phaseOffset) % 1.0;
        final scale = 1.0 + (t * 0.6);
        final opacity = (1.0 - t).clamp(0.0, 1.0) * 0.5;
        return Opacity(
          opacity: opacity,
          child: Transform.scale(
            scale: scale,
            child: Container(
              width: widget.diameter,
              height: widget.diameter,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: widget.borderColor,
                  width: widget.borderWidth,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildAvatar() {
    final url = widget.participant.avatarUrl;
    return Container(
      width: widget.diameter,
      height: widget.diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: (url == null || url.isEmpty)
            ? CallGradients.avatarFallback
            : null,
        border: Border.all(
          color: widget.borderColor,
          width: widget.borderWidth,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x80F04299), blurRadius: 40, spreadRadius: -8),
        ],
        image: (url != null && url.isNotEmpty)
            ? DecorationImage(image: NetworkImage(url), fit: BoxFit.cover)
            : null,
      ),
      alignment: Alignment.center,
      child: (url == null || url.isEmpty)
          ? Text(
              widget.participant.initial,
              style: CallTextStyles.avatarInitial.copyWith(
                fontSize: widget.diameter * 0.32,
              ),
            )
          : null,
    );
  }
}
