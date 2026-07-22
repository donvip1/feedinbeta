import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'package:file_picker/file_picker.dart';

import '../../core/connectivity/connectivity_service.dart';
import '../../core/connectivity/offline_notice.dart';
import '../../core/sync/conversation_starter.dart';
import '../../core/sync/incremental_message_sync_service.dart';
import '../../core/sync/sync_service.dart';
import '../../data/local/canonical_message_store.dart';
import '../../data/local/local_messages_repository_contract.dart';
import '../calls/call_controller.dart';
import '../calls/call_models.dart';
import '../calls/call_screen.dart';
import '../profile/user_profile.dart';
import 'chat/audio_backends_impl.dart';
import 'chat/message_interactions_data_source.dart';
import 'chat/audio_message_support.dart';
import 'chat/chat_mappers.dart';
import 'chat/chat_realtime_data_source.dart';
import 'chat/chat_theme.dart';
import 'chat/chat_view_models.dart';
import 'chat/generic_file_attachment.dart';
import 'chat/widgets/attachment_options_sheet.dart';
import 'chat/widgets/audio_note_recorder_sheet.dart';
import 'chat/widgets/chat_composer.dart';
import 'chat/widgets/chat_message_bubble.dart';
import 'chat/widgets/conversation_list_tile.dart';
import 'chat/widgets/emoji_sticker_sheet.dart';
import 'chat/widgets/media_message_content.dart';
import 'chat/widgets/message_photo_editor.dart';
import 'chat/widgets/message_action_sheet.dart';
import 'chat/widgets/music_message_bubble.dart';
import 'chat/widgets/new_conversation_sheet.dart';
import 'chat/widgets/report_message_sheet.dart';
import 'chat/widgets/typing_indicator_bubble.dart';
import 'chat/widgets/voice_note_bubble.dart';
import 'canonical_message.dart';
import 'message_models.dart';
import 'message_recipient.dart';

class MessagesScreenBackController {
  VoidCallback? _activeBackHandler;

  bool get canNavigateBack => _activeBackHandler != null;

  bool navigateBack() {
    final handler = _activeBackHandler;
    if (handler == null) return false;
    handler();
    return true;
  }

