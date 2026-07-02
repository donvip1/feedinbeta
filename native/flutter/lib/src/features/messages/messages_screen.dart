import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'package:file_picker/file_picker.dart';

import '../../core/sync/conversation_starter.dart';
import '../../core/sync/sync_service.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../calls/call_controller.dart';
import '../calls/call_models.dart';
import '../calls/call_screen.dart';
import '../profile/user_profile.dart';
import 'chat/audio_backends_impl.dart';
import 'chat/audio_message_support.dart';
import 'chat/chat_mappers.dart';
import 'chat/chat_theme.dart';
import 'chat/chat_view_models.dart';
import 'chat/widgets/attachment_options_sheet.dart';
import 'chat/widgets/audio_note_recorder_sheet.dart';
import 'chat/widgets/chat_composer.dart';
import 'chat/widgets/chat_message_bubble.dart';
import 'chat/widgets/conversation_list_tile.dart';
import 'chat/widgets/media_message_content.dart';
import 'chat/widgets/message_action_sheet.dart';
import 'chat/widgets/music_message_bubble.dart';
import 'chat/widgets/new_conversation_sheet.dart';
import 'chat/widgets/typing_indicator_bubble.dart';
import 'chat/widgets/voice_note_bubble.dart';
import 'message_models.dart';
import 'message_recipient.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({
    super.key,
    required this.messagesRepository,
    required this.conversationStarter,
    required this.syncService,
    required this.profile,
    required this.realtimeVersion,
    this.initialConversationId,
    this.callController,
  });

  final LocalMessagesRepositoryContract messagesRepository;
  final ConversationStarter conversationStarter;
  final SyncServiceContract syncService;
  final UserProfile profile;
  final int realtimeVersion;
  final String? initialConversationId;

  /// Shared, long-lived call controller from the app shell. When provided, a
  /// conversation's header voice/video buttons place a real 1:1 call. Optional
  /// so tests and standalone use still work (buttons show a "coming soon" note).
  final CallController? callController;

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
        syncService: widget.syncService,
        profile: widget.profile,
        realtimeVersion: widget.realtimeVersion,
        onBack: _closeConversation,
        callController: widget.callController,
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
                          // Cards carry their own horizontal margin + inter-card
                          // gap; the list only adds a small top/bottom breathing
                          // room so the first/last card isn't flush to an edge.
                          padding: const EdgeInsets.only(
                            top: ChatSpacing.xs,
                            bottom: ChatSpacing.lg,
                          ),
                          itemCount: conversations.length,
                          itemBuilder: (context, index) {
                            final summary = conversations[index];
                            return ConversationListTile(
                              conversation: conversationSummaryToView(summary),
                              currentUserId: widget.profile.userId,
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
    required this.syncService,
    required this.profile,
    required this.realtimeVersion,
    required this.onBack,
    this.initialTitle,
    this.callController,
  });

  final String conversationId;
  final String? initialTitle;
  final LocalMessagesRepositoryContract messagesRepository;
  final SyncServiceContract syncService;
  final UserProfile profile;
  final int realtimeVersion;
  final VoidCallback onBack;

  /// Shared call controller from the shell. When set (and the other user's id
  /// resolves), the header voice/video buttons place a real 1:1 call.
  final CallController? callController;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _messageController = TextEditingController();
  final _picker = ImagePicker();
  late Future<List<LocalMessage>> _messagesFuture;
  String? _title;
  ReplyPreview? _replyTarget;
  PresenceState _otherPresence = PresenceState.offline;
  static const ChatActivity _otherActivity = ChatActivity.none;
  int? _otherLastSeenMillis;

  /// The other participant's identity, resolved from the conversation record so
  /// the header can place a call to them. Null until resolved (or for group /
  /// self-only conversations without a distinct other user).
  String? _otherUserId;
  String? _otherUserAvatarUrl;

  /// Identity-based key for "isMine" — the local profile's user id, which
  /// matches `messages.sender_id` from the server. Falls back to the display
  /// name only when the id is somehow empty so grouping still works offline.
  String get _currentUserKey => widget.profile.userId.isNotEmpty
      ? widget.profile.userId
      : widget.profile.displayName;

  /// First word of the resolved conversation title, used to personalise the
  /// in-thread typing caption ("{name} is typing…"). Null when unknown.
  String? _firstName(String? title) {
    final trimmed = title?.trim();
    if (trimmed == null || trimmed.isEmpty) return null;
    final first = trimmed.split(RegExp(r'\s+')).first;
    return first.isEmpty ? null : first;
  }

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
    _markReadLocally();
  }

  Future<void> _resolveTitle() async {
    final conversation = await widget.messagesRepository.loadConversation(
      widget.conversationId,
    );
    if (!mounted || conversation == null) return;
    setState(() {
      _title = (_title != null && _title!.isNotEmpty)
          ? _title
          : conversation.title;
      _otherPresence = conversationPresence(conversation);
      _otherLastSeenMillis = conversationLastSeenMillis(conversation);
      _otherUserId = conversation.otherUserId;
      _otherUserAvatarUrl = conversation.otherUserAvatarUrl;
    });
  }

  Future<void> _markReadLocally() async {
    await widget.messagesRepository.markConversationRead(widget.conversationId);
    await _markReadRemotely();
    if (!mounted) return;
    setState(() {
      _messagesFuture = widget.messagesRepository.loadMessages(
        widget.conversationId,
      );
    });
  }

  Future<void> _markReadRemotely() async {
    final conversation = await widget.messagesRepository.loadConversation(
      widget.conversationId,
    );
    final serverConversationId = conversation?.serverConversationId;
    if (serverConversationId == null || serverConversationId.isEmpty) return;
    try {
      await Supabase.instance.client.rpc<void>(
        'mark_conversation_read',
        params: {'p_conversation_id': serverConversationId},
      );
    } catch (_) {
      // Offline-first: local unread clearing should not fail because the remote
      // receipt RPC is temporarily unavailable.
    }
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
      _resolveTitle();
      _markReadLocally();
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
      senderId: widget.profile.userId.isEmpty ? null : widget.profile.userId,
      senderAvatarUrl: widget.profile.avatarUrl,
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
    await _syncMessages();
  }

  Future<void> _syncMessages() async {
    await widget.syncService.syncNow();
    if (!mounted) return;
    setState(() {
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

  /// Place a 1:1 [type] call to the other participant from the chat header.
  ///
  /// Requires the shared [CallController] (from the shell) and a resolved
  /// [_otherUserId]. Uses [CallScreen.start], which inserts the call log and
  /// pushes the immersive call screen; a null return means the call could not
  /// be placed (unconfigured / signed out / already in a call).
  Future<void> _startCall(CallType type) async {
    final controller = widget.callController;
    final calleeId = _otherUserId;
    final kind = type.isVideo ? 'Video calling' : 'Voice calling';
    if (controller == null || calleeId == null || calleeId.isEmpty) {
      // No controller wired (tests/standalone) or the other user hasn't
      // resolved yet (e.g. a brand-new local conversation without a server id).
      _pendingBackend(kind);
      return;
    }
    final session = await CallScreen.start(
      context,
      controller: controller,
      callee: CallParticipant(
        userId: calleeId,
        displayName: _title ?? 'feedIn user',
        avatarUrl: _otherUserAvatarUrl,
      ),
      type: type,
    );
    if (session == null && mounted) {
      _toast("Couldn't start the call. Check your connection and try again.");
    }
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
          onSelect: (option) async {
            switch (option) {
              case AttachmentOption.photo:
                await _pickAttachment(
                  source: ImageSource.gallery,
                  mediaType: 'image',
                );
              case AttachmentOption.camera:
                await _pickAttachment(
                  source: ImageSource.camera,
                  mediaType: 'image',
                );
              case AttachmentOption.video:
                await _pickAttachment(
                  source: ImageSource.gallery,
                  mediaType: 'video',
                );
              case AttachmentOption.file:
                _pendingBackend('File attachments');
              case AttachmentOption.music:
                await _shareMusicFile();
              case AttachmentOption.voiceNote:
                await _recordAudioNote();
            }
          },
        );
      },
    );
  }

  Future<void> _pickAttachment({
    required ImageSource source,
    required String mediaType,
  }) async {
    final XFile? picked = mediaType == 'video'
        ? await _picker.pickVideo(source: source)
        : await _picker.pickImage(source: source);
    if (picked == null) return;

    final localPath = await _persistPickedAttachment(picked);
    await widget.messagesRepository.queueAttachment(
      conversationId: widget.conversationId,
      senderName: widget.profile.displayName,
      localPath: localPath,
      mediaType: mediaType,
      mimeType: picked.mimeType,
      fileName: picked.name,
      fileSizeBytes: await File(localPath).length(),
    );
    if (!mounted) return;
    setState(() {
      _messagesFuture = widget.messagesRepository.loadMessages(
        widget.conversationId,
      );
    });
    await _syncMessages();
  }

  // ---------------------------------------------------------------------------
  // Audio: music-file sharing (≤ 4min) + recorded audio notes
  // ---------------------------------------------------------------------------

  /// Music/audio FILE sharing entry point. Picking an arbitrary audio file needs
  /// `file_picker` (image_picker cannot select audio files), so until that dep is
  /// wired this surfaces a clear message. The full pipeline once a file is
  /// available runs through [_queueAudioAttachment] with a validated
  /// [StagedAudioMedia] of kind [StagedAudioKind.music].
  Future<void> _shareMusicFile() async {
    FilePickerResult? result;
    try {
      result = await FilePicker.platform.pickFiles(
        type: FileType.audio,
        withData: false,
      );
    } catch (_) {
      if (mounted) _toast('Could not open the audio picker.');
      return;
    }
    final picked = result?.files.singleOrNull;
    final path = picked?.path;
    if (picked == null || path == null || path.isEmpty || !mounted) return;

    // Duration isn't reported by the picker — decode it so the 4-minute cap is
    // enforced, and to render the track length in the bubble.
    final durationMs = await probeAudioDurationMs(path);
    if (!mounted) return;

    final mime = AudioMediaValidator.resolveMime(fileName: picked.name);
    final validation = AudioMediaValidator.validateMusicFile(
      mimeType: mime,
      fileName: picked.name,
      fileSizeBytes: picked.size,
      durationMs: durationMs,
    );
    if (!validation.isValid) {
      _toast(validation.error ?? 'That audio file cannot be shared.');
      return;
    }

    final title = _trackTitleFromName(picked.name);
    await _queueAudioAttachment(
      StagedAudioMedia(
        kind: StagedAudioKind.music,
        localPath: path,
        mimeType: mime ?? 'audio/mpeg',
        fileName: picked.name,
        fileSizeBytes: picked.size,
        durationMs: durationMs,
        title: title,
      ),
    );
  }

  static String _trackTitleFromName(String name) {
    final dot = name.lastIndexOf('.');
    final base = dot > 0 ? name.substring(0, dot) : name;
    return base.trim().isEmpty ? 'Audio track' : base.trim();
  }

  /// Records an in-chat audio note through the recorder seam and, on send,
  /// queues + uploads it as an `audio` attachment. When no recorder backend is
  /// wired the sheet itself explains why (see AudioRecorderFactory), so this
  /// simply no-ops when the sheet returns null.
  Future<void> _recordAudioNote() async {
    final staged = await showAudioNoteRecorderSheet(context);
    if (staged == null || !mounted) return;
    final validation = AudioMediaValidator.validateDuration(staged.durationMs);
    if (!validation.isValid) {
      _toast(validation.error ?? 'That audio note could not be sent.');
      return;
    }
    await _queueAudioAttachment(staged);
  }

  /// Queues a staged audio clip (music file or audio note) through the existing
  /// attachment pipeline, then enriches the just-created local row with the
  /// clip's duration/title so the bubble can render them.
  ///
  /// The duration/title bridge is needed because the repository's
  /// queueAttachment() (in core/) has no duration parameter yet — see the
  /// FLAGGED note in audio_message_support.dart. Everything here stays within the
  /// messages feature: it re-reads the local rows and upserts an enriched copy.
  Future<void> _queueAudioAttachment(StagedAudioMedia staged) async {
    final sizeBytes = await _safeFileSize(staged.localPath);

    await widget.messagesRepository.queueAttachment(
      conversationId: widget.conversationId,
      senderName: widget.profile.displayName,
      localPath: staged.localPath,
      mediaType: staged.messageType, // 'music' | 'audio'
      mimeType: staged.mimeType,
      fileName: staged.fileName,
      fileSizeBytes: sizeBytes,
    );

    // Bridge the duration/title the queue path cannot carry yet. Find the row we
    // just created (newest with this local path) and upsert an enriched copy.
    if (staged.durationMs != null || staged.title != null) {
      final messages = await widget.messagesRepository.loadMessages(
        widget.conversationId,
      );
      LocalMessage? target;
      for (final message in messages) {
        if (message.localMediaPath == staged.localPath) {
          if (target == null ||
              message.createdAtMillis > target.createdAtMillis) {
            target = message;
          }
        }
      }
      if (target != null) {
        await widget.messagesRepository.upsertMessage(
          target.copyWith(
            durationMs: staged.durationMs,
            musicTitle: staged.title,
          ),
        );
      }
    }

    if (!mounted) return;
    setState(() {
      _messagesFuture = widget.messagesRepository.loadMessages(
        widget.conversationId,
      );
    });
    await _syncMessages();
  }

  Future<int?> _safeFileSize(String path) async {
    try {
      final file = File(path);
      if (file.existsSync()) return await file.length();
    } catch (_) {
      // Best-effort; a missing size just omits the size chip.
    }
    return null;
  }

  Future<String> _persistPickedAttachment(XFile picked) async {
    final source = File(picked.path);
    if (!source.existsSync()) return picked.path;

    final directory = await getApplicationCacheDirectory();
    final mediaDirectory = Directory('${directory.path}/feedin_message_media');
    if (!mediaDirectory.existsSync()) {
      mediaDirectory.createSync(recursive: true);
    }

    final extension = picked.path.contains('.')
        ? picked.path.split('.').last
        : 'bin';
    final targetPath =
        '${mediaDirectory.path}/${DateTime.now().millisecondsSinceEpoch}_${const Uuid().v4()}.$extension';
    return source.copy(targetPath).then((file) => file.path);
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  /// Selects the in-bubble media body for a message. Music files get the
  /// track-style [MusicMessageBubble]; recorded audio notes get the waveform
  /// [VoiceNoteBubble]; everything else (image/video/file) uses the generic
  /// [MediaMessageContent]. Playback is routed through the player seam; with no
  /// player backend wired the controls are inert and explain why on tap.
  Widget? _mediaSlotFor(ChatMessageView view) {
    if (!view.hasMedia) return null;
    switch (view.mediaKind) {
      case ChatMediaKind.music:
        return MusicMessageBubble(
          message: view,
          onTogglePlay: () => _playAudio(view),
        );
      case ChatMediaKind.audio:
        return VoiceNoteBubble(
          message: view,
          onTogglePlay: () => _playAudio(view),
        );
      case ChatMediaKind.none:
      case ChatMediaKind.image:
      case ChatMediaKind.video:
      case ChatMediaKind.file:
      case ChatMediaKind.callLog:
        return MediaMessageContent(message: view);
    }
  }

  /// Playback entry point for an audio/music bubble. Uses the player seam; when
  /// no player backend is wired (current build) it surfaces a clear message
  /// instead of failing. Wiring AudioPlayerFactory.instance later makes this a
  /// real per-clip player with no UI change.
  Future<void> _playAudio(ChatMessageView view) async {
    if (!AudioPlayerFactory.isAvailable) {
      _toast(const AudioPlayerUnavailable().message);
      return;
    }
    // FLAGGED: with a player backend wired, create a controller here from the
    // clip's local path / remote URL, drive isPlaying/positionMs into the
    // bubble, and dispose on stop. The bubbles are already fully controlled.
    try {
      final controller = await AudioPlayerFactory.create(
        localPath: view.media?.localPath,
        remoteUrl: view.media?.remoteUrl,
      );
      await controller.playPause();
    } catch (e) {
      if (mounted) _toast('Could not play audio: $e');
    }
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
              onVoiceCall: () => _startCall(CallType.voice),
              onVideoCall: () => _startCall(CallType.video),
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
                          mediaSlot: _mediaSlotFor(view),
                          onLongPress: () => _openMessageActions(view),
                          onSwipeReply: () => _setReply(view),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            // In-thread typing/activity bubble, pinned just above the composer
            // (web renders `TypingIndicator` at the foot of the message list).
            // Renders nothing while the activity is `none`, so it is a no-op
            // until the live typing signal is populated on [_otherActivity].
            TypingIndicatorBubble(
              activity: _otherActivity,
              userName: _firstName(_title),
            ),
            ChatComposer(
              controller: _messageController,
              replyPreview: _replyTarget,
              onCancelReply: () => setState(() => _replyTarget = null),
              onSend: _sendMessage,
              onAttach: _openAttachmentOptions,
              onVoice: _recordAudioNote,
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(ChatSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            _GradientGlyph(icon: Icons.forum_rounded),
            SizedBox(height: ChatSpacing.lg),
            Text(
              'No conversations yet',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: ChatColors.foreground,
              ),
            ),
            SizedBox(height: ChatSpacing.sm),
            Text(
              'Tap the pencil to search for someone and start your first chat.',
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(ChatSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            _GradientGlyph(icon: Icons.waving_hand_rounded),
            SizedBox(height: ChatSpacing.lg),
            Text(
              'Say hello',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: ChatColors.foreground,
              ),
            ),
            SizedBox(height: ChatSpacing.sm),
            Text(
              'Send a message to start the conversation.',
              textAlign: TextAlign.center,
              style: ChatTextStyles.previewMuted,
            ),
          ],
        ),
      ),
    );
  }
}

/// Soft gradient-ringed glyph used by the messaging empty states. Mirrors the
/// web empty-state treatment: a pink-washed circle with a glowing primary icon.
class _GradientGlyph extends StatelessWidget {
  const _GradientGlyph({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 84,
      height: 84,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: ChatColors.primaryFaint,
        boxShadow: ChatShadows.glow,
      ),
      child: Container(
        width: 60,
        height: 60,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: ChatGradients.sendAction,
          boxShadow: ChatShadows.pink,
        ),
        child: Icon(icon, size: 28, color: ChatColors.primaryForeground),
      ),
    );
  }
}
