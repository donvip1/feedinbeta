import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'feed_immersive_theme.dart';

/// Creator identity row for the post overlay: the author name in the strongest
/// typographic weight, an optional verified badge, and a quieter handle that
/// never competes with the caption.
///
/// When [onTap] is provided the name/handle become a single tappable target
/// (used to open the creator preview), with a subtle press scale and haptic.
class CreatorHeader extends StatefulWidget {
  const CreatorHeader({
    super.key,
    required this.authorName,
    this.handle = '',
    this.isVerified = false,
    this.onTap,
  });

  final String authorName;
  final String handle;
  final bool isVerified;
  final VoidCallback? onTap;

  @override
  State<CreatorHeader> createState() => _CreatorHeaderState();
}

class _CreatorHeaderState extends State<CreatorHeader> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final handle = widget.handle.trim();
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: Text(
            widget.authorName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: FeedImmersiveTheme.authorName,
          ),
        ),
        if (widget.isVerified) ...[
          const SizedBox(width: 5),
          const Icon(
            Icons.verified_rounded,
            color: FeedImmersiveTheme.brandPink,
            size: 16,
            shadows: FeedImmersiveTheme.textShadow,
          ),
        ],
        if (handle.isNotEmpty) ...[
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              handle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: FeedImmersiveTheme.handle,
            ),
          ),
        ],
      ],
    );

    if (widget.onTap == null) return row;

    return Semantics(
      button: true,
      label: 'Open ${widget.authorName} profile',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap!();
        },
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedScale(
          scale: _pressed ? 0.97 : 1,
          duration: FeedImmersiveTheme.motionPress,
          curve: FeedImmersiveTheme.premiumSettleCurve,
          alignment: Alignment.centerLeft,
          child: row,
        ),
      ),
    );
  }
}
