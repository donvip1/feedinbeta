import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../feed/immersive/feed_immersive_theme.dart';

/// Center shutter: a white ring around a gradient core for photo, morphing to a
/// red core with a pulsing ring while recording video.
class StudioShutter extends StatefulWidget {
  const StudioShutter({
    super.key,
    required this.isRecording,
    required this.onTap,
  });

  final bool isRecording;
  final VoidCallback onTap;

  @override
  State<StudioShutter> createState() => _StudioShutterState();
}

class _StudioShutterState extends State<StudioShutter>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: FeedImmersiveTheme.motionLivePulse,
    );
    if (widget.isRecording) _pulse.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant StudioShutter oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRecording && !oldWidget.isRecording) {
      _pulse.repeat(reverse: true);
    } else if (!widget.isRecording && oldWidget.isRecording) {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.isRecording ? 'Stop recording' : 'Capture',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.mediumImpact();
          widget.onTap();
        },
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedScale(
          scale: _pressed ? 0.94 : 1,
          duration: FeedImmersiveTheme.motionPress,
          curve: FeedImmersiveTheme.premiumSettleCurve,
          child: SizedBox(
            width: 84,
            height: 84,
            child: AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) {
                final t = Curves.easeInOut.transform(_pulse.value);
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    // Outer ring (pulses while recording).
                    Container(
                      width: 84 - (widget.isRecording ? 6 * (1 - t) : 0),
                      height: 84 - (widget.isRecording ? 6 * (1 - t) : 0),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: widget.isRecording
                              ? FeedImmersiveTheme.likeActive
                              : FeedImmersiveTheme.onMedia,
                          width: 5,
                        ),
                      ),
                    ),
                    // Inner core.
                    AnimatedContainer(
                      duration: FeedImmersiveTheme.motionPop,
                      curve: FeedImmersiveTheme.premiumSettleCurve,
                      width: widget.isRecording ? 32 : 66,
                      height: widget.isRecording ? 32 : 66,
                      decoration: BoxDecoration(
                        gradient: widget.isRecording
                            ? null
                            : FeedImmersiveTheme.brandGradient,
                        color: widget.isRecording
                            ? FeedImmersiveTheme.likeActive
                            : null,
                        shape:
                            widget.isRecording ? BoxShape.rectangle : BoxShape.circle,
                        borderRadius: widget.isRecording
                            ? BorderRadius.circular(8)
                            : null,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
