import 'package:flutter/material.dart';

import '../channels_theme.dart';
import '../view_models/channel_view_models.dart';
import 'channel_avatar.dart';
import 'channel_subscribe_button.dart';

/// The header block at the top of the channel view: a gradient wash behind the
/// large avatar, the channel name (+ verified tick), the `@handle`, the
/// subscriber count, the description, and the Join / Joined toggle. The channel
/// owner sees an "Admin" pill instead of a Join toggle.
class ChannelHeader extends StatelessWidget {
  const ChannelHeader({
    super.key,
    required this.channel,
    required this.onToggleSubscribe,
    this.subscribeBusy = false,
  });

  final ChannelDetailView channel;
  final VoidCallback onToggleSubscribe;
  final bool subscribeBusy;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: ChannelGradients.headerWash,
        border: Border(bottom: BorderSide(color: ChannelColors.border)),
      ),
      padding: const EdgeInsets.fromLTRB(
        ChannelSpacing.lg,
        ChannelSpacing.md,
        ChannelSpacing.lg,
        ChannelSpacing.lg,
      ),
      child: Column(
        children: [
          ChannelAvatar(
            initial: channel.initial,
            avatarUrl: channel.avatarUrl,
            size: ChannelSpacing.avatarLg,
          ),
          const SizedBox(height: ChannelSpacing.md),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  channel.name,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: ChannelTextStyles.headerName,
                ),
              ),
              if (channel.isVerified) ...[
                const SizedBox(width: 6),
                const ChannelVerifiedTick(size: 18),
              ],
            ],
          ),
          if (channel.handle != null) ...[
            const SizedBox(height: 2),
            Text(channel.handle!, style: ChannelTextStyles.subtitle),
          ],
          const SizedBox(height: 6),
          Text(
            channel.subscriberLabel,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: ChannelColors.primaryGlow,
            ),
          ),
          if ((channel.description ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: ChannelSpacing.md),
            Text(
              channel.description!.trim(),
              textAlign: TextAlign.center,
              style: ChannelTextStyles.previewMuted,
            ),
          ],
          const SizedBox(height: ChannelSpacing.lg),
          if (channel.viewerRole == ChannelRole.owner ||
              channel.viewerRole == ChannelRole.admin)
            _AdminPill(isOwner: channel.viewerRole == ChannelRole.owner)
          else
            ChannelSubscribeButton(
              isSubscribed: channel.isSubscribed,
              busy: subscribeBusy,
              onTap: onToggleSubscribe,
            ),
        ],
      ),
    );
  }
}

class _AdminPill extends StatelessWidget {
  const _AdminPill({required this.isOwner});

  final bool isOwner;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: ChannelSpacing.md,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: ChannelColors.ownerBadgeBg,
        borderRadius: ChannelRadii.chip,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isOwner ? Icons.workspace_premium_rounded : Icons.shield_rounded,
            size: 15,
            color: ChannelColors.ownerBadge,
          ),
          const SizedBox(width: 6),
          Text(
            isOwner ? 'You own this channel' : 'You admin this channel',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: ChannelColors.ownerBadge,
            ),
          ),
        ],
      ),
    );
  }
}
