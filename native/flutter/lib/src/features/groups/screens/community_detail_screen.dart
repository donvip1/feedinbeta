import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/communities_remote_data_source.dart';
import '../data/community_models.dart';
import '../groups_theme.dart';
import 'community_chat_screen.dart';

class CommunityDetailScreen extends StatefulWidget {
  const CommunityDetailScreen({
    super.key,
    required this.communityId,
    required this.currentUserId,
    required this.dataSource,
  });

  final String communityId;
  final String currentUserId;
  final CommunitiesRemoteDataSource dataSource;

  @override
  State<CommunityDetailScreen> createState() => _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends State<CommunityDetailScreen> {
  CommunitySummary? _community;
  bool _loading = true;
  bool _joining = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final community = await widget.dataSource.fetchCommunity(
      widget.communityId,
    );
    if (!mounted) return;
    setState(() {
      _community = community;
      _loading = false;
    });
  }

  Future<void> _join() async {
    setState(() => _joining = true);
    try {
      final result = await widget.dataSource.joinCommunity(widget.communityId);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      if (result == CommunityJoinResult.joined && _community != null) {
        _openChat(_community!);
      } else {
        _toast('Join request sent to the community admins.');
      }
    } catch (error) {
      if (mounted) _toast(_messageFor(error, 'Could not join this community.'));
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  void _openChat(CommunitySummary community) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => CommunityChatScreen(
          community: community,
          currentUserId: widget.currentUserId,
          dataSource: widget.dataSource,
        ),
      ),
    );
  }

  Future<void> _copyInvite(CommunitySummary community) async {
    final link = 'https://feedin.app/groups/join/${community.inviteCode}';
    await Clipboard.setData(ClipboardData(text: link));
    if (mounted) _toast('Invite link copied.');
  }

  void _toast(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final community = _community;
    if (community == null) {
      return const Scaffold(body: Center(child: Text('Community not found.')));
    }
    return Scaffold(
      backgroundColor: GroupColors.background,
      appBar: AppBar(
        backgroundColor: GroupColors.background,
        title: const Text('Community'),
        actions: [
          if (community.isMember)
            IconButton(
              tooltip: 'Copy invite link',
              onPressed: () => _copyInvite(community),
              icon: const Icon(Icons.link_rounded),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          Center(child: _CommunityAvatar(community: community, size: 92)),
          const SizedBox(height: 16),
          Text(
            community.name,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: GroupColors.foreground,
              fontSize: 26,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: [
              _Badge(
                icon: community.isPrivate
                    ? Icons.lock_outline_rounded
                    : Icons.public_rounded,
                label: community.isPrivate ? 'Private' : 'Public',
              ),
              if (community.isPremium)
                const _Badge(
                  icon: Icons.workspace_premium_outlined,
                  label: 'Premium',
                ),
              _Badge(
                icon: Icons.people_outline_rounded,
                label: '${community.memberCount} members',
              ),
            ],
          ),
          if (community.description.trim().isNotEmpty) ...[
            const SizedBox(height: 22),
            Text(
              community.description,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: GroupColors.mutedForeground,
                fontSize: 15,
                height: 1.45,
              ),
            ),
          ],
          const SizedBox(height: 28),
          if (community.isMember)
            FilledButton.icon(
              onPressed: () => _openChat(community),
              icon: const Icon(Icons.forum_outlined),
              label: const Text('Open community chat'),
            )
          else
            FilledButton.icon(
              onPressed: _joining || community.joinRequestPending
                  ? null
                  : _join,
              icon: _joining
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      community.isPrivate
                          ? Icons.person_add_alt_1_rounded
                          : Icons.login_rounded,
                    ),
              label: Text(
                community.joinRequestPending
                    ? 'Request pending'
                    : community.isPrivate
                    ? 'Request to join'
                    : 'Join community',
              ),
            ),
        ],
      ),
    );
  }
}

class _CommunityAvatar extends StatelessWidget {
  const _CommunityAvatar({required this.community, required this.size});

  final CommunitySummary community;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: GroupGradients.sendAction,
      ),
      child: community.avatarUrl?.isNotEmpty == true
          ? Image.network(community.avatarUrl!, fit: BoxFit.cover)
          : Center(
              child: Text(
                community.name.trim().isEmpty
                    ? 'C'
                    : community.name.characters.first.toUpperCase(),
                style: TextStyle(
                  color: Colors.white,
                  fontSize: size * 0.38,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: GroupColors.rowCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: GroupColors.rowCardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: GroupColors.mutedForeground),
          const SizedBox(width: 5),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

String _messageFor(Object error, String fallback) {
  if (error is PostgrestException && error.message.isNotEmpty) {
    return error.message;
  }
  return fallback;
}
