import 'package:flutter/material.dart';

import '../data/group_models.dart';
import '../data/groups_remote_data_source.dart';
import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import '../widgets/create_group_sheet.dart';
import '../widgets/group_chat_header.dart';
import '../widgets/group_composer.dart';
import '../widgets/group_members_sheet.dart';
import '../widgets/group_message_bubble.dart';

/// The open group room: header, message list, composer, plus members / add /
/// leave affordances. Loads messages + members from [dataSource] and posts new
/// messages back through it, then refreshes.
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

  @override
  State<GroupChatScreen> createState() => _GroupChatScreenState();
}

class _GroupChatScreenState extends State<GroupChatScreen> {
  final _messageController = TextEditingController();
  late Future<List<GroupMessageView>> _messagesFuture;

  List<GroupMemberView> _members = const [];
  bool _membersLoading = true;
  int _memberCount = 0;
  final _listController = ScrollController();

  @override
  void initState() {
    super.initState();
    _memberCount = widget.initialMemberCount;
    _messagesFuture = _loadMessages();
    _loadMembers();
    widget.dataSource.markRead(widget.conversationId);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _listController.dispose();
    super.dispose();
  }

  Future<List<GroupMessageView>> _loadMessages() async {
    final List<RemoteGroupMessage> remote = await widget.dataSource
        .fetchMessages(widget.conversationId);
    return groupMessagesToViews(remote, currentUserId: widget.currentUserId);
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
    setState(() => _messagesFuture = _loadMessages());
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
              onLeaveGroup: _confirmLeave,
            ),
            Expanded(
              child: FutureBuilder<List<GroupMessageView>>(
                future: _messagesFuture,
                builder: (context, snapshot) {
                  final messages = snapshot.data;
                  if (messages == null) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: GroupColors.primary,
                      ),
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
                      final view = messages[messages.length - 1 - index];
                      return Padding(
                        padding: EdgeInsets.only(
                          top: view.isFirstInGroup ? GroupSpacing.sm : 2,
                        ),
                        child: GroupMessageBubble(message: view),
                      );
                    },
                  );
                },
              ),
            ),
            GroupComposer(controller: _messageController, onSend: _send),
          ],
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
