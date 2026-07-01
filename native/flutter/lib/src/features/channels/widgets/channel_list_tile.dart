import 'package:flutter/material.dart';

import '../channels_theme.dart';
import '../view_models/channel_view_models.dart';
import 'channel_avatar.dart';
import 'channel_subscribe_button.dart';

/// One row in a channels list (discover or my-channels). Mirrors the web
/// card-row treatment: a rounded `bg-muted/20` card with a hairline border, the
/// channel avatar, name (+ verified tick), a subscriber count / last-post
/// preview line, and a compact Join / Joined toggle on the trailing edge.
class ChannelListTile extends StatelessWidget {
  const ChannelListTile({
    super.key,
    required this.channel,
    required this.onTap,
    required this.onToggleSubscribe,
    this.subscribeBusy = false,
    this.showSubscribeButton = true,
  });

  final ChannelListItemView channel;
  final VoidCallback onTap;
  final VoidCallback onToggleSubscribe;
  final bool subscribeBusy;
  final bool showSubscribeButton;

  @override
  Widget build(BuildContext context) {
    final preview = channel.previewLine.trim();
    final secondLine = preview.isNotEmpty
        ? preview
        : channel.subscriberLabel;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: ChannelSpacing.md,
        vertical: 3,
      ),
      child: Material(
        color: ChannelColors.rowCard,
        borderRadius: ChannelRadii.card,
        child: InkWell(
          onTap: onTap,
          borderRadius: ChannelRadii.card,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ChannelSpacing.md,
              vertical: ChannelSpacing.md,
            ),
            constraints: const BoxConstraints(
              minHeight: ChannelSpacing.listItemMinHeight,
            ),
            decoration: BoxDecoration(
              borderRadius: ChannelRadii.card,
              border: Border.all(color: ChannelColors.rowCardBorder),
            ),
            child: Row(
              children: [
                ChannelAvatar(
                  initial: channel.initial,
                  avatarUrl: channel.avatarUrl,
                  size: ChannelSpacing.avatarMd,
                ),
                const SizedBox(width: ChannelSpacing.md),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              channel.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: ChannelTextStyles.channelName,
                            ),
                          ),
                          if (channel.isVerified) ...[
                            const SizedBox(width: 4),
                            const ChannelVerifiedTick(size: 15),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        secondLine,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: ChannelTextStyles.previewMuted,
                      ),
                      if (preview.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          channel.subscriberLabel,
                          style: ChannelTextStyles.timestamp,
                        ),
                      ],
                    ],
                  ),
                ),
                if (showSubscribeButton) ...[
                  const SizedBox(width: ChannelSpacing.sm),
                  ChannelSubscribeButton(
                    isSubscribed: channel.isSubscribed,
                    busy: subscribeBusy,
                    compact: true,
                    onTap: onToggleSubscribe,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