  void _setActiveBackHandler(VoidCallback? handler) {
    if (_activeBackHandler == handler) return;
    _activeBackHandler = handler;
  }
}

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({
    super.key,
    required this.messagesRepository,
    required this.conversationStarter,
    required this.syncService,
    required this.connectivityService,
    required this.profile,
    required this.realtimeVersion,
    this.initialConversationId,
    this.newConversationRequest = 0,
    this.callController,
    this.backController,
    this.incrementalMessageSyncService,
  });

  final LocalMessagesRepositoryContract messagesRepository;
  final ConversationStarter conversationStarter;
  final SyncServiceContract syncService;
  final ConnectivityService connectivityService;
  final UserProfile profile;
  final int realtimeVersion;
  final String? initialConversationId;
  final int newConversationRequest;

  /// Shared, long-lived call controller from the app shell. When provided, a
  /// conversation's header voice/video buttons place a real 1:1 call. Optional
  /// so tests and standalone use still work (buttons show a "coming soon" note).
  final CallController? callController;

  /// Allows the app shell's Android system-back policy to close an in-thread
  /// conversation before it falls back to tab/home navigation.
  final MessagesScreenBackController? backController;
  final IncrementalMessageSyncService? incrementalMessageSyncService;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen>
    with WidgetsBindingObserver {
  final _chatSearchController = TextEditingController();
  String? _selectedConversationId;
  String? _selectedConversationTitle;
  String _chatSearchQuery = '';
  late Future<List<ConversationSummary>> _conversationsFuture;
  late final ChatRealtimeDataSource _presenceDataSource;
  Timer? _presenceHeartbeat;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _presenceDataSource = ChatRealtimeDataSource.autoDetect();
    _selectedConversationId = widget.initialConversationId;
    _conversationsFuture = widget.messagesRepository.loadConversations();
    _syncBackController();
    _startPresenceHeartbeat();
  }

  @override
  void didUpdateWidget(covariant MessagesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.backController != widget.backController) {
      oldWidget.backController?._setActiveBackHandler(null);
      _syncBackController();
    }
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
      _syncBackController();
    }
    if (oldWidget.newConversationRequest != widget.newConversationRequest) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openNewConversation();
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _presenceHeartbeat?.cancel();
    unawaited(_stopPresence());
    widget.backController?._setActiveBackHandler(null);
    _chatSearchController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _startPresenceHeartbeat();
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        _presenceHeartbeat?.cancel();
        unawaited(_presenceDataSource.updatePresence('away'));
      case AppLifecycleState.detached:
        _presenceHeartbeat?.cancel();
        unawaited(_presenceDataSource.updatePresence('offline'));
    }
  }

  void _startPresenceHeartbeat() {
    _presenceHeartbeat?.cancel();
    unawaited(_presenceDataSource.updatePresence('online'));
    _presenceHeartbeat = Timer.periodic(const Duration(seconds: 45), (_) {
      unawaited(_presenceDataSource.updatePresence('online'));
    });
  }

  Future<void> _stopPresence() async {
    await _presenceDataSource.updatePresence('offline');
    await _presenceDataSource.dispose();
  }

  void _syncBackController() {
    widget.backController?._setActiveBackHandler(
      _selectedConversationId == null ? null : _closeConversation,
    );
  }

  void _openConversation(ConversationSummary summary) {
    setState(() {
      _selectedConversationId = summary.id;
      _selectedConversationTitle = summary.title;
    });
    _syncBackController();
  }

  void _closeConversation() {
    setState(() {
      _selectedConversationId = null;
      _selectedConversationTitle = null;
      _conversationsFuture = widget.messagesRepository.loadConversations();
    });
    _syncBackController();
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
            _syncBackController();
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
        connectivityService: widget.connectivityService,
        profile: widget.profile,
        realtimeVersion: widget.realtimeVersion,
        onBack: _closeConversation,
        callController: widget.callController,
        incrementalMessageSyncService: widget.incrementalMessageSyncService,
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

            final query = _chatSearchQuery.trim().toLowerCase();
            final visibleConversations = query.isEmpty
                ? conversations
                : conversations
                      .where(
                        (conversation) =>
                            conversation.title.toLowerCase().contains(query) ||
                            conversation.lastMessagePreview
                                .toLowerCase()
                                .contains(query),
                      )
                      .toList(growable: false);

            return Column(
              children: [
                _InboxHeader(
                  profile: widget.profile,
                  searchController: _chatSearchController,
                  onSearchChanged: (value) {
                    setState(() => _chatSearchQuery = value);
                  },
                  onNewChat: _openNewConversation,
                ),
                Expanded(
                  child: conversations.isEmpty
                      ? const _EmptyChatsState()
                      : visibleConversations.isEmpty
                      ? _NoChatSearchResults(query: _chatSearchQuery)
                      : ListView.builder(
                          // Cards carry their own horizontal margin + inter-card
                          // gap; the list only adds a small top/bottom breathing
                          // room so the first/last card isn't flush to an edge.
                          padding: const EdgeInsets.only(
                            top: ChatSpacing.xs,
                            bottom: ChatSpacing.lg,
                          ),
                          itemCount: visibleConversations.length,
                          itemBuilder: (context, index) {
                            final summary = visibleConversations[index];
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
  const _InboxHeader({
    required this.profile,
    required this.searchController,
    required this.onSearchChanged,
    required this.onNewChat,
  });

  final UserProfile profile;
  final TextEditingController searchController;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback onNewChat;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: ChatColors.card,
        border: Border(bottom: BorderSide(color: ChatColors.border)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          ChatSpacing.lg,
          ChatSpacing.md,
          ChatSpacing.lg,
          ChatSpacing.md,
        ),
        child: Column(
          children: [
            Row(
              children: [
                _ProfileAvatar(
                  displayName: profile.displayName,
                  avatarUrl: profile.avatarUrl,
                  size: 44,
                  showOnline: true,
                ),
                const SizedBox(width: ChatSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.displayName.trim().isEmpty
                            ? 'Messages'
                            : profile.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: ChatTextStyles.headerName,
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Online',
                        style: TextStyle(
                          color: ChatColors.online,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                _HeaderAction(
                  tooltip: 'New chat',
                  icon: Icons.edit_square,
                  onPressed: onNewChat,
                  emphasized: true,
                ),
              ],
            ),
            const SizedBox(height: ChatSpacing.md),
            TextField(
              controller: searchController,
              onChanged: onSearchChanged,
              textInputAction: TextInputAction.search,
              cursorColor: ChatColors.primary,
              style: const TextStyle(
                color: ChatColors.foreground,
                fontSize: 14,
              ),
              decoration: InputDecoration(
                isDense: true,
                filled: true,
                fillColor: ChatColors.input,
                hintText: 'Search chats',
                hintStyle: ChatTextStyles.previewMuted,
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: ChatColors.mutedForeground,
                  size: 20,
                ),
                suffixIcon: searchController.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear search',
                        onPressed: () {
                          searchController.clear();
                          onSearchChanged('');
                        },
                        icon: const Icon(
                          Icons.close_rounded,
                          color: ChatColors.mutedForeground,
                          size: 18,
                        ),
                      ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(ChatRadii.md),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(ChatRadii.md),
                  borderSide: const BorderSide(color: ChatColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(ChatRadii.md),
                  borderSide: const BorderSide(
                    color: ChatColors.primary,
                    width: 1.4,
                  ),
                ),
              ),
            ),
          ],
        ),
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
    required this.connectivityService,
    required this.profile,
    required this.realtimeVersion,
    required this.onBack,
    this.initialTitle,
    this.callController,
    this.incrementalMessageSyncService,
  });

  final String conversationId;
  final String? initialTitle;
  final LocalMessagesRepositoryContract messagesRepository;
  final SyncServiceContract syncService;
  final ConnectivityService connectivityService;
  final UserProfile profile;
  final int realtimeVersion;
  final VoidCallback onBack;

  /// Shared call controller from the shell. When set (and the other user's id
  /// resolves), the header voice/video buttons place a real 1:1 call.
  final CallController? callController;
  final IncrementalMessageSyncService? incrementalMessageSyncService;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  final _messageController = TextEditingController();
  final _threadSearchController = TextEditingController();
  final _picker = ImagePicker();
  final _interactions = MessageInteractionsDataSource.autoDetect();
  final _genericFilePicker = GenericFileAttachmentPicker();
  late final ChatRealtimeDataSource _chatRealtime;
  late final StreamSubscription<ChatRealtimeEvent> _chatRealtimeSubscription;
  StreamSubscription<CanonicalMessageStoreChange>?
  _canonicalMessageSubscription;
  late Future<List<LocalMessage>> _messagesFuture;
  String? _canonicalConversationId;
  String? _title;
  ReplyPreview? _replyTarget;
  PresenceState _otherPresence = PresenceState.offline;
  String? _otherPresenceWire;
  ChatActivity _otherActivity = ChatActivity.none;
  int? _otherLastSeenMillis;
  Timer? _otherActivityTimer;
  Timer? _receiptRefreshTimer;
  Timer? _presenceAgeTimer;
  Set<String> _starredMessageIds = <String>{};
  final Set<String> _downloadingMediaIds = <String>{};
  bool _isThreadSearchOpen = false;
  String _threadSearchQuery = '';

  /// Per-conversation disappearing-message timer in seconds (0 = off). Loaded
  /// from the conversation summary and used to stamp outgoing messages' expiry.
  int _disappearingSeconds = 0;

  /// Absolute expiry (epoch millis) for a message sent now under the active
  /// disappearing timer, or null when the timer is off.
  int? _disappearingExpiryMillis() {
    if (_disappearingSeconds <= 0) return null;
    return DateTime.now().millisecondsSinceEpoch + _disappearingSeconds * 1000;
  }

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

  List<ComposerMention> get _mentionSuggestions {
    final suggestions = <ComposerMention>[];
    final otherName = _title?.trim();
    if (otherName != null && otherName.isNotEmpty) {
      suggestions.add(
        ComposerMention(
          displayName: otherName,
          handle: _mentionHandle(otherName),
        ),
      );
    }
    final selfName = widget.profile.displayName.trim();
    if (selfName.isNotEmpty) {
      final profileHandle = widget.profile.handle.trim().replaceFirst(
        RegExp(r'^@'),
        '',
      );
      suggestions.add(
        ComposerMention(
          displayName: selfName,
          handle: profileHandle.isEmpty
              ? _mentionHandle(selfName)
              : profileHandle,
        ),
      );
    }
    return suggestions;
  }

  static String _mentionHandle(String displayName) {
    final normalized = displayName
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9_]+'), '_')
        .replaceAll(RegExp(r'^_+|_+$'), '');
    return normalized.isEmpty ? 'member' : normalized;
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
    _chatRealtime = ChatRealtimeDataSource.autoDetect();
    _chatRealtimeSubscription = _chatRealtime.events.listen(
      _handleChatRealtimeEvent,
    );
    _title = widget.initialTitle;
    _canonicalMessageSubscription = widget
        .incrementalMessageSyncService
        ?.changes
        .listen(_handleCanonicalMessageChange);
    _messagesFuture = _loadMessages();
    _resolveTitle();
    _markReadLocally();
    _presenceAgeTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      _refreshPresenceAge();
    });
  }

  Future<void> _resolveTitle() async {
    final conversationId = widget.conversationId;
    final conversation = await widget.messagesRepository.loadConversation(
      conversationId,
    );
    if (!mounted ||
        widget.conversationId != conversationId ||
        conversation == null) {
      return;
    }
    final serverConversationId = conversation.serverConversationId;
    setState(() {
      _canonicalConversationId = serverConversationId?.isNotEmpty == true
          ? serverConversationId
          : null;
      _title = (_title != null && _title!.isNotEmpty)
          ? _title
          : conversation.title;
      _otherPresenceWire = conversation.otherUserPresence;
      _otherPresence = conversationPresence(conversation);
      _otherLastSeenMillis = conversationLastSeenMillis(conversation);
      _otherUserId = conversation.otherUserId;
      _otherUserAvatarUrl = conversation.otherUserAvatarUrl;
      _disappearingSeconds = conversation.disappearingSeconds;
    });
    if (serverConversationId != null && serverConversationId.isNotEmpty) {
      await _chatRealtime.connect(
        conversationId: serverConversationId,
        currentUserId: widget.profile.userId,
        otherUserId: conversation.otherUserId,
      );
      await _loadStarredMessageIds(
        serverConversationId: serverConversationId,
        localConversationId: conversationId,
      );
    } else {
      await _chatRealtime.disconnect();
      if (mounted && widget.conversationId == conversationId) {
        setState(() => _starredMessageIds = <String>{});
      }
    }
  }

  void _handleCanonicalMessageChange(CanonicalMessageStoreChange change) {
    if (!mounted) return;
    final canonicalId = _canonicalConversationId;
    if (canonicalId == null || change.conversationId != canonicalId) return;
    setState(() => _messagesFuture = _loadMessages(syncRemote: false));
  }

  Future<String?> _resolveCanonicalConversationId() async {
    final current = _canonicalConversationId;
    if (current != null && current.isNotEmpty) return current;
    final localConversationId = widget.conversationId;
    final conversation = await widget.messagesRepository.loadConversation(
      localConversationId,
    );
    if (!mounted || widget.conversationId != localConversationId) return null;
    final resolved = conversation?.serverConversationId;
    if (resolved == null || resolved.isEmpty) return null;
    _canonicalConversationId = resolved;
    return resolved;
  }

  Future<List<LocalMessage>> _loadMessages({bool syncRemote = true}) async {
    final legacy = await widget.messagesRepository.loadMessages(
      widget.conversationId,
    );
    final service = widget.incrementalMessageSyncService;
    final canonicalId = await _resolveCanonicalConversationId();
    if (service == null || canonicalId == null) return legacy;

    List<LocalCanonicalMessage> canonical;
    try {
      canonical = syncRemote
          ? await service.syncConversationPage(canonicalId)
          : await service.loadConversation(canonicalId);
    } catch (_) {
      canonical = await service.loadConversation(canonicalId);
    }

    final merged = <String, LocalMessage>{
      for (final message in legacy) message.id: message,
    };
    for (final record in canonical) {
      // Legacy media rows currently contain signed/downloadable URLs; V2
      // envelopes intentionally expose private storage paths. Keep media on
      // the legacy read side until the canonical URL resolver lands.
      if (record.message.contentType != CanonicalMessageContentType.text &&
          record.message.contentType != CanonicalMessageContentType.sticker) {
        continue;
      }
      merged[record.message.id] = canonicalMessageToLocalMessage(
        record,
        currentUserId: widget.profile.userId,
        currentUserName: widget.profile.displayName,
        otherSenderName: _title ?? 'Participant',
      );
    }
    final result = merged.values.toList()
      ..sort((a, b) => a.createdAtMillis.compareTo(b.createdAtMillis));
    return result;
  }

  Future<void> _loadStarredMessageIds({
    required String serverConversationId,
    required String localConversationId,
  }) async {
    final ids = await _interactions.fetchStarredMessageIds(
      serverConversationId,
    );
    if (!mounted ||
        widget.conversationId != localConversationId ||
        ids == null) {
      return;
    }
    setState(() => _starredMessageIds = ids);
  }

  void _handleChatRealtimeEvent(ChatRealtimeEvent event) {
    if (!mounted) return;
    switch (event.type) {
      case ChatRealtimeEventType.typing:
        if (_otherUserId != null && event.userId != _otherUserId) return;
        final activity = chatActivityFromWire(
          event.activity,
          updatedAtMillis: event.occurredAtMillis,
        );
        _setOtherActivity(activity, updatedAtMillis: event.occurredAtMillis);
      case ChatRealtimeEventType.presence:
        if (_otherUserId != null && event.userId != _otherUserId) return;
        setState(() {
          _otherPresenceWire = event.presence;
          _otherLastSeenMillis = event.occurredAtMillis ?? _otherLastSeenMillis;
          _otherPresence = presenceStateFromWire(
            event.presence,
            lastSeenMillis: _otherLastSeenMillis,
          );
        });
      case ChatRealtimeEventType.readReceipt:
        if (_otherUserId != null && event.userId != _otherUserId) return;
        _receiptRefreshTimer?.cancel();
        _receiptRefreshTimer = Timer(
          const Duration(milliseconds: 250),
          _refreshReadReceipts,
        );
    }
  }

  void _setOtherActivity(ChatActivity activity, {int? updatedAtMillis}) {
    _otherActivityTimer?.cancel();
    setState(() => _otherActivity = activity);
    if (activity == ChatActivity.none) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final elapsed = updatedAtMillis == null ? 0 : now - updatedAtMillis;
    final remainingMillis = (6000 - elapsed).clamp(1, 6000);
    _otherActivityTimer = Timer(Duration(milliseconds: remainingMillis), () {
      if (mounted) setState(() => _otherActivity = ChatActivity.none);
    });
  }

  void _refreshPresenceAge() {
    if (!mounted) return;
    final next = presenceStateFromWire(
      _otherPresenceWire,
      lastSeenMillis: _otherLastSeenMillis,
    );
    if (next != _otherPresence) {
      setState(() => _otherPresence = next);
    }
  }

  Future<void> _refreshReadReceipts() async {
    final conversationId = widget.conversationId;
    await widget.syncService.syncNow();
    await widget.incrementalMessageSyncService?.reconcile();
    await widget.incrementalMessageSyncService?.drainOutbox();
    if (!mounted || widget.conversationId != conversationId) return;
    setState(() {
      _messagesFuture = _loadMessages();
    });
  }

  void _onTypingChanged(bool active) {
    unawaited(_chatRealtime.setTyping(active));
  }

  Future<void> _markReadLocally() async {
    final conversationId = widget.conversationId;
    await widget.messagesRepository.markConversationRead(conversationId);
    await _markReadRemotely(conversationId);
    if (!mounted || widget.conversationId != conversationId) return;
    setState(() {
      _messagesFuture = _loadMessages(syncRemote: false);
    });
  }

  Future<void> _markReadRemotely(String conversationId) async {
    final conversation = await widget.messagesRepository.loadConversation(
      conversationId,
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
      if (oldWidget.conversationId != widget.conversationId) {
        unawaited(_chatRealtime.setTyping(false));
        unawaited(_chatRealtime.disconnect());
        _otherActivityTimer?.cancel();
        _otherActivity = ChatActivity.none;
        _otherPresence = PresenceState.offline;
        _otherPresenceWire = null;
        _otherLastSeenMillis = null;
        _otherUserId = null;
        _otherUserAvatarUrl = null;
        _disappearingSeconds = 0;
        _starredMessageIds = <String>{};
        _canonicalConversationId = null;
        _title = widget.initialTitle;
        _replyTarget = null;
        _threadSearchController.clear();
        _threadSearchQuery = '';
        _isThreadSearchOpen = false;
        _messageController.clear();
      }
      setState(() {
        _messagesFuture = _loadMessages();
      });
      _resolveTitle();
      _markReadLocally();
    }
  }

  @override
  void dispose() {
    _otherActivityTimer?.cancel();
    _receiptRefreshTimer?.cancel();
    _presenceAgeTimer?.cancel();
    unawaited(_canonicalMessageSubscription?.cancel());
    unawaited(_disposeRealtime());
    _threadSearchController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  void _toggleThreadSearch() {
    setState(() {
      _isThreadSearchOpen = !_isThreadSearchOpen;
      if (!_isThreadSearchOpen) {
        _threadSearchController.clear();
        _threadSearchQuery = '';
      }
    });
  }

  void _openConversationOptions() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ChatColors.card,
      barrierColor: ChatColors.barrier,
      shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            ChatSpacing.md,
            ChatSpacing.sm,
            ChatSpacing.md,
            ChatSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: ChatSpacing.md),
                decoration: BoxDecoration(
                  color: ChatColors.border,
                  borderRadius: ChatRadii.chip,
                ),
              ),
              ListTile(
                leading: const Icon(
                  Icons.search_rounded,
                  color: ChatColors.primary,
                ),
                title: const Text(
                  'Search this conversation',
                  style: TextStyle(color: ChatColors.foreground),
                ),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  if (!_isThreadSearchOpen) _toggleThreadSearch();
                },
              ),
              ListTile(
                leading: Icon(
                  _disappearingSeconds > 0
                      ? Icons.timer_rounded
                      : Icons.timer_outlined,
                  color: ChatColors.primary,
                ),
                title: const Text(
                  'Disappearing messages',
                  style: TextStyle(color: ChatColors.foreground),
                ),
                subtitle: Text(
                  _disappearingSeconds > 0
                      ? _timerLabel(_disappearingSeconds)
                      : 'Off',
                  style: ChatTextStyles.subtitle,
                ),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _openDisappearingChooser();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _disposeRealtime() async {
    await _chatRealtime.setTyping(false);
    await _chatRealtimeSubscription.cancel();
    await _chatRealtime.dispose();
  }

  Future<void> _sendMessage() async {
    final body = _messageController.text.trim();
    if (body.isEmpty) return;

    final localConversationId = widget.conversationId;
    final canonicalService = widget.incrementalMessageSyncService;
    final canonicalConversationId = await _resolveCanonicalConversationId();
    if (!mounted || widget.conversationId != localConversationId) return;
    if (canonicalService != null &&
        canonicalConversationId != null &&
        _disappearingSeconds <= 0) {
      final now = DateTime.now().toUtc();
      final expiresAtMillis = _disappearingExpiryMillis();
      final expiresAt = expiresAtMillis == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(
              expiresAtMillis,
              isUtc: true,
            ).toIso8601String();
      final message = CanonicalMessage(
        id: const Uuid().v4(),
        conversationId: canonicalConversationId,
        senderId: widget.profile.userId,
        contentType: CanonicalMessageContentType.text,
        payload: {'text': body},
        replyToId: _replyTarget?.messageId,
        status: CanonicalMessageStatus.sending,
        metadata: {
          'schema_version': 1,
          'revision': 1,
          'reactions': <Object?>[],
          'pin': <String, Object?>{
            'is_pinned': false,
            'pinned_by': null,
            'pinned_at': null,
          },
          'is_starred_by_me': false,
          'forwarded': <String, Object?>{
            'original_message_id': null,
            'original_sender_id': null,
            'original_sender_name': null,
            'original_created_at': null,
          },
          'receipts': <String, Object?>{
            'delivered_count': 0,
            'read_count': 0,
            'read_by_me_at': null,
          },
          'ephemeral': <String, Object?>{
            'view_once': false,
            'viewed_at': null,
            'expires_at': expiresAt,
          },
          'edited_at': null,
          'deleted_at': null,
        },
        createdAt: now,
        updatedAt: now,
      );
      await canonicalService.enqueue(message);
      final conversation = await widget.messagesRepository.loadConversation(
        localConversationId,
      );
      if (conversation != null) {
        await widget.messagesRepository.upsertConversation(
          conversation.copyWith(
            lastMessagePreview: body,
            updatedAtMillis: now.millisecondsSinceEpoch,
          ),
        );
      }
      if (!mounted || widget.conversationId != localConversationId) return;
      _messageController.clear();
      setState(() {
        _replyTarget = null;
        _messagesFuture = _loadMessages(syncRemote: false);
      });
      return;
    }

    // Local-only conversations do not have a server identity that the V2
    // outbox can authorize yet. Preserve the draft until connectivity lets the
    // conversation starter create that identity.
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
    await widget.messagesRepository.queueMessage(
      conversationId: widget.conversationId,
      senderName: widget.profile.displayName,
      senderId: widget.profile.userId.isEmpty ? null : widget.profile.userId,
      senderAvatarUrl: widget.profile.avatarUrl,
      replyToId: _replyTarget?.messageId,
      body: _messageController.text,
      expiresAtMillis: _disappearingExpiryMillis(),
    );
    _messageController.clear();
    if (!mounted) return;
    setState(() {
      _replyTarget = null;
      _messagesFuture = _loadMessages(syncRemote: false);
    });
    await _syncMessages();
  }

  Future<void> _syncMessages() async {
    final conversationId = widget.conversationId;
    await widget.syncService.syncNow();
    await widget.incrementalMessageSyncService?.drainOutbox();
    if (!mounted || widget.conversationId != conversationId) return;
    await _resolveTitle();
    if (!mounted || widget.conversationId != conversationId) return;
    setState(() {
      _messagesFuture = _loadMessages();
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
      builder: (_) {
        return MessageActionSheet(
          message: message,
          onReact: (emoji) => _reactToMessage(message, emoji),
          onReply: () => _setReply(message),
          onForward: () => _forwardMessage(message),
          onStar: () => _toggleStar(message),
          onCopy: message.hasText
              ? () {
                  Clipboard.setData(ClipboardData(text: message.body));
                  _toast('Copied to clipboard');
                }
              : null,
          onDelete: message.isMine ? () => _deleteMessage(message) : null,
          onReport: !message.isMine ? () => _reportMessage(message) : null,
        );
      },
    );
  }

  void _pendingBackend(String feature) {
    _toast('$feature needs the final backend contract.');
  }

  Future<void> _toggleStar(ChatMessageView message) async {
    if (message.deliveryState == DeliveryState.pending ||
        message.deliveryState == DeliveryState.failed) {
      _toast('You can star this message once it has sent.');
      return;
    }
    final starred = await _interactions.toggleStar(message.id);
    if (!mounted) return;
    if (starred == null) {
      _toast('Could not update the star.');
      return;
    }
    setState(() {
      if (starred) {
        _starredMessageIds.add(message.id);
      } else {
        _starredMessageIds.remove(message.id);
      }
    });
    _toast(starred ? 'Message starred.' : 'Message unstarred.');
  }

  Future<void> _reportMessage(ChatMessageView message) async {
    final draft = await showReportMessageSheet(context);
    if (draft == null || !mounted) return;

    final reported = await _interactions.reportMessage(
      messageId: message.id,
      reason: draft.reasonValue,
      description: draft.description,
    );
    if (!mounted) return;
    _toast(reported ? 'Report submitted.' : 'Could not submit the report.');
  }

  /// Toggle an emoji [reaction] on [message] via the server RPC. Only synced
  /// messages (with a server id) can be reacted to; a still-queued local message
  /// has no server row yet.
  Future<void> _reactToMessage(ChatMessageView message, String emoji) async {
    if (message.deliveryState == DeliveryState.pending ||
        message.deliveryState == DeliveryState.failed) {
      _toast('You can react once the message has sent.');
      return;
    }
    final result = await _interactions.toggleReaction(message.id, emoji);
    if (!mounted) return;
    if (result == null) {
      _toast('Could not add your reaction. Please try again.');
      return;
    }
    // Pull the thread so the (realtime-materialised) reaction shows.
    setState(() {
      _messagesFuture = _loadMessages();
    });
    _toast(result ? 'Reacted $emoji' : 'Reaction removed');
  }

  /// Soft-delete an own [message] via the server RPC, then refresh the thread.
  Future<void> _deleteMessage(ChatMessageView message) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ChatColors.card,
        title: const Text('Delete message?'),
        content: const Text('This message will be removed for everyone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final ok = await _interactions.deleteMessage(message.id);
    if (!mounted) return;
    if (!ok) {
      _toast('Could not delete the message.');
      return;
    }
    setState(() {
      _messagesFuture = _loadMessages();
    });
    _toast('Message deleted.');
  }

  /// Forward [message]'s text into another conversation the user picks. Purely
  /// client-side: it queues the content into the target thread through the
  /// existing outbound message pipeline.
  Future<void> _forwardMessage(ChatMessageView message) async {
    final text = message.hasText ? message.body : null;
    if (text == null || text.trim().isEmpty) {
      _toast('Only text messages can be forwarded for now.');
      return;
    }
    final conversations = await widget.messagesRepository.loadConversations();
    if (!mounted) return;
    final targets = conversations
        .where((c) => c.id != widget.conversationId)
        .toList();
    if (targets.isEmpty) {
      _toast('No other conversations to forward to.');
      return;
    }
    final target = await showModalBottomSheet<ConversationSummary>(
      context: context,
      backgroundColor: ChatColors.card,
      barrierColor: ChatColors.barrier,
      shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
      builder: (sheetContext) => _ForwardTargetSheet(conversations: targets),
    );
    if (target == null || !mounted) return;
    await widget.messagesRepository.queueMessage(
      conversationId: target.id,
      senderName: widget.profile.displayName,
      body: text,
      senderId: widget.profile.userId.isEmpty ? null : widget.profile.userId,
    );
    if (!mounted) return;
    _toast('Forwarded to ${target.title}.');
  }

  /// Place a 1:1 [type] call to the other participant from the chat header.
  ///
  /// Requires the shared [CallController] (from the shell) and a resolved
  /// [_otherUserId]. Uses [CallScreen.start], which inserts the call log and
  /// pushes the immersive call screen; a null return means the call could not
  /// be placed (unconfigured / signed out / already in a call).
  Future<void> _startCall(CallType type) async {
    // A call is inherently an online action — block it outright when offline.
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
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

  void _openEmojiStickerSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: ChatColors.barrier,
      builder: (sheetContext) => EmojiStickerSheet(
        onEmojiSelected: _insertEmoji,
        onStickerSelected: (sticker) {
          Navigator.of(sheetContext).pop();
          unawaited(_sendSticker(sticker));
        },
      ),
    );
  }

  void _insertEmoji(String emoji) {
    final value = _messageController.value;
    final selection = value.selection.isValid
        ? value.selection
        : TextSelection.collapsed(offset: value.text.length);
    final start = selection.start.clamp(0, value.text.length);
    final end = selection.end.clamp(0, value.text.length);
    final next = value.text.replaceRange(start, end, emoji);
    _messageController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: start + emoji.length),
    );
  }

  Future<void> _sendSticker(ChatSticker sticker) async {
    final localConversationId = widget.conversationId;
    final canonicalService = widget.incrementalMessageSyncService;
    final canonicalConversationId = await _resolveCanonicalConversationId();
    if (!mounted || widget.conversationId != localConversationId) return;

    if (canonicalService != null &&
        canonicalConversationId != null &&
        _disappearingSeconds <= 0) {
      final now = DateTime.now().toUtc();
      final message = CanonicalMessage(
        id: const Uuid().v4(),
        conversationId: canonicalConversationId,
        senderId: widget.profile.userId,
        contentType: CanonicalMessageContentType.sticker,
        payload: {
          'asset_key': sticker.id,
          'emoji': sticker.emoji,
          'name': sticker.name,
        },
        replyToId: _replyTarget?.messageId,
        status: CanonicalMessageStatus.sending,
        metadata: {
          'schema_version': 1,
          'revision': 1,
          'reactions': <Object?>[],
          'pin': <String, Object?>{
            'is_pinned': false,
            'pinned_by': null,
            'pinned_at': null,
          },
          'is_starred_by_me': false,
          'forwarded': <String, Object?>{
            'original_message_id': null,
            'original_sender_id': null,
            'original_sender_name': null,
            'original_created_at': null,
          },
          'receipts': <String, Object?>{
            'delivered_count': 0,
            'read_count': 0,
            'read_by_me_at': null,
          },
          'ephemeral': <String, Object?>{
            'view_once': false,
            'viewed_at': null,
            'expires_at': null,
          },
          'edited_at': null,
          'deleted_at': null,
        },
        createdAt: now,
        updatedAt: now,
      );
      await canonicalService.enqueue(message);
      final conversation = await widget.messagesRepository.loadConversation(
        localConversationId,
      );
      if (conversation != null) {
        await widget.messagesRepository.upsertConversation(
          conversation.copyWith(
            lastMessagePreview: '${sticker.emoji} ${sticker.name}',
            updatedAtMillis: now.millisecondsSinceEpoch,
          ),
        );
      }
      if (!mounted || widget.conversationId != localConversationId) return;
      setState(() {
        _replyTarget = null;
        _messagesFuture = _loadMessages(syncRemote: false);
      });
      return;
    }

    // Legacy/disappearing paths still carry the visual sticker as emoji-only
    // text so it survives the existing sync contract and renders at sticker
    // scale in the bubble.
    _messageController.text = sticker.emoji;
    await _sendMessage();
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
                await _pickGenericFileAttachment();
              case AttachmentOption.music:
                await _shareMusicFile();
              case AttachmentOption.voiceNote:
                await _recordAudioNote();
              case AttachmentOption.viewOncePhoto:
                await _pickAttachment(
                  source: ImageSource.gallery,
                  mediaType: 'image',
                  viewOnce: true,
                );
            }
          },
        );
      },
    );
  }

  Future<void> _pickAttachment({
    required ImageSource source,
    required String mediaType,
    bool viewOnce = false,
  }) async {
    // Uploading media is an online action; block before opening the picker.
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
    final XFile? picked = mediaType == 'video'
        ? await _picker.pickVideo(source: source)
        : await _picker.pickImage(source: source);
    if (picked == null || !mounted) return;

    MessagePhotoEditResult? photoEdit;
    XFile staged = picked;
    if (mediaType == 'image') {
      photoEdit = await MessagePhotoEditor.edit(
        context,
        imageFile: File(picked.path),
      );
      if (photoEdit == null || !mounted) return;
      staged = XFile(
        photoEdit.file.path,
        mimeType: 'image/jpeg',
        name: photoEdit.file.uri.pathSegments.last,
      );
    }

    final localPath = await _persistPickedAttachment(staged);
    await widget.messagesRepository.queueAttachment(
      conversationId: widget.conversationId,
      senderName: widget.profile.displayName,
      senderId: widget.profile.userId.isEmpty ? null : widget.profile.userId,
      senderAvatarUrl: widget.profile.avatarUrl,
      localPath: localPath,
      mediaType: mediaType,
      mimeType: staged.mimeType,
      fileName: staged.name,
      fileSizeBytes: await File(localPath).length(),
      caption: photoEdit?.caption,
      viewOnce: viewOnce,
      expiresAtMillis: _disappearingExpiryMillis(),
    );
    if (!mounted) return;
    setState(() {
      _messagesFuture = _loadMessages(syncRemote: false);
    });
    await _syncMessages();
  }

  Future<void> _pickGenericFileAttachment() async {
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }

    final result = await _genericFilePicker.pickAndStage();
    if (!mounted || result.isCancelled) return;
    if (result.isFailure) {
      _toast(result.error!);
      return;
    }

    final file = result.attachment!;
    await widget.messagesRepository.queueAttachment(
      conversationId: widget.conversationId,
      senderName: widget.profile.displayName,
      senderId: widget.profile.userId.isEmpty ? null : widget.profile.userId,
      senderAvatarUrl: widget.profile.avatarUrl,
      localPath: file.localPath,
      mediaType: StagedGenericFileAttachment.mediaType,
      mimeType: file.mimeType,
      fileName: file.fileName,
      fileSizeBytes: file.fileSizeBytes,
      expiresAtMillis: _disappearingExpiryMillis(),
    );
    if (!mounted) return;
    setState(() {
      _messagesFuture = _loadMessages(syncRemote: false);
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
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
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
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
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
      senderId: widget.profile.userId.isEmpty ? null : widget.profile.userId,
      senderAvatarUrl: widget.profile.avatarUrl,
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
      _messagesFuture = _loadMessages(syncRemote: false);
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
        return MediaMessageContent(
          message: view,
          onOpenViewer: () => _openMediaViewer(view),
          onDownload: () => _downloadMedia(view),
          onRetryDownload: () => _downloadMedia(view),
          onOpenViewOnce: view.viewOnce && !view.isMine && !view.viewOnceSeen
              ? () => _openViewOnce(view)
              : null,
        );
    }
  }

  Future<void> _downloadMedia(ChatMessageView view) async {
    if (_downloadingMediaIds.contains(view.id)) return;
    final remoteUrl = view.media?.remoteUrl;
    if (remoteUrl == null || remoteUrl.isEmpty) {
      _toast('This attachment is not available for download yet.');
      return;
    }
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }

    _downloadingMediaIds.add(view.id);
    _toast('Downloading attachment…');
    try {
      final uri = Uri.parse(remoteUrl);
      final client = HttpClient();
      try {
        final request = await client.getUrl(uri);
        final response = await request.close();
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw HttpException(
            'Download failed with status ${response.statusCode}',
            uri: uri,
          );
        }
        final directory = await getApplicationCacheDirectory();
        final mediaDirectory = Directory(
          '${directory.path}/feedin_message_downloads',
        );
        if (!mediaDirectory.existsSync()) {
          mediaDirectory.createSync(recursive: true);
        }
        final extension = _downloadExtension(view, uri);
        final file = File('${mediaDirectory.path}/${view.id}.$extension');
        await response.pipe(file.openWrite());

        final messages = await widget.messagesRepository.loadMessages(
          widget.conversationId,
        );
        LocalMessage? local;
        for (final candidate in messages) {
          if (candidate.id == view.id) {
            local = candidate;
            break;
          }
        }
        if (local == null) {
          throw StateError('Downloaded message is no longer available.');
        }
        await widget.messagesRepository.upsertMessage(
          local.copyWith(localMediaPath: file.path),
        );
      } finally {
        client.close(force: true);
      }
      if (!mounted) return;
      setState(() => _messagesFuture = _loadMessages(syncRemote: false));
      _toast('Attachment downloaded.');
    } catch (_) {
      if (mounted) _toast('Could not download this attachment. Try again.');
    } finally {
      _downloadingMediaIds.remove(view.id);
    }
  }

  String _downloadExtension(ChatMessageView view, Uri uri) {
    final fileName = view.media?.fileName;
    final candidate = fileName?.contains('.') == true
        ? fileName!.split('.').last
        : (uri.pathSegments.isNotEmpty && uri.pathSegments.last.contains('.')
              ? uri.pathSegments.last.split('.').last
              : null);
    if (candidate != null &&
        RegExp(r'^[a-zA-Z0-9]{1,6}$').hasMatch(candidate)) {
      return candidate.toLowerCase();
    }
    return switch (view.mediaKind) {
      ChatMediaKind.image => 'jpg',
      ChatMediaKind.video => 'mp4',
      ChatMediaKind.audio => 'm4a',
      _ => 'bin',
    };
  }

  Future<void> _openMediaViewer(ChatMessageView view) async {
    final media = view.media;
    if (media == null) return;
    if (view.mediaKind != ChatMediaKind.image) {
      _toast('Tap download to save this attachment.');
      return;
    }
    final localPath = media.localPath;
    final remoteUrl = media.remoteUrl;
    if ((localPath == null || localPath.isEmpty) &&
        (remoteUrl == null || remoteUrl.isEmpty)) {
      _toast('This photo is not available yet.');
      return;
    }
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black,
      builder: (dialogContext) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: Stack(
          children: [
            Positioned.fill(
              child: InteractiveViewer(
                minScale: 0.8,
                maxScale: 5,
                child: Center(
                  child: localPath != null && localPath.isNotEmpty
                      ? Image.file(File(localPath), fit: BoxFit.contain)
                      : Image.network(remoteUrl!, fit: BoxFit.contain),
                ),
              ),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: SafeArea(
                child: IconButton.filledTonal(
                  tooltip: 'Close photo',
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Reveal an incoming view-once photo, then burn it: tell the server via
  /// `mark_view_once_seen` (which blanks the payload) and refresh so the tile
  /// becomes an "Opened" tombstone. Requires connectivity.
  Future<void> _openViewOnce(ChatMessageView view) async {
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
    // Reveal the image once in a full-screen viewer.
    await _showViewOnceImage(view);
    final ok = await _interactions.markViewOnceSeen(view.id);
    if (!ok && mounted) {
      _toast('Could not open this photo.');
      return;
    }
    if (!mounted) return;
    setState(() {
      _messagesFuture = _loadMessages();
    });
  }

  /// Full-screen one-shot reveal of a view-once image. Blocks until dismissed.
  Future<void> _showViewOnceImage(ChatMessageView view) async {
    final media = view.media;
    final url = media?.remoteUrl;
    final localPath = media?.localPath;
    if ((url == null || url.isEmpty) &&
        (localPath == null || localPath.isEmpty)) {
      return;
    }
    await showDialog<void>(
      context: context,
      barrierColor: Colors.black,
      builder: (dialogContext) {
        final image = localPath != null && localPath.isNotEmpty
            ? Image.file(File(localPath), fit: BoxFit.contain)
            : Image.network(url!, fit: BoxFit.contain);
        return Dialog.fullscreen(
          backgroundColor: Colors.black,
          child: Stack(
            children: [
              Positioned.fill(child: Center(child: image)),
              Positioned(
                top: 12,
                right: 12,
                child: SafeArea(
                  child: IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                    onPressed: () => Navigator.of(dialogContext).pop(),
                  ),
                ),
              ),
              const Positioned(
                left: 0,
                right: 0,
                bottom: 24,
                child: SafeArea(
                  child: Center(
                    child: Text(
                      'This photo can only be viewed once',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Present the disappearing-messages timer chooser (Off / 24h / 7d / 90d) and
  /// apply the pick to the server + this session's outgoing-message stamping.
  Future<void> _openDisappearingChooser() async {
    const options = <(String, int)>[
      ('Off', 0),
      ('24 hours', 86400),
      ('7 days', 604800),
      ('90 days', 7776000),
    ];
    final picked = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: ChatColors.card,
      barrierColor: ChatColors.barrier,
      shape: const RoundedRectangleBorder(borderRadius: ChatRadii.sheetTop),
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(
                  ChatSpacing.lg,
                  ChatSpacing.lg,
                  ChatSpacing.lg,
                  ChatSpacing.sm,
                ),
                child: Text(
                  'Disappearing messages',
                  style: ChatTextStyles.sectionLabel,
                ),
              ),
              for (final (label, seconds) in options)
                ListTile(
                  leading: Icon(
                    seconds == 0
                        ? Icons.timer_off_outlined
                        : Icons.timer_outlined,
                    color: ChatColors.primary,
                  ),
                  title: Text(
                    label,
                    style: const TextStyle(color: ChatColors.foreground),
                  ),
                  trailing: _disappearingSeconds == seconds
                      ? const Icon(
                          Icons.check_rounded,
                          color: ChatColors.primary,
                        )
                      : null,
                  onTap: () => Navigator.of(sheetContext).pop(seconds),
                ),
              const SizedBox(height: ChatSpacing.sm),
            ],
          ),
        );
      },
    );
    if (picked == null || !mounted) return;
    if (!widget.connectivityService.isOnline) {
      showOfflineSnackBar(context);
      return;
    }
    final conversation = await widget.messagesRepository.loadConversation(
      widget.conversationId,
    );
    final serverConversationId = conversation?.serverConversationId;
    final ok = await _interactions.setDisappearingTimer(
      (serverConversationId != null && serverConversationId.isNotEmpty)
          ? serverConversationId
          : widget.conversationId,
      picked,
    );
    if (!mounted) return;
    if (!ok) {
      _toast('Could not update the timer.');
      return;
    }
    await widget.messagesRepository.setConversationDisappearingSeconds(
      conversationId: widget.conversationId,
      seconds: picked,
    );
    if (!mounted) return;
    setState(() => _disappearingSeconds = picked);
    _toast(
      picked == 0
          ? 'Disappearing messages turned off'
          : 'Messages now disappear after ${_timerLabel(picked)}',
    );
  }

  static String _timerLabel(int seconds) {
    switch (seconds) {
      case 86400:
        return '24 hours';
      case 604800:
        return '7 days';
      case 7776000:
        return '90 days';
      default:
        return '$seconds seconds';
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
              avatarUrl: _otherUserAvatarUrl,
              onBack: widget.onBack,
              onVoiceCall: () => _startCall(CallType.voice),
              onVideoCall: () => _startCall(CallType.video),
              onSearch: _toggleThreadSearch,
              onMore: _openConversationOptions,
              disappearingSeconds: _disappearingSeconds,
            ),
            if (_isThreadSearchOpen)
              _ThreadSearchBar(
                controller: _threadSearchController,
                onChanged: (value) {
                  setState(() => _threadSearchQuery = value);
                },
                onClose: _toggleThreadSearch,
              ),
            Expanded(
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      ChatColors.background,
                      ChatColors.threadMidpoint,
                      ChatColors.background,
                    ],
                  ),
                ),
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

                    // Disappearing messages vanish locally the moment they pass
                    // their expiry, even before the server-side purge runs.
                    final nowMillis = DateTime.now().millisecondsSinceEpoch;
                    final live = messages
                        .where(
                          (m) =>
                              m.expiresAtMillis == null ||
                              m.expiresAtMillis! > nowMillis,
                        )
                        .toList(growable: false);
                    if (live.isEmpty) {
                      return const _EmptyConversationState();
                    }

                    final allViews = localMessagesToViews(
                      live,
                      currentUserKey: _currentUserKey,
                      currentUserName: widget.profile.displayName,
                      starredMessageIds: _starredMessageIds,
                    );
                    final query = _threadSearchQuery.trim().toLowerCase();
                    final views = query.isEmpty
                        ? allViews
                        : allViews
                              .where(
                                (message) =>
                                    message.body.toLowerCase().contains(
                                      query,
                                    ) ||
                                    message.senderName.toLowerCase().contains(
                                      query,
                                    ),
                              )
                              .toList(growable: false);
                    if (views.isEmpty) {
                      return _NoMessageSearchResults(query: _threadSearchQuery);
                    }

                    return ListView.builder(
                      reverse: true,
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
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
                            mediaBleeds: MediaMessageContent.wantsFullBleed(view),
                            onLongPress: () => _openMessageActions(view),
                            onSwipeReply: () => _setReply(view),
                          ),
                        );
                      },
                    );
                  },
                ),
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
              mentionSuggestions: _mentionSuggestions,
              replyPreview: _replyTarget,
              onCancelReply: () => setState(() => _replyTarget = null),
              onSend: _sendMessage,
              onAttach: _openAttachmentOptions,
              onEmoji: _openEmojiStickerSheet,
              onVoice: _recordAudioNote,
              onTypingChanged: _onTypingChanged,
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
    required this.onSearch,
    required this.onMore,
    required this.disappearingSeconds,
    this.avatarUrl,
    this.header,
  });

  final String title;

  /// Live presence/activity for the other participant. Populated from whatever
  /// local state exists; when null (the common case until the backend presence
  /// contract lands) the header falls back to the neutral sync subtitle.
  final ChatHeaderView? header;
  final String? avatarUrl;
  final VoidCallback onBack;
  final VoidCallback onVoiceCall;
  final VoidCallback onVideoCall;
  final VoidCallback onSearch;
  final VoidCallback onMore;

  /// Current timer (seconds; 0 = off) so the overflow item can show its state.
  final int disappearingSeconds;

  @override
  Widget build(BuildContext context) {
    final presence = header?.presence ?? PresenceState.offline;
    final activity = header?.activity ?? ChatActivity.none;
    final showDot = presenceShowsDot(presence);

    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(
        horizontal: ChatSpacing.xs,
        vertical: ChatSpacing.xs,
      ),
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
          _ProfileAvatar(
            displayName: title,
            avatarUrl: avatarUrl,
            size: 40,
            showOnline: showDot,
            presenceColor: presence == PresenceState.activeNow
                ? ChatColors.activeNow
                : ChatColors.online,
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
          _HeaderAction(
            tooltip: 'Voice call',
            icon: Icons.call_outlined,
            onPressed: onVoiceCall,
          ),
          _HeaderAction(
            tooltip: 'Video call',
            icon: Icons.videocam_outlined,
            onPressed: onVideoCall,
          ),
          _HeaderAction(
            tooltip: 'Search conversation',
            icon: Icons.search_rounded,
            onPressed: onSearch,
          ),
          _HeaderAction(
            tooltip: 'Conversation options',
            icon: disappearingSeconds > 0
                ? Icons.more_time_rounded
                : Icons.more_vert_rounded,
            onPressed: onMore,
            emphasized: disappearingSeconds > 0,
          ),
        ],
      ),
    );
  }
}

