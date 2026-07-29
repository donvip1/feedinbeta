import 'package:flutter/material.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import 'studio_shutter.dart';

/// Capture modes offered by the studio. Video modes carry a soft max duration.
enum StudioCaptureMode { video15, video60, photo }

extension StudioCaptureModeX on StudioCaptureMode {
  bool get isVideo => this != StudioCaptureMode.photo;
  String get label => switch (this) {
    StudioCaptureMode.video15 => '15s',
    StudioCaptureMode.video60 => '60s',
    StudioCaptureMode.photo => 'Photo',
  };
  Duration? get maxDuration => switch (this) {
    StudioCaptureMode.video15 => const Duration(seconds: 15),
    StudioCaptureMode.video60 => const Duration(seconds: 60),
    StudioCaptureMode.photo => null,
  };
}

/// Bottom capture bar: the mode selector, then gallery and shutter controls
/// over a bottom scrim. Creative filters live only in the right-side tool rail.
class StudioCaptureControls extends StatelessWidget {
  const StudioCaptureControls({
    super.key,
    required this.mode,
    required this.isRecording,
    required this.onModeChanged,
    required this.onShutter,
    required this.onGallery,
  });

  final StudioCaptureMode mode;
  final bool isRecording;
  final ValueChanged<StudioCaptureMode> onModeChanged;
  final VoidCallback onShutter;
  final VoidCallback onGallery;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            FeedImmersiveTheme.overlayBottomMax,
            FeedImmersiveTheme.overlayBottomStrong,
            Colors.transparent,
          ],
          stops: [0.0, 0.5, 1.0],
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!isRecording) ...[
                _ModeSelector(mode: mode, onModeChanged: onModeChanged),
                const SizedBox(height: 22),
              ] else
                const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _SquareGlassButton(
                    icon: Icons.photo_library_rounded,
                    label: 'Gallery',
                    onTap: isRecording ? null : onGallery,
                  ),
                  const SizedBox(width: 40),
                  StudioShutter(isRecording: isRecording, onTap: onShutter),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeSelector extends StatelessWidget {
  const _ModeSelector({required this.mode, required this.onModeChanged});

  final StudioCaptureMode mode;
  final ValueChanged<StudioCaptureMode> onModeChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (final m in StudioCaptureMode.values) ...[
          _ModeChip(
            label: m.label,
            selected: m == mode,
            onTap: () => onModeChanged(m),
          ),
          if (m != StudioCaptureMode.values.last) const SizedBox(width: 22),
        ],
      ],
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedDefaultTextStyle(
            duration: FeedImmersiveTheme.motionFast,
            curve: FeedImmersiveTheme.premiumSettleCurve,
            style: TextStyle(
              color: selected
                  ? FeedImmersiveTheme.brandPink
                  : FeedImmersiveTheme.inkMuted,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              shadows: FeedImmersiveTheme.textShadow,
            ),
            child: Text(label),
          ),
          const SizedBox(height: 4),
          AnimatedContainer(
            duration: FeedImmersiveTheme.motionFast,
            curve: FeedImmersiveTheme.premiumSettleCurve,
            height: 3,
            width: selected ? 16 : 0,
            decoration: const BoxDecoration(
              gradient: FeedImmersiveTheme.brandGradient,
              borderRadius: BorderRadius.all(Radius.circular(2)),
            ),
          ),
        ],
      ),
    );
  }
}

class _SquareGlassButton extends StatelessWidget {
  const _SquareGlassButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      button: true,
      label: label,
      child: Opacity(
        opacity: enabled ? 1 : FeedImmersiveTheme.opacityDisabled,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: FeedImmersiveTheme.glassHighlight,
              borderRadius: BorderRadius.circular(FeedImmersiveTheme.radiusMd),
              border: Border.all(color: FeedImmersiveTheme.glassBorder),
            ),
            child: Icon(
              icon,
              color: FeedImmersiveTheme.onMedia,
              size: FeedImmersiveTheme.iconMd,
            ),
          ),
        ),
      ),
    );
  }
}
