import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../data/communities_remote_data_source.dart';
import '../data/community_models.dart';
import '../data/community_realtime_service.dart';
import '../groups_theme.dart';

class CommunityChatScreen extends StatefulWidget {
  const CommunityChatScreen({
    super.key,
    required this.community,
    required this.currentUserId,
    required this.dataSource,
  });

  final CommunitySummary community;
  final String currentUserId;
  final CommunitiesRemoteDataSource dataSource;

  @override
  State<CommunityChatScreen> createState() => _CommunityChatScreenState();
}

class _CommunityChatScreenState extends State<CommunityChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _imagePicker = ImagePicker();
  late final CommunityRealtimeService _realtime;
  StreamSubscription<void>? _realtimeSub;
  List<CommunityMessage>? _messages;
  List<CommunityMember> _members = const [];
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadAll();
    _realtime = CommunityRealtimeService.autoDetect(widget.community.id);
    _realtimeSub = _realtime.changes.listen((_) => _loadMessages());
    _realtime.connect();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    _realtimeSub?.cancel();
    unawaited(_realtime.dispose());
    super.dispose();
  }

  Future<void> _loadAll() async {
    await Future.wait([_loadMessages(), _loadMembers()]);
  }

  Future<void> _loadMessages() async {
    final messages = await widget.dataSource.fetchMessages(widget.community.id);
    if (!mounted) return;
    setState(() => _messages = messages);
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  Future<void> _loadMembers() async {
    final members = await widget.dataSource.fetchMembers(widget.community.id);
    if (mounted) setState(() => _members = members);
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
    );
  }

  Future<void> _send() async {
    final body = _controller.text.trim();
    if (body.isEmpty || _sending) return;
    _controller.clear();
    setState(() => _sending = true);
    try {
      await widget.dataSource.sendMessage(
        groupId: widget.community.id,
        body: body,
      );
      await _loadMessages();
    } catch (_) {
      if (mounted) _toast('Could not send this message.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickImage() async {
    final image = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 86,
      maxWidth: 1920,
    );
    if (image == null) return;
    setState(() => _sending = true);
    try {
      await widget.dataSource.sendImage(
        groupId: widget.community.id,
        localPath: image.path,
      );
      await _loadMessages();
    } catch (_) {
      if (mounted) _toast('Could not share this photo.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _copyInvite() async {
    final link =
        'https://feedin.app/groups/join/${widget.community.inviteCode}';
    await Clipboard.setData(ClipboardData(text: link));
    if (mounted) {
      _toast('Group link copied. Link joins require approval and cost 50 credits.');
    }
  }

  Future<void> _showJoinRequests() async {
    final requests = await widget.dataSource.fetchPendingJoinRequests(
      widget.community.id,
    );
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: requests.isEmpty
            ? const Padding(
                padding: EdgeInsets.all(28),
                child: Center(child: Text('No pending join requests.')),
              )
            : ListView.builder(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                itemCount: requests.length,
                itemBuilder: (context, index) {
                  final request = requests[index];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundImage: request.avatarUrl?.isNotEmpty == true
                          ? NetworkImage(request.avatarUrl!)
                          : null,
                      child: request.avatarUrl?.isNotEmpty == true
                          ? null
                          : Text(request.displayName.characters.first),
                    ),
                    title: Text(request.displayName),
                    subtitle: Text(
                      '${request.estimatedCost} credits charged to applicant on approval',
                    ),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          tooltip: 'Reject',
                          onPressed: () {
                            Navigator.of(sheetContext).pop();
                            _reviewJoinRequest(request, false);
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                        IconButton.filled(
                          tooltip: 'Approve',
                          onPressed: () {
                            Navigator.of(sheetContext).pop();
                            _reviewJoinRequest(request, true);
                          },
                          icon: const Icon(Icons.check_rounded),
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }

  Future<void> _reviewJoinRequest(
    CommunityJoinRequest request,
    bool approve,
  ) async {
    try {
      await widget.dataSource.reviewJoinRequest(
        requestId: request.id,
        approve: approve,
      );
      if (!mounted) return;
      _toast(approve ? '${request.displayName} joined.' : 'Request rejected.');
      await _loadMembers();
    } catch (error) {
      if (!mounted) return;
      final message = error.toString();
      _toast(
        message.contains('INSUFFICIENT_CREDITS')
            ? '${request.displayName} does not have enough credits yet.'
            : 'Could not review this request.',
      );
    }
  }

  Future<void> _leave() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Leave community?'),
        content: const Text('You will no longer receive community messages.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.dataSource.leaveCommunity(widget.community.id);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) _toast('The owner must transfer ownership before leaving.');
    }
  }

  void _showMembers() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView.builder(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          itemCount: _members.length,
          itemBuilder: (context, index) {
            final member = _members[index];
            return ListTile(
              leading: CircleAvatar(
                backgroundImage: member.avatarUrl?.isNotEmpty == true
                    ? NetworkImage(member.avatarUrl!)
                    : null,
                child: member.avatarUrl?.isNotEmpty == true
                    ? null
                    : Text(member.displayName.characters.first),
              ),
              title: Text(member.displayName),
              subtitle: member.username == null
                  ? null
                  : Text('@${member.username}'),
              trailing: member.role == 'member'
                  ? null
                  : Text(
                      member.role,
                      style: const TextStyle(
                        color: GroupColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
            );
          },
        ),
      ),
    );
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GroupColors.background,
      appBar: AppBar(
        backgroundColor: GroupColors.background,
        titleSpacing: 0,
        title: InkWell(
          onTap: _showMembers,
          child: Row(
            children: [
              _Avatar(community: widget.community),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.community.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '${_members.isEmpty ? widget.community.memberCount : _members.length} members',
                      style: const TextStyle(
                        color: GroupColors.mutedForeground,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Copy group link',
            onPressed: _copyInvite,
            icon: const Icon(Icons.link_rounded),
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'members') _showMembers();
              if (value == 'requests') _showJoinRequests();
              if (value == 'leave') _leave();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'members', child: Text('Members')),
              if (widget.community.viewerRole == 'owner' ||
                  widget.community.viewerRole == 'admin')
                const PopupMenuItem(
                  value: 'requests',
                  child: Text('Join requests'),
                ),
              const PopupMenuItem(
                value: 'leave',
                child: Text('Leave community'),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: _buildMessages()),
          _Composer(
            controller: _controller,
            sending: _sending,
            onAttach: _pickImage,
            onSend: _send,
          ),
        ],
      ),
    );
  }

  Widget _buildMessages() {
    final messages = _messages;
    if (messages == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (messages.isEmpty) {
      return const Center(
        child: Text(
          'No messages yet',
          style: TextStyle(color: GroupColors.mutedForeground),
        ),
      );
    }
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 18),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[index];
        final mine = message.senderId == widget.currentUserId;
        final previous = index > 0 ? messages[index - 1] : null;
        final grouped =
            previous?.senderId == message.senderId &&
            message.createdAtMillis - previous!.createdAtMillis < 180000;
        return _MessageBubble(message: message, mine: mine, grouped: grouped);
      },
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.mine,
    required this.grouped,
  });

  final CommunityMessage message;
  final bool mine;
  final bool grouped;

  @override
  Widget build(BuildContext context) {
    final time = TimeOfDay.fromDateTime(
      DateTime.fromMillisecondsSinceEpoch(message.createdAtMillis),
    ).format(context);
    return Padding(
      padding: EdgeInsets.only(top: grouped ? 3 : 10),
      child: Row(
        mainAxisAlignment: mine
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!mine) ...[
            if (!grouped)
              CircleAvatar(
                radius: 15,
                backgroundImage: message.senderAvatarUrl?.isNotEmpty == true
                    ? NetworkImage(message.senderAvatarUrl!)
                    : null,
                child: message.senderAvatarUrl?.isNotEmpty == true
                    ? null
                    : Text(
                        message.senderName.characters.first,
                        style: const TextStyle(fontSize: 11),
                      ),
              )
            else
              const SizedBox(width: 30),
            const SizedBox(width: 7),
          ],
          Flexible(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 340),
              padding: EdgeInsets.all(message.mediaUrl == null ? 11 : 5),
              decoration: BoxDecoration(
                color: mine ? const Color(0xFF245BDB) : GroupColors.rowCard,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(8),
                  topRight: const Radius.circular(8),
                  bottomLeft: Radius.circular(!mine && !grouped ? 2 : 8),
                  bottomRight: Radius.circular(mine && !grouped ? 2 : 8),
                ),
                border: mine
                    ? null
                    : Border.all(color: GroupColors.rowCardBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!mine && !grouped)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(6, 4, 6, 5),
                      child: Text(
                        message.senderName,
                        style: const TextStyle(
                          color: GroupColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  if (message.mediaUrl != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.network(
                        message.mediaUrl!,
                        width: 240,
                        height: 220,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox(
                          width: 240,
                          height: 120,
                          child: Center(
                            child: Icon(Icons.broken_image_outlined),
                          ),
                        ),
                      ),
                    ),
                  if (message.content.trim().isNotEmpty)
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        message.mediaUrl == null ? 0 : 7,
                        message.mediaUrl == null ? 0 : 8,
                        message.mediaUrl == null ? 0 : 7,
                        0,
                      ),
                      child: Text(message.content),
                    ),
                  Padding(
                    padding: EdgeInsets.fromLTRB(
                      message.mediaUrl == null ? 0 : 7,
                      5,
                      message.mediaUrl == null ? 0 : 7,
                      message.mediaUrl == null ? 0 : 4,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          time,
                          style: TextStyle(
                            color: mine
                                ? Colors.white70
                                : GroupColors.mutedForeground,
                            fontSize: 10,
                          ),
                        ),
                        if (mine) ...[
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.done_all_rounded,
                            size: 13,
                            color: Color(0xFF9EC5FF),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onAttach,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onAttach;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
        decoration: const BoxDecoration(
          color: GroupColors.background,
          border: Border(top: BorderSide(color: GroupColors.rowCardBorder)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            IconButton(
              tooltip: 'Share photo',
              onPressed: sending ? null : onAttach,
              icon: const Icon(Icons.attach_file_rounded),
            ),
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  hintText: 'Message',
                  isDense: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(8)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 7),
            IconButton.filled(
              tooltip: 'Send',
              onPressed: sending ? null : onSend,
              icon: sending
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_rounded),
            ),
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.community});

  final CommunitySummary community;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 18,
      backgroundImage: community.avatarUrl?.isNotEmpty == true
          ? NetworkImage(community.avatarUrl!)
          : null,
      child: community.avatarUrl?.isNotEmpty == true
          ? null
          : Text(community.name.characters.first),
    );
  }
}
