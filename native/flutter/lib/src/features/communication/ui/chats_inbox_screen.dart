import 'package:flutter/material.dart';

import '../domain/conversation.dart';
import '../theme/communication_theme.dart';
import 'conversation_list_controller.dart';
import 'widgets/secure_plane_banner.dart';

/// The new Chats inbox from the UX north-star: "Messages & Calls" header,
/// secure-plane banner, and conversation tiles with inline voice/video call
/// buttons. Presentation-only — state lives in [ConversationListController],
/// actions are injected callbacks.
///
/// Dark until `CommsFlags.newChatsTab` wires it into the shell.
class ChatsInboxScreen extends StatelessWidget {
  const ChatsInboxScreen({
    super.key,
    required this.controller,
    required this.online,
    required this.onOpenConversation,
    required this.onVoiceCall,
    required this.onVideoCall,
  });

  final ConversationListController controller;
  final bool online;
  final void Function(Conversation conversation) onOpenConversation;
  final void Function(Conversation conversation) onVoiceCall;
  final void Function(Conversation conversation) onVideoCall;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: CommunicationTheme.canvas,
      child: SafeArea(
        child: AnimatedBuilder(
          animation: controller,
          builder: (context, _) {
            return RefreshIndicator(
              color: CommunicationTheme.brandPink,
              onRefresh: controller.refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(CommunicationTheme.spaceLg),
                children: [
                  const Text(
                    'Messages & Calls',
                    style: CommunicationTheme.titleLarge,
                  ),
                  const SizedBox(height: CommunicationTheme.spaceLg),
                  SecurePlaneBanner(online: online),
                  const SizedBox(height: CommunicationTheme.spaceLg),
                  if (controller.loading)
                    const Padding(
                      padding: EdgeInsets.only(top: 48),
                      child: Center(
                        child: CircularProgressIndicator(
                          color: CommunicationTheme.brandPink,
                        ),
                      ),
                    )
                  else if (controller.conversations.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 48),
                      child: Center(
                        child: Text(
                          'No conversations yet.',
                          style: CommunicationTheme.threadPreview,
                        ),
                      ),
                    )
                  else
                    for (final conversation in controller.conversations) ...[
                      ConversationTile(
                        conversation: conversation,
                        onTap: () => onOpenConversation(conversation),
                        onVoiceCall: () => onVoiceCall(conversation),
                        onVideoCall: () => onVideoCall(conversation),
                      ),
                      const SizedBox(height: CommunicationTheme.spaceMd),
                    ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// One inbox row: avatar, title, preview, unread badge, and the north-star's
/// inline emerald voice / pink video call buttons.
class ConversationTile extends StatelessWidget {
  const ConversationTile({
    super.key,
    required this.conversation,
    required this.onTap,
    required this.onVoiceCall,
    required this.onVideoCall,
  });

  final Conversation conversation;
  final VoidCallback onTap;
  final VoidCallback onVoiceCall;
  final VoidCallback onVideoCall;

  @override
  Widget build(BuildContext context) {
    final hasAvatar = conversation.avatarUrl?.isNotEmpty == true;
    final initial = (conversation.title ?? '?').trim();
    return Material(
      color: CommunicationTheme.surface,
      borderRadius: BorderRadius.circular(CommunicationTheme.radiusLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(CommunicationTheme.radiusLg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(CommunicationTheme.spaceMd),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: CommunicationTheme.surfaceRaised,
                backgroundImage: hasAvatar
                    ? NetworkImage(conversation.avatarUrl!)
                    : null,
                child: hasAvatar
                    ? null
                    : Text(
                        initial.isEmpty ? '?' : initial[0].toUpperCase(),
                        style: const TextStyle(
                          color: CommunicationTheme.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
              ),
              const SizedBox(width: CommunicationTheme.spaceMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      conversation.title ?? 'feedIn chat',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: CommunicationTheme.threadTitle,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      conversation.lastMessagePreview ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: CommunicationTheme.threadPreview,
                    ),
                  ],
                ),
              ),
              if (conversation.unreadCount > 0) ...[
                const SizedBox(width: CommunicationTheme.spaceSm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: CommunicationTheme.brandPink,
                    borderRadius: BorderRadius.circular(
                      CommunicationTheme.radiusPill,
                    ),
                  ),
                  child: Text(
                    conversation.unreadCount > 99
                        ? '99+'
                        : '${conversation.unreadCount}',
                    style: const TextStyle(
                      color: CommunicationTheme.ink,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
              const SizedBox(width: CommunicationTheme.spaceSm),
              _CallButton(
                icon: Icons.call_rounded,
                color: CommunicationTheme.secureEmerald,
                semanticLabel: 'Voice call',
                onTap: onVoiceCall,
              ),
              const SizedBox(width: CommunicationTheme.spaceSm),
              _CallButton(
                icon: Icons.videocam_rounded,
                color: CommunicationTheme.brandPink,
                semanticLabel: 'Video call',
                onTap: onVideoCall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CallButton extends StatelessWidget {
  const _CallButton({
    required this.icon,
    required this.color,
    required this.semanticLabel,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String semanticLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(CommunicationTheme.radiusMd),
        child: InkWell(
          borderRadius: BorderRadius.circular(CommunicationTheme.radiusMd),
          onTap: onTap,
          child: SizedBox(
            width: 40,
            height: 40,
            child: Icon(icon, color: color, size: 18),
          ),
        ),
      ),
    );
  }
}