class _ThreadSearchBar extends StatelessWidget {
  const _ThreadSearchBar({
    required this.controller,
    required this.onChanged,
    required this.onClose,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ChatColors.card,
      padding: const EdgeInsets.fromLTRB(
        ChatSpacing.md,
        ChatSpacing.xs,
        ChatSpacing.md,
        ChatSpacing.sm,
      ),
      child: TextField(
        controller: controller,
        autofocus: true,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        cursorColor: ChatColors.primary,
        style: const TextStyle(color: ChatColors.foreground, fontSize: 14),
        decoration: InputDecoration(
          isDense: true,
          filled: true,
          fillColor: ChatColors.input,
          hintText: 'Search this conversation',
          hintStyle: ChatTextStyles.previewMuted,
          prefixIcon: const Icon(
            Icons.search_rounded,
            color: ChatColors.mutedForeground,
            size: 20,
          ),
          suffixIcon: IconButton(
            tooltip: 'Close search',
            onPressed: onClose,
            icon: const Icon(
              Icons.close_rounded,
              color: ChatColors.mutedForeground,
              size: 19,
            ),
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ChatRadii.md),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ChatRadii.md),
            borderSide: const BorderSide(color: ChatColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ChatRadii.md),
            borderSide: const BorderSide(color: ChatColors.primary, width: 1.4),
          ),
        ),
      ),
    );
  }
}

