import 'package:flutter/material.dart';

import '../chat_theme.dart';
import '../chat_view_models.dart';

/// The attachment kinds the composer's "+" entry point can offer. Mirrors the
/// web composer's attach menu (photo / camera / video / file / voice). Kept
/// local to the sheet so it does not widen the shared [ChatMediaKind] enum.
enum AttachmentOption { photo, camera, video, file, music, voiceNote }

/// Grid bottom-sheet presented when the user taps the composer's "+" button.
///
/// This is a *clearer entry point* than a single toast: it surfaces the real
/// set of attachment actions for parity with the web composer. Each tile simply
/// emits its [AttachmentOption]; the actual capture/upload pipeline is owned by
/// the screen (and is currently routed to the neutral "needs backend" handler
/// until the storage/upload contract is finalised).
///
/// Purely presentational — no plugin or repository access here.
class AttachmentOptionsSheet extends StatelessWidget {
  const AttachmentOptionsSheet({super.key, required this.onSelect});

  /// Fired with the chosen option. The sheet pops itself first.
  final void Function(AttachmentOption option) onSelect;

  static const List<_AttachmentSpec> _specs = [
    _AttachmentSpec(
      option: AttachmentOption.photo,
      icon: Icons.photo_library_outlined,
      label: 'Photo',
    ),
    _AttachmentSpec(
      option: AttachmentOption.camera,
      icon: Icons.photo_camera_outlined,
      label: 'Camera',
    ),
    _AttachmentSpec(
      option: AttachmentOption.video,
      icon: Icons.videocam_outlined,
      label: 'Video',
    ),
    _AttachmentSpec(
      option: AttachmentOption.file,
      icon: Icons.insert_drive_file_outlined,
      label: 'File',
    ),
    _AttachmentSpec(
      option: AttachmentOption.music,
      icon: Icons.music_note_rounded,
      label: 'Music',
    ),
    _AttachmentSpec(
      option: AttachmentOption.voiceNote,
      icon: Icons.mic_none,
      label: 'Audio note',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ChatSpacing.lg,
          ChatSpacing.sm,
          ChatSpacing.lg,
          ChatSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Grab handle.
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: ChatSpacing.md),
                decoration: BoxDecoration(
                  color: ChatColors.border,
                  borderRadius: ChatRadii.chip,
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(
                left: ChatSpacing.xs,
                bottom: ChatSpacing.md,
              ),
              child: Text('Attach', style: ChatTextStyles.sectionLabel),
            ),
            Wrap(
              spacing: ChatSpacing.lg,
              runSpacing: ChatSpacing.lg,
              children: [
                for (final spec in _specs)
                  _AttachmentTile(
                    spec: spec,
                    onTap: () {
                      Navigator.of(context).pop();
                      onSelect(spec.option);
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AttachmentSpec {
  const _AttachmentSpec({
    required this.option,
    required this.icon,
    required this.label,
  });

  final AttachmentOption option;
  final IconData icon;
  final String label;
}

class _AttachmentTile extends StatelessWidget {
  const _AttachmentTile({required this.spec, required this.onTap});

  final _AttachmentSpec spec;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              customBorder: const CircleBorder(),
              child: Container(
                width: 56,
                height: 56,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: ChatColors.muted,
                  shape: BoxShape.circle,
                ),
                child: Icon(spec.icon, size: 24, color: ChatColors.primary),
              ),
            ),
          ),
          const SizedBox(height: ChatSpacing.sm),
          Text(
            spec.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: ChatTextStyles.subtitle,
          ),
        ],
      ),
    );
  }
}
