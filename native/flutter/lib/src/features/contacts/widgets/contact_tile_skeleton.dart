import 'package:flutter/material.dart';

import '../contacts_theme.dart';

/// A shimmer-free loading placeholder shaped like a contact row (avatar +
/// two text lines + a trailing pill). A short column of these stands in while
/// contacts are being read and matched.
class ContactTileSkeleton extends StatelessWidget {
  const ContactTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: ContactsSpacing.lg,
        vertical: ContactsSpacing.xs,
      ),
      padding: const EdgeInsets.all(ContactsSpacing.md),
      decoration: BoxDecoration(
        color: ContactsColors.rowCard,
        borderRadius: ContactsRadii.card,
        border: Border.all(color: ContactsColors.rowCardBorder),
      ),
      child: const Row(
        children: [
          _Block(width: ContactsSpacing.avatar, height: ContactsSpacing.avatar,
              circle: true),
          SizedBox(width: ContactsSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _Block(width: 140, height: 13),
                SizedBox(height: ContactsSpacing.sm),
                _Block(width: 90, height: 11),
              ],
            ),
          ),
          SizedBox(width: ContactsSpacing.sm),
          _Block(width: 76, height: 30),
        ],
      ),
    );
  }
}

class _Block extends StatelessWidget {
  const _Block({
    required this.width,
    required this.height,
    this.circle = false,
  });

  final double width;
  final double height;
  final bool circle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: ContactsColors.muted,
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : ContactsRadii.chip,
      ),
    );
  }
}
