import 'package:flutter/material.dart';

import '../../../core/media/cached_image.dart';
import '../contacts_theme.dart';

/// A circular avatar for a contact row: shows the network image when available,
/// otherwise a gradient circle with the name's initial. Shared by the matched
/// ("On feedIn") and invite rows.
class ContactAvatar extends StatelessWidget {
  const ContactAvatar({
    super.key,
    required this.name,
    this.avatarUrl,
    this.size = ContactsSpacing.avatar,
  });

  final String name;
  final String? avatarUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = avatarUrl;
    final initial = _initialOf(name);
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: ContactsGradients.avatarFallback,
      ),
      alignment: Alignment.center,
      child: url != null && url.isNotEmpty
          ? CachedImage(
              url: url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorWidget: _Initial(initial),
            )
          : _Initial(initial),
    );
  }

  static String _initialOf(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '?';
    final first = trimmed.replaceFirst(RegExp('^@'), '');
    return first.isEmpty ? '?' : first[0].toUpperCase();
  }
}

class _Initial extends StatelessWidget {
  const _Initial(this.initial);

  final String initial;

  @override
  Widget build(BuildContext context) {
    return Text(
      initial,
      style: const TextStyle(
        color: ContactsColors.primaryForeground,
        fontWeight: FontWeight.w800,
        fontSize: 16,
      ),
    );
  }
}
