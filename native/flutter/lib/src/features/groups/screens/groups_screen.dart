import 'package:flutter/material.dart';

import '../data/communities_remote_data_source.dart';
import '../data/community_models.dart';
import '../groups_theme.dart';
import '../widgets/create_community_sheet.dart';
import 'community_chat_screen.dart';
import 'community_detail_screen.dart';

typedef GroupGoLiveCallback =
    void Function({required String conversationId, required String groupTitle});

class GroupsScreen extends StatefulWidget {
  const GroupsScreen({
    super.key,
    required this.currentUserId,
    this.dataSource,
    this.onBack,
    this.onGoLive,
  });

  final String currentUserId;
  final CommunitiesRemoteDataSource? dataSource;
  final VoidCallback? onBack;

  // Kept for compatibility with the existing coordinator. Community live rooms
  // need a separate authorization contract from conversation-scoped streams.
  final GroupGoLiveCallback? onGoLive;

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  final _searchController = TextEditingController();
  late final CommunitiesRemoteDataSource _dataSource;
  late Future<List<CommunitySummary>> _communitiesFuture;
  int _segment = 0;

  @override
  void initState() {
    super.initState();
    _dataSource = widget.dataSource ?? CommunitiesRemoteDataSource.autoDetect();
    _communitiesFuture = _dataSource.fetchCommunities();
    _searchController.addListener(_refreshFilter);
  }

  @override
  void dispose() {
    _searchController
      ..removeListener(_refreshFilter)
      ..dispose();
    super.dispose();
  }

  void _refreshFilter() => setState(() {});

  Future<void> _refresh() async {
    setState(() => _communitiesFuture = _dataSource.fetchCommunities());
    await _communitiesFuture;
  }