class _HeaderAction extends StatelessWidget {
  const _HeaderAction({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.emphasized = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 38,
      height: 38,
      child: IconButton(
        tooltip: tooltip,
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        style: IconButton.styleFrom(
          backgroundColor: emphasized
              ? ChatColors.primaryFaint
              : Colors.transparent,
          foregroundColor: emphasized
              ? ChatColors.primary
              : ChatColors.mutedForeground,
          shape: const CircleBorder(),
        ),
        icon: Icon(icon, size: 20),
      ),
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({
    required this.displayName,
    required this.avatarUrl,
    required this.size,
    this.showOnline = false,
    this.presenceColor = ChatColors.online,
  });

  final String displayName;
  final String? avatarUrl;
  final double size;
  final bool showOnline;
  final Color presenceColor;

  @override
  Widget build(BuildContext context) {
    final trimmedUrl = avatarUrl?.trim();
    final initial = displayName.trim().isEmpty
        ? '?'
        : displayName.trim().characters.first.toUpperCase();
    final fallback = DecoratedBox(
      decoration: const BoxDecoration(
        gradient: ChatGradients.avatarFallback,
        shape: BoxShape.circle,
      ),
      child: SizedBox.square(
        dimension: size,
        child: Center(
          child: Text(
            initial,
            style: TextStyle(
              color: ChatColors.primaryForeground,
              fontWeight: FontWeight.w800,
              fontSize: size * 0.36,
            ),
          ),
        ),
      ),
    );

    return SizedBox.square(
      dimension: size + 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.all(1),
              child: trimmedUrl == null || trimmedUrl.isEmpty
                  ? fallback
                  : ClipOval(
                      child: Image.network(
                        trimmedUrl,
                        width: size,
                        height: size,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => fallback,
                      ),
                    ),
            ),
          ),
          if (showOnline)
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: presenceColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: ChatColors.card, width: 2),
                ),
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

class _NoChatSearchResults extends StatelessWidget {
  const _NoChatSearchResults({required this.query});

