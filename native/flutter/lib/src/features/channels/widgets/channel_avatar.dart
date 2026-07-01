import 'package:flutter/material.dart';

import '../channels_theme.dart';

/// A circular channel avatar: renders a network image when available, otherwise
/// a gradient-filled initial. Shared by the channels list, header and create
/// preview so avatar treatment is consistent across the module.
class ChannelAvatar extends StatelessWidget {
  const ChannelAvatar({
    super.key,
    required this.initial,
    this.avatarUrl,
    this.size = ChannelSpacing.avatarMd,
  });

  final String initial;
  final String? avatarUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: ChannelGradients.avatarFallback,
      ),
      child: Text(
        initial,
        style: TextStyle(
          fontSize: size * 0.4,
          fontWeight: FontWeight.w700,
          color: ChannelColors.primaryForeground,
        ),
      ),
    );

    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: (avatarUrl != null && avatarUrl!.isNotEmpty)
            ? Image.network(
                avatarUrl!,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => fallback,
              )
            : fallback,
      ),
    );
  }
}

/// The small sky-blue verified tick used next to a channel name.
class ChannelVerifiedTick extends StatelessWidget {
  const ChannelVerifiedTick({super.key, this.size = 16});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: ChannelColors.verified,
        shape: BoxShape.circle,
      ),
      child: Icon(
        Icons.check,
        size: size * 0.68,
        color: ChannelColors.background,
      ),
    );
  }
}
