import 'package:flutter/material.dart';

import '../../../core/media/cached_image.dart';
import '../groups_theme.dart';

/// A circular avatar that renders a network image when available, otherwise a
/// gradient-filled initial. Shared by the group list, header, members sheet and
/// message bubbles so avatar treatment is consistent across the module.
class GroupAvatar extends StatelessWidget {
  const GroupAvatar({
    super.key,
    required this.initial,
    this.avatarUrl,
    this.size = GroupSpacing.avatarMd,
    this.showPresenceDot = false,
    this.presenceColor = GroupColors.online,
  });

  final String initial;
  final String? avatarUrl;
  final double size;
  final bool showPresenceDot;
  final Color presenceColor;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: GroupGradients.avatarFallback,
      ),
      child: Text(
        initial,
        style: TextStyle(
          fontSize: size * 0.4,
          fontWeight: FontWeight.w700,
          color: GroupColors.primaryForeground,
        ),
      ),
    );

    final avatar = CachedCircleAvatar(
      url: avatarUrl,
      radius: size / 2,
      fallback: fallback,
    );

    if (!showPresenceDot) return avatar;

    final dotSize = size * 0.28;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          Positioned(
            right: -1,
            bottom: -1,
            child: Container(
              width: dotSize,
              height: dotSize,
              decoration: BoxDecoration(
                color: presenceColor,
                shape: BoxShape.circle,
                border: Border.all(color: GroupColors.background, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
