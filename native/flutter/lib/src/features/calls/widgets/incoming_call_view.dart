import 'package:flutter/material.dart';

import '../call_models.dart';
import '../call_theme.dart';
import 'call_avatar.dart';
import 'call_control_button.dart';

/// Full-screen incoming-call UI, ported from the web `IncomingCall` component:
/// an immersive slate/purple gradient backdrop, a pulsing ring around the
/// caller's avatar, the caller name + "Incoming voice/video call" line, and two
/// large actions — a red Decline and a green Accept (phone glyph for voice,
/// video glyph for video).
///
/// Presentational only: [onAccept] / [onDecline] are callbacks.
class IncomingCallView extends StatelessWidget {
  const IncomingCallView({
    super.key,
    required this.caller,
    required this.callType,
    required this.onAccept,
    required this.onDecline,
  });

  final CallParticipant caller;
  final CallType callType;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final isVideo = callType.isVideo;
    return _CallBackdrop(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            children: [
              const Spacer(flex: 2),
              CallAvatar(participant: caller, ringing: true),
              const SizedBox(height: 40),
              Text(
                caller.displayName,
                textAlign: TextAlign.center,
                style: CallTextStyles.callerName,
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const _PulseDot(),
                  const SizedBox(width: 8),
                  Text(
                    'Incoming ${isVideo ? 'video' : 'voice'} call',
                    style: CallTextStyles.statusLine,
                  ),
                ],
              ),
              const Spacer(flex: 3),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  CallControlButton.danger(
                    icon: Icons.call_end_rounded,
                    onPressed: onDecline,
                    label: 'Decline',
                    diameter: CallSizing.primaryActionButton,
                  ),
                  CallControlButton.accept(
                    icon: isVideo
                        ? Icons.videocam_rounded
                        : Icons.call_rounded,
                    onPressed: onAccept,
                    label: 'Accept',
                  ),
                ],
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shared immersive backdrop with two soft ambient colour blobs (web pink/blue
/// blurred circles). Reused across the incoming/outgoing/in-call surfaces.
class _CallBackdrop extends StatelessWidget {
  const _CallBackdrop({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: CallGradients.backdrop),
      child: Stack(
        children: [
          const Positioned(
            top: 120,
            left: -60,
            child: _Blob(color: CallColors.blobPink),
          ),
          const Positioned(
            bottom: 120,
            right: -60,
            child: _Blob(color: CallColors.blobBlue),
          ),
          Positioned.fill(child: child),
        ],
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      height: 260,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withValues(alpha: 0)],
        ),
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
    duration: const Duration(milliseconds: 1000),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween<double>(begin: 0.4, end: 1).animate(_controller),
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          color: CallColors.primary,
        ),
      ),
    );
  }
}

/// Public re-export of the immersive backdrop so the call screen can reuse it.
class CallBackdrop extends StatelessWidget {
  const CallBackdrop({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => _CallBackdrop(child: child);
}
