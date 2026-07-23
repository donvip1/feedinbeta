import 'package:flutter/material.dart';

import '../../feed/immersive/feed_immersive_theme.dart';
import 'studio_glass_button.dart';

/// Top control bar of the camera studio: close on the left, flash + flip on the
/// right, over a soft top scrim so the glass controls stay legible on any scene.
class StudioTopBar extends StatelessWidget {
  const StudioTopBar({
    super.key,
    required this.onClose,
    required this.onToggleFlash,
    required this.onFlip,
    required this.flashOn,
    this.canFlash = true,
  });

  final VoidCallback onClose;
  final VoidCallback onToggleFlash;
  final VoidCallback onFlip;
  final bool flashOn;
  final bool canFlash;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: FeedImmersiveTheme.topScrim),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            children: [
              StudioGlassButton(
                icon: Icons.close_rounded,
                semanticLabel: 'Close camera',
                onTap: onClose,
              ),
              const Spacer(),
              if (canFlash)
                StudioGlassButton(
                  icon: flashOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                  semanticLabel: flashOn ? 'Flash on' : 'Flash off',
                  active: flashOn,
                  accent: FeedImmersiveTheme.brandOrange,
                  onTap: onToggleFlash,
                ),
              const SizedBox(width: 12),
              StudioGlassButton(
                icon: Icons.cameraswitch_rounded,
                semanticLabel: 'Flip camera',
                onTap: onFlip,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
