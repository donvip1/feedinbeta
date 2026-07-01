import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../call_theme.dart';

/// A single round call-control button (mute, video, speaker, flip, hang-up),
/// ported from the web `CallControls` button styling: a translucent white chip
/// by default, tinted red when it represents a "muted/off" state, or pink when
/// active. Optionally shows a label underneath (used for the big accept/decline
/// actions on the incoming/outgoing screens).
class CallControlButton extends StatelessWidget {
  const CallControlButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.diameter = CallSizing.controlButton,
    this.background = CallColors.controlChip,
    this.foreground = CallColors.controlIcon,
    this.label,
    this.tooltip,
    this.iconSize,
    this.pulsing = false,
  });

  /// A neutral chip button (white/10 bg).
  factory CallControlButton.neutral({
    required IconData icon,
    required VoidCallback onPressed,
    String? label,
    String? tooltip,
    double diameter = CallSizing.controlButton,
  }) {
    return CallControlButton(
      icon: icon,
      onPressed: onPressed,
      label: label,
      tooltip: tooltip,
      diameter: diameter,
    );
  }

  /// A toggled button that switches between neutral and an "off/danger" tint
  /// (web mute/camera-off styling).
  factory CallControlButton.toggle({
    required IconData icon,
    required VoidCallback onPressed,
    required bool active,
    String? label,
    String? tooltip,
    double diameter = CallSizing.controlButton,
  }) {
    return CallControlButton(
      icon: icon,
      onPressed: onPressed,
      label: label,
      tooltip: tooltip,
      diameter: diameter,
      background: active ? CallColors.mutedControlBg : CallColors.controlChip,
      foreground: active ? CallColors.mutedControlFg : CallColors.controlIcon,
    );
  }

  /// The red hang-up / decline button.
  factory CallControlButton.danger({
    required IconData icon,
    required VoidCallback onPressed,
    String? label,
    String? tooltip,
    double diameter = CallSizing.endCallButton,
    bool pulsing = false,
  }) {
    return CallControlButton(
      icon: icon,
      onPressed: onPressed,
      label: label,
      tooltip: tooltip,
      diameter: diameter,
      background: CallColors.decline,
      foreground: CallColors.primaryForeground,
      pulsing: pulsing,
    );
  }

  /// The green accept button.
  factory CallControlButton.accept({
    required IconData icon,
    required VoidCallback onPressed,
    String? label,
    String? tooltip,
    double diameter = CallSizing.acceptActionButton,
    bool pulsing = true,
  }) {
    return CallControlButton(
      icon: icon,
      onPressed: onPressed,
      label: label,
      tooltip: tooltip,
      diameter: diameter,
      background: CallColors.accept,
      foreground: CallColors.primaryForeground,
      pulsing: pulsing,
    );
  }

  final IconData icon;
  final VoidCallback onPressed;
  final double diameter;
  final Color background;
  final Color foreground;
  final String? label;
  final String? tooltip;
  final double? iconSize;
  final bool pulsing;

  @override
  Widget build(BuildContext context) {
    Widget button = _CircleButton(
      icon: icon,
      onPressed: onPressed,
      diameter: diameter,
      background: background,
      foreground: foreground,
      iconSize: iconSize ?? diameter * 0.36,
    );

    if (pulsing) {
      button = _PulseWrap(child: button);
    }

    if (tooltip != null) {
      button = Tooltip(message: tooltip!, child: button);
    }

    if (label == null) return button;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        button,
        const SizedBox(height: 8),
        Text(label!, style: CallTextStyles.actionLabel),
      ],
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    required this.onPressed,
    required this.diameter,
    required this.background,
    required this.foreground,
    required this.iconSize,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final double diameter;
  final Color background;
  final Color foreground;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          // Native-feeling tactile feedback on call actions (SDK-only; a no-op
          // on platforms/devices without a haptics channel).
          HapticFeedback.lightImpact();
          onPressed();
        },
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: diameter,
          height: diameter,
          child: Icon(icon, color: foreground, size: iconSize),
        ),
      ),
    );
  }
}

/// A subtle scale pulse behind accept/hang-up buttons (web `animate-pulse`).
class _PulseWrap extends StatefulWidget {
  const _PulseWrap({required this.child});

  final Widget child;

  @override
  State<_PulseWrap> createState() => _PulseWrapState();
}

class _PulseWrapState extends State<_PulseWrap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  late final Animation<double> _scale = Tween<double>(
    begin: 1.0,
    end: 1.06,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(scale: _scale, child: widget.child);
  }
}
