import 'dart:async';

import 'package:flutter/material.dart';

import '../data/group_models.dart';
import '../data/group_realtime_service.dart';
import '../data/groups_remote_data_source.dart';
import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import '../widgets/create_group_sheet.dart';
import '../widgets/group_channels_sheet.dart';
import '../widgets/group_chat_header.dart';
import '../widgets/group_composer.dart';
import '../widgets/group_members_sheet.dart';
import '../widgets/group_message_bubble.dart';
import 'group_channel_screen.dart';

/// Signature for the "Go Live from group" callback. The coordinator wires this
/// to the live feature's go-live entry (this module must NOT depend on
/// features/live). It receives the group's [conversationId] and a human-readable
/// [groupTitle] so a group-scoped livestream can be started/labelled.
typedef GroupGoLiveCallback =
    void Function({required String conversationId, required String groupTitle});

/// The open group room: header, message list, composer, plus members / add /
/// leave affordances, broadcast channels, and an optional "Go Live" entry.
/// Loads messages + members from [dataSource], posts new messages back through
/// it, and subscribes to a [GroupRealtimeService] so messages from other members
/// appear live.
class GroupChatScreen extends StatefulWidget {
  const GroupChatScreen({
    super.key,
    required this.dataSource,
    required this.conversationId,
    required this.currentUserId,
    required this.initialTitle,
    required this.initialMemberCount,
    required this.onBack,
    this.onLeft,
    this.realtime,
    this.onGoLive,
  });

  final GroupsRemoteDataSource dataSource;
  final String conversationId;
  final String currentUserId;
  final String initialTitle;
  final int initialMemberCount;

  /// Called when the user backs out of the room.
  final VoidCallback onBack;

  /// Called after the user successfully leaves the group, so the host can pop
  /// back to the list and refresh it.
  final VoidCallback? onLeft;

  /// Optional injected realtime service (defaults to
  /// [GroupRealtimeService.autoDetect] for the conversation). Kept optional so
  /// the public constructor stays backward-compatible.
  final GroupRealtimeService? realtime;

  /// Optional "Go Live from group" handler. When provided, a "Go Live" action
  /// is surfaced in the header; tapping it invokes this with the group's
  /// conversation id + title so the coordinator can start a group-scoped
  /// livestream (this module does not depend on features/live). When null, the
  /// affordance is hidden — so the public constructor stays additive.
  final GroupGoLiveCallback? onGoLive;

  @override
  State<GroupChatScreen> createState() => _GroupChatScreenState();
}

class _GroupChatScreenState extends State<GroupChatScreen> {
  final _messageController = TextEditingController();

  /// Loaded messages, oldest-first. Null until the first load resolves so the
  /// UI can distinguish "loading" from "empty". Held in state (rather than a
  /// swapped Future) so background refreshes never flash a spinner.
  List<GroupMessageView>? _messages;

  List<GroupMemberView> _members = const [];
  bool _membersLoading = true;
  int _memberCount = 0;
  final _listController = ScrollController();

