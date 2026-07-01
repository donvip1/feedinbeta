import 'package:flutter/material.dart';

import '../data/groups_remote_data_source.dart';
import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import '../widgets/group_avatar.dart';
import '../widgets/group_composer.dart';

/// A single broadcast/announcement channel inside a group (Telegram-style).
///
/// Shows the channel's posts newest-at-the-bottom as announcement cards and a
/// composer to broadcast a new post. Channels are modelled on the group's
/// `messages` table (no dedicated channels table exists — see the data source /
/// module report), so this reuses [GroupsRemoteDataSource] rather than a new
/// backend seam.
class GroupChannelScreen extends StatefulWidget {
  const GroupChannelScreen({
    super.key,
    required this.dataSource,
    required this.conversationId,
    required this.channelName,
    required this.currentUserId,
    required this.onBack,
  });

  final GroupsRemoteDataSource dataSource;
  final String conversationId;
  final String channelName;
  final String currentUserId;
  final VoidCallback onBack;

  @override
  State<GroupChannelScreen> createState() => _GroupChannelScreenState();
}

class _GroupChannelScreenState extends State<GroupChannelScreen> {
  final _composerController = TextEditingController();
  final _listController = ScrollController();

  List<GroupChannelPostView>? _posts;

  @override
  void initState() {
    super.initState();
    _loadPosts();
  }

  @override
  void dispose() {
    _composerController.dispose();
    _listController.dispose();
    super.dispose();
  }

  Future<void> _loadPosts() async {
    final remote = await widget.dataSource.fetchChannelPosts(
      conversationId: widget.conversationId,
      channelName: widget.channelName,
    );
    if (!mounted) return;
    setState(() {
      _posts = remote
          .map((p) =>
              groupChannelPostToView(p, currentUserId: widget.currentUserId))
          .toList();
    });
  }

  Future<void> _post() async {
    final text = _composerController.text;
    if (text.trim().isEmpty) return;
    _composerController.clear();
    await widget.dataSource.postToChannel(
      conversationId: widget.conversationId,
      channelName: widget.channelName,
      body: text,
    );
    if (!mounted) return;
    await _loadPosts();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: GroupColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _ChannelHeader(name: widget.channelName, onBack: widget.onBack),
            Expanded(child: _buildPosts()),
            GroupComposer(
              controller: _composerController,
              onSend: _post,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPosts() {
    final posts = _posts;
    if (posts == null) {
      return const Center(
        child: CircularProgressIndicator(color: GroupColors.primary),
      );
    }
    if (posts.isEmpty) {
      return const _EmptyChannelState();
    }
    return ListView.builder(
      controller: _listController,
      reverse: true,
      padding: const EdgeInsets.symmetric(
        horizontal: GroupSpacing.md,
        vertical: GroupSpacing.md,
      ),
      itemCount: posts.length,
      itemBuilder: (context, index) {
        // Reversed list: newest post at the bottom.
        final post = posts[posts.length - 1 - index];
        return Padding(
          padding: const EdgeInsets.only(bottom: GroupSpacing.sm),
          child: _ChannelPostCard(post: post),
        );
      },
    );
  }
}

class _ChannelHeader extends StatelessWidget {
  const _ChannelHeader({required this.name, required this.onBack});

  final String name;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: GroupSpacing.headerHeight,
      padding: const EdgeInsets.symmetric(horizontal: GroupSpacing.xs),
      decoration: const BoxDecoration(
        color: GroupColors.card,
        border: Border(bottom: BorderSide(color: GroupColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: GroupColors.foreground),
            onPressed: onBack,
            tooltip: 'Back',
          ),
          Container(
            width: GroupSpacing.avatarSm + 4,
            height: GroupSpacing.avatarSm + 4,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: GroupGradients.avatarFallback,
            ),
            child: const Icon(
              Icons.campaign_rounded,
              size: 18,
              color: GroupColors.primaryForeground,
            ),
          ),
          const SizedBox(width: GroupSpacing.sm),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GroupTextStyles.headerName,
                ),
                const Text('Channel', style: GroupTextStyles.subtitle),
              ],
            ),
          ),
          const SizedBox(width: GroupSpacing.sm),
        ],
      ),
    );
  }
}

/// One broadcast post rendered as a full-width announcement card.
class _ChannelPostCard extends StatelessWidget {
  const _ChannelPostCard({required this.post});

  final GroupChannelPostView post;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(GroupSpacing.md),
      decoration: BoxDecoration(
        color: GroupColors.incomingBubble,
        borderRadius: GroupRadii.bubble,
        border: Border.all(color: GroupColors.incomingBubbleBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              GroupAvatar(
                initial: post.senderInitial,
                avatarUrl: post.senderAvatarUrl,
                size: GroupSpacing.avatarSm,
              ),
              const SizedBox(width: GroupSpacing.sm),
              Expanded(
                child: Text(
                  post.senderName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GroupTextStyles.senderLabel,
                ),
              ),
              Text(
                groupClockTime(post.createdAtMillis),
                style: GroupTextStyles.timestamp,
              ),
            ],
          ),
          const SizedBox(height: GroupSpacing.sm),
          Text(post.body, style: GroupTextStyles.messageBody),
        ],
      ),
    );
  }
}

class _EmptyChannelState extends StatelessWidget {
  const _EmptyChannelState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GroupSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
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
                child: const Icon(
                  Icons.campaign_rounded,
                  size: 28,
                  color: GroupColors.primaryForeground,
                ),
              ),
            ),
            const SizedBox(height: GroupSpacing.lg),
            const Text(
              'No posts yet',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: GroupColors.foreground,
              ),
            ),
            const SizedBox(height: GroupSpacing.sm),
            const Text(
              'Broadcast the first announcement to this channel.',
              textAlign: TextAlign.center,
              style: GroupTextStyles.previewMuted,
            ),
          ],
        ),
      ),
    );
  }
}
