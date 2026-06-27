import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/sync/conversation_starter.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../profile/user_profile.dart';
import 'chat/chat_mappers.dart';
import 'chat/chat_theme.dart';
import 'chat/chat_view_models.dart';
import 'chat/widgets/attachment_options_sheet.dart';
import 'chat/widgets/chat_composer.dart';
import 'chat/widgets/chat_message_bubble.dart';
import 'chat/widgets/conversation_list_tile.dart';
import 'chat/widgets/message_action_sheet.dart';
import 'chat/widgets/new_conversation_sheet.dart';
import 'message_models.dart';
import 'message_recipient.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({
    super.key,
    required this.messagesRepository,
    required this.conversationStarter,
    required this.profile,
    required this.realtimeVersion,
    this.initialConversationId,
  });

  final LocalMessagesRepositoryContract messagesRepository;
  final ConversationStarter conversationStarter;
  final UserProfile profile;
  final int realtimeVersion;
  final String? initialConversationId;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  String? _selectedConversationId;
  String? _selectedConversationTitle;
  late Future<List<ConversationSummary>> _conversationsFuture;

  @override
  void initState() {
    super.initState();
    _selectedConversationId = widget.initialConversationId;
    _conversationsFuture = widget.messagesRepository.loadConversations();
  }

  @override
  void didUpdateWidget(covariant MessagesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.realtimeVersion != widget.realtimeVersion) {
      setState(() {
        _conversationsFuture = widget.messagesRepository.loadConversations();
      });
    }
    if (oldWidget.initialConversationId != widget.initialConversationId &&
        widget.initialConversationId != null) {
      setState(() {
        _selectedConversationId = widget.initialConversationId;
        _selectedConversationTitle = null;
        _conversationsFuture = widget.messagesRepository.loadConversations();
      });
    }
  }

  void _openConversation(ConversationSummary summary) {
    setState(() {
      _selectedConversationId = summary.id;
      _selectedConversationTitle = summary.title;
    });
  }

  void _closeConversation() {
    setState(() {
      _selectedConversationId = null;
      _selectedConversationTitle = null;
      _conversationsFuture = widget.messagesRepository.loadConversations();
    });
  }

  Future<void> _openNewConversation() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: ChatColors.card,
      barrierColor: ChatColors.barrier,
      shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
      builder: (sheetContext) {
        return _NewConversationHost(
          conversationStarter: widget.conversationStarter,
          onStartChat: (recipient) async {
            Navigator.of(sheetContext).pop();
            final conversation = await widget.conversationStarter
                .startConversation(recipient: recipient);
            if (!mounted) return;
            setState(() {
              _selectedConversationId = conversation.id;
              _selectedConversationTitle = recipient.displayName;
              _conversationsFuture = widget.messagesRepository
                  .loadConversations();
            });
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_selectedConversationId != null) {
      return ConversationScreen(
        conversationId: _selectedConversationId!,
        initialTitle: _selectedConversationTitle,
        messagesRepository: widget.messagesRepository,
        profile: widget.profile,
        realtimeVersion: widget.realtimeVersion,
        onBack: _closeConversation,
      );
    }

    return ColoredBox(
      color: ChatColors.background,
      child: SafeArea(
        bottom: false,
        child: FutureBuilder<List<ConversationSummary>>(
          future: _conversationsFuture,
          builder: (context, snapshot) {
            final conversations = snapshot.data;
            if (conversations == null) {
              return const Center(
                child: CircularProgressIndicator(color: ChatColors.primary),
              );
            }

            return Column(
              children: [
                _InboxHeader(onNewChat: _openNewConversation),
                Expanded(
                  child: conversations.isEmpty
                      ? const _EmptyChatsState()
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(
                            vertical: ChatSpacing.sm,
                          ),
                          itemCount: conversations.length,
                          itemBuilder: (context, index) {
                            final summary = conversations[index];
                            return ConversationListTile(
                              conversation: conversationSummaryToView(summary),
                              currentUserId: widget.profile.displayName,
                              onTap: () => _openConversation(summary),
                            );
                          },
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _InboxHeader extends StatelessWidget {
  const _InboxHeader({required this.onNewChat});

  final VoidCallback onNewChat;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.lg,
        ChatSpacing.md,
        ChatSpacing.sm,
        ChatSpacing.sm,
      ),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              'Messages',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
                color: ChatColors.foreground,
              ),
            ),
          ),
          DecoratedBox(
            decoration: const BoxDecoration(
              gradient: ChatGradients.sendAction,
              shape: BoxShape.circle,
              boxShadow: ChatShadows.pink,
            ),
            child: IconButton(
              tooltip: 'New chat',
              onPressed: onNewChat,
              icon: const Icon(
                Icons.edit_outlined,
                color: ChatColors.primaryForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Stateful host that owns the new-conversation sheet's tab + search results so
/// [NewConversationSheet] itself stays purely presentational.
class _NewConversationHost extends StatefulWidget {
  const _NewConversationHost({
    required this.conversationStarter,
    required this.onStartChat,
  });

  final ConversationStarter conversationStarter;
  final void Function(MessageRecipient recipient) onStartChat;

  @override
  State<_NewConversationHost> createState() => _NewConversationHostState();
}

class _NewConversationHostState extends State<_NewConversationHost> {
  final _searchController = TextEditingController();
  NewConversationTab _tab = NewConversationTab.search;
  List<MessageRecipient> _recipients = const [];
  bool _isLoading = false;
  int _requestToken = 0;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _onQueryChanged(String query) async {
    final trimmed = query.trim();
    if (trimmed.length < 2) {
      setState(() {
        _recipients = const [];
        _isLoading = false;
      });
      return;
    }

    final token = ++_requestToken;
    setState(() => _isLoading = true);
    final results = await widget.conversationStarter.searchRecipients(trimmed);
    if (!mounted || token != _requestToken) return;
    setState(() {
      _recipients = results;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: FractionallySizedBox(
        heightFactor: 0.85,
        child: NewConversationSheet(
          searchController: _searchController,
          tab: _tab,
          results: _recipients.map(recipientToView).toList(),
          isLoading: _isLoading,
          onTabChanged: (tab) => setState(() => _tab = tab),
          onQueryChanged: _onQueryChanged,
          onStartChat: (recipient) {
            final match = _recipients.firstWhere(
              (r) => r.userId == recipient.user.id,
              orElse: () => MessageRecipient(
                userId: recipient.user.id,
                displayName: recipient.user.displayName,
                username: recipient.user.username ?? '',
                avatarUrl: recipient.user.avatarUrl,
              ),
            );
            widget.onStartChat(match);
          },
        ),
      ),
    );
  }
}

class ConversationScreen extends StatefulWidget {
  const ConversationScreen({
    super.key,
    required this.conversationId,
    required this.messagesRepository,
    required this.profile,
    required this.realtimeVersion,
    required this.onBack,
    this.initialTitle,
  });

  final String conversationId;
  final String? initialTitle;
  final LocalMessagesRepositoryContract messagesRepository;
  final UserProfile profile;
  final int realtimeVersion;
  final VoidCallback onBack;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _messageController = TextEditingController();
  late Future<List<LocalMessage>> _messagesFuture;
  String? _title;
  ReplyPreview? _replyTarget;

  // Local presence state for the other participant. There is no backend
  // presence/last-seen signal yet, so these hold their neutral defaults and the
  // header renders the neutral placeholder subtitle. When a realtime presence
  // source lands, convert these to mutable fields and drive them via setState —
  // the header reads them through [_headerView] with no further wiring.
  static const PresenceState _otherPresence = PresenceState.offline;
  static const ChatActivity _otherActivity = ChatActivity.none;
  static const int? _otherLastSeenMillis = null;

  String get _currentUserKey => widget.profile.displayName;

  /// Header model built from local state. The other-user identity is derived
  /// from the resolved conversation title (no profile in the local store yet);
  /// presence/activity come from the local fields above.
  ChatHeaderView get _headerView => ChatHeaderView(
    other: ChatUserRef(
      id: widget.conversationId,
      displayName: _title ?? 'Conversation',
    ),
    presence: _otherPresence,
    activity: _otherActivity,
    lastSeenMillis: _otherLastSeenMillis,
  );

  @override
  void initState() {
    super.initState();
    _title = widget.initialTitle;
    _messagesFuture = widget.messagesRepository.loadMessages(
      widget.conversationId,
    );
    _resolveTitle();
  }

  Future<void> _resolveTitle() async {
    if (_title != null && _title!.isNotEmpty) return;
    final conversation = await widget.messagesRepository.loadConversation(
      widget.conversationId,
    );
    if (!mounted || conversation == null) return;
    setState(() => _title = conversation.title);
  }

  @override
  void didUpdateWidget(covariant ConversationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.realtimeVersion != widget.realtimeVersion ||
        oldWidget.conversationId != widget.conversationId) {
      setState(() {
        _messagesFuture = widget.messagesRepository.loadMessages(
          widget.conversationId,
        );
      });
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    if (_messageController.text.trim().isEmpty) return;
    await widget.messagesRepository.queueMessage(
      conversationId: widget.conversationId,
      senderName: widget.profile.displayName,
      body: _messageController.text,
    );
    _messageController.clear();
    if (!mounted) return;
    setState(() {
      _replyTarget = null;
      _messagesFuture = widget.messagesRepository.loadMessages(
        widget.conversationId,
      );
    });
  }

  void _setReply(ChatMessageView message) {
    setState(() {
      _replyTarget = ReplyPreview(
        messageId: message.id,
        senderName: message.isMine ? 'You' : message.senderName,
        content: message.hasText ? message.body : 'Attachment',
        mediaKind: message.mediaKind,
      );
    });
  }

  void _openMessageActions(ChatMessageView message) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ChatColors.card,
      barrierColor: ChatColors.barrier,
      shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
      builder: (sheetContext) {
        return MessageActionSheet(
          message: message,
          onReact: (_) {
            Navigator.of(sheetContext).pop();
            _pendingBackend('Reactions');
          },
          onReply: () {
            Navigator.of(sheetContext).pop();
            _setReply(message);
          },
          onForward: () {
            Navigator.of(sheetContext).pop();
            _pendingBackend('Forwarding');
          },
          onStar: () {
            Navigator.of(sheetContext).pop();
            _pendingBackend('Starred messages');
          },
          onCopy: message.hasText
              ? () {
                  Navigator.of(sheetContext).pop();
                  Clipboard.setData(ClipboardData(text: message.body));
                  _toast('Copied to clipboard');
                }
              : null,
          onDelete: message.isMine
              ? () {
                  Navigator.of(sheetContext).pop();
                  _pendingBackend('Deleting messages');
                }
              : null,
          onReport: !message.isMine
              ? () {
                  Navigator.of(sheetContext).pop();
                  _pendingBackend('Reporting');
                }
              : null,
        );
      },
    );
  }

  void _pendingBackend(String feature) {
    _toast('$feature needs the final backend contract.');
  }

  /// Clearer attach entry point: a grid of attachment kinds. Each option routes
  /// to the neutral placeholder until the media-upload contract is finalised.
  void _openAttachmentOptions() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ChatColors.card,
      barrierColor: ChatColors.barrier,
      shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
      builder: (sheetContext) {
        return AttachmentOptionsSheet(
          onSelect: (option) {
            switch (option) {
              case AttachmentOption.photo:
                _pendingBackend('Photo attachments');
              case AttachmentOption.camera:
                _pendingBackend('Camera capture');
              case AttachmentOption.video:
                _pendingBackend('Video attachments');
              case AttachmentOption.file:
                _pendingBackend('File attachments');
              case AttachmentOption.voiceNote:
                _pendingBackend('Voice notes');
            }
          },
        );
      },
    );
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: ChatColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _ConversationHeader(
              title: _title ?? 'Conversation',
              header: _headerView,
              onBack: widget.onBack,
              onVoiceCall: () => _pendingBackend('Voice calling'),
              onVideoCall: () => _pendingBackend('Video calling'),
            ),
            Expanded(
              child: FutureBuilder<List<LocalMessage>>(
                future: _messagesFuture,
                builder: (context, snapshot) {
                  final messages = snapshot.data;
                  if (messages == null) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: ChatColors.primary,
                      ),
                    );
                  }
                  if (messages.isEmpty) {
                    return const _EmptyConversationState();
                  }

                  final views = localMessagesToViews(
                    messages,
                    currentUserKey: _currentUserKey,
                  );

                  return ListView.builder(
                    reverse: true,
                    padding: const EdgeInsets.symmetric(
                      horizontal: ChatSpacing.md,
                      vertical: ChatSpacing.md,
                    ),
                    itemCount: views.length,
                    itemBuilder: (context, index) {
                      final view = views[views.length - 1 - index];
                      return Padding(
                        padding: EdgeInsets.only(
                          top: view.isFirstInGroup ? ChatSpacing.sm : 2,
                        ),
                        child: ChatMessageBubble(
                          message: view,
                          onLongPress: () => _openMessageActions(view),
                          onSwipeReply: () => _setReply(view),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            ChatComposer(
              controller: _messageController,
              replyPreview: _replyTarget,
              onCancelReply: () => setState(() => _replyTarget = null),
              onSend: _sendMessage,
              onAttach: _openAttachmentOptions,
              onVoice: () => _pendingBackend('Voice notes'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConversationHeader extends StatelessWidget {
  const _ConversationHeader({
    required this.title,
    required this.onBack,
    required this.onVoiceCall,
    required this.onVideoCall,
    this.header,
  });

  final String title;

  /// Live presence/activity for the other participant. Populated from whatever
  /// local state exists; when null (the common case until the backend presence
  /// contract lands) the header falls back to the neutral sync subtitle.
  final ChatHeaderView? header;
  final VoidCallback onBack;
  final VoidCallback onVoiceCall;
  final VoidCallback onVideoCall;

  @override
  Widget build(BuildContext context) {
    final initial = title.trim().isEmpty
        ? '?'
        : title.trim().characters.first.toUpperCase();

    final presence = header?.presence ?? PresenceState.offline;
    final activity = header?.activity ?? ChatActivity.none;
    final showDot = presenceShowsDot(presence);

    return Container(
      height: ChatSpacing.headerHeight,
      padding: const EdgeInsets.symmetric(horizontal: ChatSpacing.xs),
      decoration: const BoxDecoration(
        color: ChatColors.card,
        border: Border(bottom: BorderSide(color: ChatColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: ChatColors.foreground),
            onPressed: onBack,
          ),
          SizedBox(
            width: ChatSpacing.avatarSm + 6,
            height: ChatSpacing.avatarSm + 6,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: ChatSpacing.avatarSm + 6,
                  height: ChatSpacing.avatarSm + 6,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    gradient: ChatGradients.avatarFallback,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    initial,
                    style: const TextStyle(
                      color: ChatColors.primaryForeground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (showDot)
                  Positioned(
                    right: -1,
                    bottom: -1,
                    child: Container(
                      width: ChatSpacing.onlineDot,
                      height: ChatSpacing.onlineDot,
                      decoration: BoxDecoration(
                        color: presence == PresenceState.activeNow
                            ? ChatColors.activeNow
                            : ChatColors.online,
                        shape: BoxShape.circle,
                        border: Border.all(color: ChatColors.card, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: ChatSpacing.sm),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ChatTextStyles.headerName,
                ),
                _HeaderSubtitle(
                  header: header,
                  presence: presence,
                  activity: activity,
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Voice call',
            onPressed: onVoiceCall,
            icon: const Icon(Icons.call_outlined, color: ChatColors.foreground),
          ),
          IconButton(
            tooltip: 'Video call',
            onPressed: onVideoCall,
            icon: const Icon(
              Icons.videocam_outlined,
              color: ChatColors.foreground,
            ),
          ),
        ],
      ),
    );
  }
}

/// The header's second line. Shows a live activity/presence string when local
/// state provides one, otherwise the neutral offline-sync placeholder so the
/// row never implies a presence signal the backend has not confirmed.
class _HeaderSubtitle extends StatelessWidget {
  const _HeaderSubtitle({
    required this.header,
    required this.presence,
    required this.activity,
  });

  final ChatHeaderView? header;
  final PresenceState presence;
  final ChatActivity activity;

  @override
  Widget build(BuildContext context) {
    // No local presence/activity signal yet -> keep the neutral sync copy.
    if (header == null ||
        (presence == PresenceState.offline &&
            activity == ChatActivity.none &&
            (header!.lastSeenMillis == null))) {
      return const Text(
        'Messages sync when online',
        style: ChatTextStyles.subtitle,
      );
    }

    final text = chatPresenceSubtitle(
      presence: presence,
      activity: activity,
      lastSeenMillis: header!.lastSeenMillis,
    );

    final isLive =
        activity != ChatActivity.none ||
        presence == PresenceState.online ||
        presence == PresenceState.activeNow;

    final color = activity != ChatActivity.none
        ? ChatColors.primary
        : (presence == PresenceState.activeNow
              ? ChatColors.activeNow
              : (presence == PresenceState.online
                    ? ChatColors.online
                    : ChatColors.mutedForeground));

    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: ChatTextStyles.subtitle.copyWith(
        color: color,
        fontStyle: activity != ChatActivity.none
            ? FontStyle.italic
            : FontStyle.normal,
        fontWeight: isLive ? FontWeight.w600 : FontWeight.normal,
      ),
    );
  }
}

class _EmptyChatsState extends StatelessWidget {
  const _EmptyChatsState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(ChatSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.forum_outlined,
              size: 48,
              color: ChatColors.mutedForeground,
            ),
            SizedBox(height: ChatSpacing.md),
            Text(
              'No conversations yet',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: ChatColors.foreground,
              ),
            ),
            SizedBox(height: ChatSpacing.xs),
            Text(
              'Tap the pencil to search for a user and start your first chat.',
              textAlign: TextAlign.center,
              style: ChatTextStyles.previewMuted,
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyConversationState extends StatelessWidget {
  const _EmptyConversationState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text(
        'Send a message to start the conversation.',
        style: ChatTextStyles.previewMuted,
      ),
    );
  }
}
