/// Circular profile avatar with a brand gradient-initials fallback.
///
/// Mirrors the web `Avatar` + `AvatarFallback` pair used across the profile
/// surface (modals, history rows, header). When [imageUrl] is present it loads
/// the network image; on missing/failed image it falls back to the
/// primary->accent gradient with the user's first-letter initial (web
/// `bg-gradient-to-br from-primary to-accent text-primary-foreground`).
///
/// Pure presentational; depends only on the Flutter SDK + profile tokens.
library;

import 'package:flutter/material.dart';

import '../profile_tokens.dart';

/// A round avatar of [diameter] px. Falls back to a gradient + [initial] when
/// no usable [imageUrl] is provided or the image fails to load.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.diameter,
    required this.initial,
    this.imageUrl,
  });

  final double diameter;

  /// First-letter fallback (already upper-cased by the caller's view-model).
  final String initial;
  final String? imageUrl;

  bool get _hasImage => imageUrl != null && imageUrl!.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final fallback = _GradientInitial(diameter: diameter, initial: initial);
    return ClipOval(
      child: SizedBox(
        width: diameter,
        height: diameter,
        child: _hasImage
            ? Image.network(
                imageUrl!,
                width: diameter,
                height: diameter,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => fallback,
                loadingBuilder: (context, child, progress) =>
                    progress == null ? child : fallback,
              )
            : fallback,
      ),
    );
  }
}

class _GradientInitial extends StatelessWidget {
  const _GradientInitial({required this.diameter, required this.initial});

  final double diameter;
  final String initial;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: ProfileGradients.avatarFallback,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          initial,
          style: TextStyle(
            color: ProfileColors.primaryForeground,
            fontWeight: FontWeight.w700,
            fontSize: diameter * 0.4,
          ),
        ),
      ),
    );
  }
}
