import 'package:flutter/material.dart';

import '../call_theme.dart';
import 'call_control_button.dart';

/// The row of in-call controls, ported from the web `CallControls` component:
/// mute, video toggle (or "switch to video" on an audio call), camera flip
/// (video only), screen-share toggle (voice + video), a central red hang-up,
/// and a speaker toggle.
///
/// Presentational only — every action is a callback; the widget reads no state
/// beyond the flags passed in.
class CallControlsBar extends StatelessWidget {
  const CallControlsBar({
    super.key,
    required this.isMuted,
    required this.isVideoOff,
    required this.isVideoCall,
    required this.isSpeakerOn,
    required this.onToggleMute,
    required this.onToggleSpeaker,
    required this.onEndCall,
    this.onToggleVideo,
    this.onFlipCamera,
    this.onUpgradeToVideo,
    this.isScreenSharing = false,
    this.onToggleScreenShare,
  });

  final bool isMuted;
  final bool isVideoOff;
  final bool isVideoCall;
  final bool isSpeakerOn;

  /// Whether the local screen is currently being shared (active tint).
  final bool isScreenSharing;

  final VoidCallback onToggleMute;
  final VoidCallback onToggleSpeaker;
  final VoidCallback onEndCall;

  /// Toggle the local camera (video calls). Null hides the affordance.
  final VoidCallback? onToggleVideo;

  /// Flip front/back camera (video calls). Null hides the affordance.
  final VoidCallback? onFlipCamera;

  /// Upgrade an audio call to video (web "Switch to video call"). Null hides it.
  final VoidCallback? onUpgradeToVideo;

  /// Toggle sharing the local screen (voice + video). Null hides the affordance.
  final VoidCallback? onToggleScreenShare;

  @override
  Widget build(BuildContext context) {
    final buttons = <Widget>[
      // Mute / unmute.
      CallControlButton.toggle(
        icon: isMuted ? Icons.mic_off_rounded : Icons.mic_rounded,
        active: isMuted,
        onPressed: onToggleMute,
        tooltip: isMuted ? 'Unmute' : 'Mute',
      ),

      // Video toggle (video call) or upgrade-to-video (audio call).
      if (isVideoCall && onToggleVideo != null)
        CallControlButton.toggle(
          icon: isVideoOff
              ? Icons.videocam_off_rounded
              : Icons.videocam_rounded,
          active: isVideoOff,
          onPressed: onToggleVideo!,
          tooltip: isVideoOff ? 'Turn on camera' : 'Turn off camera',
        )
      else if (!isVideoCall && onUpgradeToVideo != null)
        CallControlButton(
          icon: Icons.videocam_rounded,
          onPressed: onUpgradeToVideo!,
          background: CallColors.activeControlBg,
          foreground: CallColors.activeControlFg,
          tooltip: 'Switch to video call',
        ),

      // Flip camera (video call only).
      if (isVideoCall && onFlipCamera != null)
        CallControlButton.neutral(
          icon: Icons.cameraswitch_rounded,
          onPressed: onFlipCamera!,
          tooltip: 'Flip camera',
        ),

      // Screen share (both voice and video calls — web parity). Tinted pink
      // while active, like the speaker toggle.
      if (onToggleScreenShare != null)
        CallControlButton(
          icon: isScreenSharing
              ? Icons.stop_screen_share_rounded
              : Icons.screen_share_rounded,
          onPressed: onToggleScreenShare!,
          background: isScreenSharing
              ? CallColors.activeControlBg
              : CallColors.controlChip,
          foreground: isScreenSharing
              ? CallColors.activeControlFg
              : CallColors.controlIcon,
          tooltip: isScreenSharing ? 'Stop sharing' : 'Share screen',
        ),

      // End call (central, red).
      CallControlButton.danger(
        icon: Icons.call_end_rounded,
        onPressed: onEndCall,
        tooltip: 'End call',
      ),

      // Speaker toggle.
      CallControlButton(
        icon: isSpeakerOn
            ? Icons.volume_up_rounded
            : Icons.volume_down_rounded,
        onPressed: onToggleSpeaker,
        background: isSpeakerOn
            ? CallColors.activeControlBg
            : CallColors.controlChip,
        foreground: isSpeakerOn
            ? CallColors.activeControlFg
            : CallColors.controlIcon,
        tooltip: isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker',
      ),
    ];

    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 12,
      runSpacing: 12,
      children: buttons,
    );
  }
}
