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
      showClose: true,
      showCancel: true,
      children: const [
        _ActionRow(
          value: CreateAction.video,
          icon: Icons.videocam_rounded,
          title: 'Video',
          description: 'Take video or choose from gallery',
          gradient: [Color(0xFF4F8CFF), Color(0xFF35C6C3)],
        ),
        _ActionRow(
          value: CreateAction.photo,
          icon: Icons.add_photo_alternate_rounded,
          title: 'Photo+',
          description: 'Share your thoughts',
          gradient: [Color(0xFF9B5CF6), Color(0xFFE455C7)],
        ),
        _ActionRow(
          value: CreateAction.story,
          icon: Icons.sensors_rounded,
          title: 'Story',
          description: 'Share for 24 hours',
          gradient: [Color(0xFFFF6FA5), Color(0xFFFF4D6D)],
        ),
        _ActionRow(
          value: CreateAction.goLive,
          icon: Icons.mic_rounded,
          title: 'Go Live',
          description: 'Start a live stream or audio space',
          gradient: [Color(0xFFFF6B5B), Color(0xFFFF3D6E)],
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
          gradient: [Color(0xFFFF6B5B), Color(0xFFFF3D6E)],
        ),
        _ActionRow(
          value: LiveCreateAction.audioSpace,
          icon: Icons.graphic_eq_rounded,
          title: 'Audio Space',
          description: 'Host a live voice conversation',
          gradient: [Color(0xFF4F8CFF), Color(0xFF35C6C3)],
        ),
      ],
    );
  }
}

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({
    required this.title,
    required this.children,
    this.subtitle,
    this.showClose = false,
    this.showCancel = false,
  });

  final String title;
  final String? subtitle;
  final bool showClose;
  final bool showCancel;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
        decoration: const BoxDecoration(
          color: Color(0xFF111318),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
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
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (showClose)
                  IconButton(
                    key: const Key('create-sheet-close'),
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                    color: const Color(0xFFA8AFBA),
                    tooltip: 'Close',
                  ),
              ],
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(
                subtitle!,
                style: const TextStyle(color: Color(0xFFA8AFBA), fontSize: 13),
              ),
            ],
            const SizedBox(height: 14),
            ...children,
            if (showCancel) ...[
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  key: const Key('create-sheet-cancel'),
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFD3D7DE),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
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
    required this.gradient,
  });

  final T value;
  final IconData icon;
  final String title;
  final String description;
  final List<Color> gradient;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: const Color(0xFF1A1D23),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          key: ValueKey('create-action-$value'),
          onTap: () => Navigator.of(context).pop<T>(value),
          borderRadius: BorderRadius.circular(12),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 72),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: gradient,
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(icon, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          description,
                          style: const TextStyle(
                            color: Color(0xFFA8AFBA),
                            fontSize: 13,
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
