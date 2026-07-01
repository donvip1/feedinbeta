import 'package:flutter/material.dart';

import '../channels_theme.dart';

/// The Join / Joined toggle used on channel rows and in the channel header.
///
/// Purely presentational: the parent owns the subscription state and the async
/// toggle. While [busy] the button shows a spinner and ignores taps.
class ChannelSubscribeButton extends StatelessWidget {
  const ChannelSubscribeButton({
    super.key,
    required this.isSubscribed,
    required this.onTap,
    this.busy = false,
    this.compact = false,
    this.enabled = true,
  });

  final bool isSubscribed;
  final VoidCallback onTap;
  final bool busy;

  /// Compact variant for list rows (smaller padding + text).
  final bool compact;

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final joined = isSubscribed;
    final label = joined ? 'Joined' : 'Join';
    final horizontal = compact ? ChannelSpacing.md : ChannelSpacing.lg;
    final vertical = compact ? 6.0 : ChannelSpacing.sm;
    final fontSize = compact ? 13.0 : 14.0;

    final child = busy
        ? SizedBox(
            width: fontSize + 2,
            height: fontSize + 2,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(
                joined
                    ? ChannelColors.mutedForeground
                    : ChannelColors.primaryForeground,
              ),
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (joined) ...[
                const Icon(
                  Icons.check,
                  size: 16,
                  color: ChannelColors.foreground,
                ),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: fontSize,
                  fontWeight: FontWeight.w700,
                  color: joined
                      ? ChannelColors.foreground
                      : ChannelColors.primaryForeground,
                ),
              ),
            ],
          );

    final decoration = joined
        ? BoxDecoration(
            color: ChannelColors.secondary,
            borderRadius: ChannelRadii.chip,
            border: Border.all(color: ChannelColors.border),
          )
        : const BoxDecoration(
            gradient: ChannelGradients.sendAction,
            borderRadius: ChannelRadii.chip,
            boxShadow: ChannelShadows.pink,
          );

    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: Colors.transparent,
        borderRadius: ChannelRadii.chip,
        child: InkWell(
          onTap: (enabled && !busy) ? onTap : null,
          borderRadius: ChannelRadii.chip,
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: horizontal,
              vertical: vertical,
            ),
            decoration: decoration,
            child: child,
          ),
        ),
      ),
    );
  }
}
