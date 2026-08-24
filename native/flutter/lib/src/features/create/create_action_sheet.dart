import 'package:flutter/material.dart';

enum CreateAction { video, photo, story, goLive }

enum LiveCreateAction { videoLive, audioSpace }

Future<CreateAction?> showCreateActionSheet(BuildContext context) {
  return showModalBottomSheet<CreateAction>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0xB3000000),
    builder: (context) => const _CreateActionSheet(),
  );
}

Future<LiveCreateAction?> showLiveCreateActionSheet(BuildContext context) {
  return showModalBottomSheet<LiveCreateAction>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0xB3000000),
    builder: (context) => const _LiveCreateActionSheet(),
  );
}

class _CreateActionSheet extends StatelessWidget {
  const _CreateActionSheet();

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Create',
      subtitle: 'Choose what you want to share',
      children: const [
        _ActionRow(
          value: CreateAction.video,
          icon: Icons.videocam_rounded,
          title: 'Video',
          description: 'Take a video or choose from gallery',
          accent: Color(0xFF35C6C3),
        ),
        _ActionRow(
          value: CreateAction.photo,
          icon: Icons.add_photo_alternate_rounded,
          title: 'Photo+',
          description: 'Share your thoughts with images',
          accent: Color(0xFFFFC857),
        ),
        _ActionRow(
          value: CreateAction.story,
          icon: Icons.amp_stories_rounded,
          title: 'Story',
          description: 'Share for 24 hours',
          accent: Color(0xFF9B8AFB),
        ),
        _ActionRow(
          value: CreateAction.goLive,
          icon: Icons.sensors_rounded,
          title: 'Go Live',
          description: 'Start a live stream or audio space',
          accent: Color(0xFFFF5D73),
        ),
      ],
    );
  }
}

class _LiveCreateActionSheet extends StatelessWidget {
  const _LiveCreateActionSheet();

  @override
  Widget build(BuildContext context) {
    return _SheetFrame(
      title: 'Go Live',
      subtitle: 'Choose your live format',
      children: const [
        _ActionRow(
          value: LiveCreateAction.videoLive,
          icon: Icons.videocam_rounded,
          title: 'Video Live',
          description: 'Broadcast with camera and live chat',
          accent: Color(0xFFFF5D73),
        ),
        _ActionRow(
          value: LiveCreateAction.audioSpace,
          icon: Icons.graphic_eq_rounded,
          title: 'Audio Space',
          description: 'Host a live voice conversation',
          accent: Color(0xFF35C6C3),
        ),
      ],
    );
  }
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({
    required this.title,
    required this.subtitle,
    required this.children,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
        decoration: const BoxDecoration(
          color: Color(0xFF111318),
          borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
          border: Border(top: BorderSide(color: Color(0xFF2A2E36))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: const BoxDecoration(
                  color: Color(0xFF4A4F59),
                  borderRadius: BorderRadius.all(Radius.circular(2)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: const TextStyle(color: Color(0xFFA8AFBA), fontSize: 13),
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _ActionRow<T> extends StatelessWidget {
  const _ActionRow({
    required this.value,
    required this.icon,
    required this.title,
    required this.description,
    required this.accent,
  });

  final T value;
  final IconData icon;
  final String title;
  final String description;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: const Color(0xFF1A1D23),
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          key: ValueKey('create-action-$value'),
          onTap: () => Navigator.of(context).pop<T>(value),
          borderRadius: BorderRadius.circular(6),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 68),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Icon(icon, color: accent, size: 23),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          description,
                          style: const TextStyle(
                            color: Color(0xFFA8AFBA),
                            fontSize: 12,
                            height: 1.25,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: Color(0xFF777E89),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