  GroupRealtimeService? _realtime;
  StreamSubscription<GroupRealtimeMessageEvent>? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _memberCount = widget.initialMemberCount;
    _loadMessages();
    _loadMembers();
    widget.dataSource.markRead(widget.conversationId);
    _initRealtime();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _listController.dispose();
    _realtimeSub?.cancel();
    unawaited(_realtime?.dispose());
    super.dispose();
  }

  void _initRealtime() {
    final realtime =
        widget.realtime ??
        GroupRealtimeService.autoDetect(widget.conversationId);
    _realtime = realtime;
    _realtimeSub = realtime.messages.listen(_onRealtimeMessage);
    realtime.connect();
  }

  void _onRealtimeMessage(GroupRealtimeMessageEvent event) {
    // Our own sends are already reflected by [_send]'s reload; only refresh for
    // messages authored by other members.
    if (event.senderId != null && event.senderId == widget.currentUserId) {
      return;
    }
    _loadMessages();
    widget.dataSource.markRead(widget.conversationId);
  }

  /// Fetches messages and swaps them into state, keeping any currently-shown
  /// list visible while the network call is in flight.
  Future<void> _loadMessages() async {
    final List<RemoteGroupMessage> remote = await widget.dataSource
        .fetchMessages(widget.conversationId);
    if (!mounted) return;
    setState(() {
      _messages = groupMessagesToViews(
        remote,
        currentUserId: widget.currentUserId,
      );
    });
  }

  Future<void> _loadMembers() async {
    final remote = await widget.dataSource.fetchMembers(widget.conversationId);
    if (!mounted) return;
    setState(() {
      _members = remote
          .map((m) => groupMemberToView(m, currentUserId: widget.currentUserId))
          .toList();
      _memberCount = remote.isEmpty ? _memberCount : remote.length;
      _membersLoading = false;
    });
  }

  int get _onlineCount =>
      _members.where((m) => groupPresenceShowsDot(m.presence)).length;

  Future<void> _send() async {
    final text = _messageController.text;
    if (text.trim().isEmpty) return;
    _messageController.clear();
    await widget.dataSource.sendMessage(
      conversationId: widget.conversationId,
      body: text,
    );
    if (!mounted) return;
    await _loadMessages();
  }

  void _showMembers() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: GroupColors.barrier,
      builder: (_) => GroupMembersSheet(
        members: _members,
        isLoading: _membersLoading,
        onAddMembers: () {
          Navigator.of(context).pop();
          _showAddMembers();
        },
        onLeave: () {
          Navigator.of(context).pop();
          _confirmLeave();
        },
      ),
    );
  }

  void _showAddMembers() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: GroupColors.barrier,
      builder: (sheetContext) => CreateGroupSheet(
        dataSource: widget.dataSource,
        // Reuse the picker purely for member selection; the name field is
        // ignored on the add path.
        onCreate: (result) async {
          Navigator.of(sheetContext).pop();
          await widget.dataSource.addMembers(
            conversationId: widget.conversationId,
            memberIds: result.memberIds,
          );
          if (!mounted) return;
          _toast('Members added');
          await _loadMembers();
        },
      ),
    );
  }

  /// Opens the broadcast-channels sheet for this group. Loads the channels,
  /// then presents [GroupChannelsSheet] with create/open handlers.
  Future<void> _showChannels() async {
    // Present immediately with a loading state, then hydrate.
    final loaded = await widget.dataSource.fetchChannels(widget.conversationId);
    if (!mounted) return;
    final channels = loaded.map(groupChannelToView).toList();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: GroupColors.barrier,
      builder: (sheetContext) => GroupChannelsSheet(
        channels: channels,
        isLoading: false,
        onOpenChannel: (channel) {
          Navigator.of(sheetContext).pop();
          _openChannel(channel);
        },
        onCreateChannel: (name) async {
          // Dismiss the sheet up-front (mirrors the add-members flow) so no
          // sheet BuildContext is used across the create await.
          Navigator.of(sheetContext).pop();
          final created = await widget.dataSource.createChannel(
            conversationId: widget.conversationId,
            name: name,
          );
          if (!mounted || created == null) return;
          _openChannel(groupChannelToView(created));
        },
      ),
    );
  }

  void _openChannel(GroupChannelView channel) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeCtx) => GroupChannelScreen(
          dataSource: widget.dataSource,
          conversationId: widget.conversationId,
          channelId: channel.id,
          channelName: channel.name,
          canPost: channel.canPost,
          isSubscribed: channel.isSubscribed,
          currentUserId: widget.currentUserId,
          onBack: () => Navigator.of(routeCtx).pop(),
        ),
      ),
    );
  }

  /// Starts a group-scoped livestream by delegating to the host-provided
  /// [GroupChatScreen.onGoLive] (this module never touches features/live).
  void _goLive() {
    widget.onGoLive?.call(
      conversationId: widget.conversationId,
      groupTitle: widget.initialTitle,
    );
  }

  Future<void> _confirmLeave() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: GroupColors.card,
        title: const Text(
          'Leave group?',
          style: TextStyle(color: GroupColors.foreground),
        ),
        content: const Text(
          'You will stop receiving messages from this group.',
          style: TextStyle(color: GroupColors.mutedForeground),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: GroupColors.mutedForeground),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text(
              'Leave',
              style: TextStyle(color: GroupColors.destructive),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await widget.dataSource.leaveGroup(widget.conversationId);
    if (!mounted) return;
    (widget.onLeft ?? widget.onBack)();
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Widget _buildMessages() {
    final messages = _messages;
    if (messages == null) {
      return const Center(
        child: CircularProgressIndicator(color: GroupColors.primary),
      );
    }
    if (messages.isEmpty) {
      return const _EmptyRoomState();
    }
    return ListView.builder(
      controller: _listController,
      reverse: true,
      padding: const EdgeInsets.symmetric(
        horizontal: GroupSpacing.md,
        vertical: GroupSpacing.md,
      ),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        // Reversed list: display index 0 is the newest message (at the bottom).
        final ordered = messages.length - 1 - index;
        final view = messages[ordered];
        // A day header sits above the first message of each calendar day.
        final showDate =
            ordered == 0 ||
            !groupIsSameDay(
              messages[ordered - 1].createdAtMillis,
              view.createdAtMillis,
            );
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showDate) _DateSeparator(millis: view.createdAtMillis),
            Padding(
              padding: EdgeInsets.only(
                top: view.isFirstInGroup && !showDate ? GroupSpacing.sm : 2,
              ),
              child: GroupMessageBubble(message: view),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: GroupColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            GroupChatHeader(
              title: widget.initialTitle,
              memberCount: _memberCount,
              onlineCount: _onlineCount,
              onBack: widget.onBack,
              onShowMembers: _showMembers,
              onAddMembers: _showAddMembers,
              onShowChannels: _showChannels,
              onGoLive: widget.onGoLive != null ? _goLive : null,
              onLeaveGroup: _confirmLeave,
            ),
            Expanded(child: _buildMessages()),
            GroupComposer(controller: _messageController, onSend: _send),
          ],
        ),
      ),
    );
  }
}