  void _openCommunity(CommunitySummary community) {
    final route = community.isMember
        ? CommunityChatScreen(
            community: community,
            currentUserId: widget.currentUserId,
            dataSource: _dataSource,
          )
        : CommunityDetailScreen(
            communityId: community.id,
            currentUserId: widget.currentUserId,
            dataSource: _dataSource,
          );
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => route))
        .then((_) => _refresh());
  }

  void _openCreate() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => CreateCommunitySheet(
        onCreate: (result) async {
          try {
            final community = await _dataSource.createCommunity(
              name: result.name,
              description: result.description,
              isPrivate: result.isPrivate,
              isPremium: result.isPremium,
            );
            if (!sheetContext.mounted) return;
            Navigator.of(sheetContext).pop();
            if (!mounted) return;
            await _refresh();
            if (!mounted) return;
            _openCommunity(community);
          } catch (error) {
            if (sheetContext.mounted) {
              ScaffoldMessenger.of(
                sheetContext,
              ).showSnackBar(SnackBar(content: Text(_errorMessage(error))));
            }
          }
        },
      ),
    );
  }

  Future<void> _openGroupLinkJoin() async {
    final controller = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Join with group link'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Group code or link',
            prefixIcon: Icon(Icons.link_rounded),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text),
            child: const Text('Join'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (code == null || code.trim().isEmpty) return;
    final normalized = code
        .trim()
        .split('/')
        .where((part) => part.isNotEmpty)
        .last;
    try {
      final groupId = await _dataSource.joinViaInvite(normalized);
      await _refresh();
      if (!mounted) return;
      final community = (await _dataSource.fetchCommunity(groupId));
      if (community != null && mounted) _openCommunity(community);
    } catch (error) {
      if (mounted) _toast(_errorMessage(error));
    }
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
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
              child: Row(
                children: [
                  if (widget.onBack != null)
                    IconButton(
                      tooltip: 'Back',
                      onPressed: widget.onBack,
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                  const Expanded(
                    child: Text(
                      'Communities',
                      style: TextStyle(
                        color: GroupColors.foreground,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Join with group link',
                    onPressed: _openGroupLinkJoin,
                    icon: const Icon(Icons.link_rounded),
                  ),
                  IconButton.filled(
                    tooltip: 'Create community',
                    onPressed: _openCreate,
                    icon: const Icon(Icons.add_rounded),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: TextField(
                controller: _searchController,
                decoration: const InputDecoration(
                  hintText: 'Search communities',
                  prefixIcon: Icon(Icons.search_rounded),
                  isDense: true,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SizedBox(
                width: double.infinity,
                child: SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(
                      value: 0,
                      icon: Icon(Icons.forum_outlined),
                      label: Text('My communities'),
                    ),
                    ButtonSegment(
                      value: 1,
                      icon: Icon(Icons.explore_outlined),
                      label: Text('Discover'),
                    ),
                  ],
                  selected: {_segment},
                  onSelectionChanged: (values) {
                    setState(() => _segment = values.first);
                  },
                ),
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: FutureBuilder<List<CommunitySummary>>(
                  future: _communitiesFuture,
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    final query = _searchController.text.trim().toLowerCase();
                    final communities = snapshot.data!
                        .where(
                          (community) => (_segment == 0
                              ? community.isMember
                              : !community.isMember),
                        )
                        .where(
                          (community) =>
                              query.isEmpty ||
                              community.name.toLowerCase().contains(query) ||
                              community.description.toLowerCase().contains(
                                query,
                              ),
                        )
                        .toList();
                    if (communities.isEmpty) {
                      return ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                            height: MediaQuery.of(context).size.height * 0.18,
                          ),
                          Icon(
                            _segment == 0
                                ? Icons.groups_2_outlined
                                : Icons.travel_explore_rounded,
                            size: 54,
                            color: GroupColors.mutedForeground,
                          ),
                          const SizedBox(height: 14),
                          Text(
                            _segment == 0
                                ? 'You have not joined a community yet.'
                                : 'No communities match this search.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: GroupColors.mutedForeground,
                            ),
                          ),
                        ],
                      );
                    }
                    return ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
                      itemCount: communities.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) => _CommunityTile(
                        community: communities[index],
                        onTap: () => _openCommunity(communities[index]),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommunityTile extends StatelessWidget {
  const _CommunityTile({required this.community, required this.onTap});

  final CommunitySummary community;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: GroupColors.rowCard,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 27,
                backgroundImage: community.avatarUrl?.isNotEmpty == true
                    ? NetworkImage(community.avatarUrl!)
                    : null,
                child: community.avatarUrl?.isNotEmpty == true
                    ? null
                    : Text(
                        community.name.trim().isEmpty
                            ? 'C'
                            : community.name.characters.first.toUpperCase(),
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            community.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: GroupColors.foreground,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Icon(
                          community.isPrivate
                              ? Icons.lock_outline_rounded
                              : Icons.public_rounded,
                          size: 15,
                          color: GroupColors.mutedForeground,
                        ),
                        if (community.isPremium) ...[
                          const SizedBox(width: 5),
                          const Icon(
                            Icons.workspace_premium_outlined,
                            size: 16,
                            color: Color(0xFFFFC24A),
                          ),
                        ],
                      ],
                    ),
                    if (community.description.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        community.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: GroupColors.mutedForeground,
                          fontSize: 13,
                        ),
                      ),
                    ],
                    const SizedBox(height: 7),
                    Text(
                      '${community.memberCount} members'
                      '${community.joinRequestPending ? '  •  Request pending' : ''}',
                      style: const TextStyle(
                        color: GroupColors.mutedForeground,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}

String _errorMessage(Object error) {
  final message = error.toString().replaceFirst(
    'PostgrestException(message: ',
    '',
  );
  if (message.contains('PREMIUM_REQUIRED') ||
      message.contains('premium subscription')) {
    return 'Premium is required to create a community. Subscribe from Wallet and try again.';
  }
  if (message.contains('INVALID') || message.contains('invalid')) {
    return 'This group link is invalid.';
  }
  return 'Could not complete that community action.';
}