  final String query;

  @override
  Widget build(BuildContext context) {
    return _SearchEmptyState(
      title: 'No chats found',
      message: 'No conversation matches “${query.trim()}”.',
    );
  }
}

class _NoMessageSearchResults extends StatelessWidget {
  const _NoMessageSearchResults({required this.query});

  final String query;

  @override
  Widget build(BuildContext context) {
    return _SearchEmptyState(
      title: 'No messages found',
      message: 'Try another word or phrase.',
    );
  }
}

class _SearchEmptyState extends StatelessWidget {
  const _SearchEmptyState({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(ChatSpacing.xl),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: ChatColors.card.withValues(alpha: 0.82),
            borderRadius: BorderRadius.circular(ChatRadii.sheet),
            border: Border.all(color: ChatColors.border),
          ),
          child: Padding(
            padding: const EdgeInsets.all(ChatSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.search_off_rounded,
                  color: ChatColors.primary,
                  size: 34,
                ),
                const SizedBox(height: ChatSpacing.md),
                Text(
                  title,
                  style: const TextStyle(
                    color: ChatColors.foreground,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: ChatSpacing.xs),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: ChatTextStyles.previewMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet listing conversations to forward a message into.
class _ForwardTargetSheet extends StatelessWidget {
  const _ForwardTargetSheet({required this.conversations});

  final List<ConversationSummary> conversations;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Text(
              'Forward to',
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: conversations.length,
              itemBuilder: (context, index) {
                final c = conversations[index];
                final title = c.title.trim().isEmpty ? 'Conversation' : c.title;
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: ChatColors.primary,
                    child: Text(
                      title.characters.first.toUpperCase(),
                      style: const TextStyle(color: Colors.white),
                    ),
                  ),
                  title: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white),
                  ),
                  onTap: () => Navigator.of(context).pop(c),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
        ],
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