/// A centered "Today" / "Yesterday" / date pill separating message days
/// (web date header). Purely presentational.
class _DateSeparator extends StatelessWidget {
  const _DateSeparator({required this.millis});

  final int millis;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: GroupSpacing.sm),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: GroupSpacing.md,
            vertical: GroupSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: GroupColors.rowCard,
            borderRadius: BorderRadius.circular(GroupRadii.pill),
            border: Border.all(color: GroupColors.rowCardBorder),
          ),
          child: Text(
            groupDateHeader(millis),
            style: GroupTextStyles.timestamp,
          ),
        ),
      ),
    );
  }
}

class _EmptyRoomState extends StatelessWidget {
  const _EmptyRoomState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GroupSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            _GradientGlyph(icon: Icons.forum_rounded),
            SizedBox(height: GroupSpacing.lg),
            Text(
              'No messages yet',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: GroupColors.foreground,
              ),
            ),
            SizedBox(height: GroupSpacing.sm),
            Text(
              'Be the first to say something to the group.',
              textAlign: TextAlign.center,
              style: GroupTextStyles.previewMuted,
            ),
          ],
        ),
      ),
    );
  }
}

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
        color: GroupColors.primaryFaint,
        boxShadow: GroupShadows.glow,
      ),
      child: Container(
        width: 60,
        height: 60,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: GroupGradients.sendAction,
          boxShadow: GroupShadows.pink,
        ),
        child: Icon(icon, size: 28, color: GroupColors.primaryForeground),
      ),
    );
  }
}
