import 'package:flutter/material.dart';

import '../data/groups_remote_data_source.dart';
import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import '../widgets/create_group_sheet.dart';
import '../widgets/group_list_tile.dart';
import 'group_chat_screen.dart';

/// Public entry point for the groups / message-rooms feature.
///
/// Lists the group conversations the current user is in, lets them create a new
/// group (name + members), and opens the group room. This is the ONE public
/// screen the host wires into navigation (e.g. a "Groups" entry reachable from
/// the Messages/Chats surface).
///
/// The only required dependency is the current user's id (to compute "isMine"
/// on messages and exclude self from member lists). The Supabase-backed
/// [GroupsRemoteDataSource] self-detects configuration via [autoDetect] when
/// not supplied, so the host can construct this with just an id.
class GroupsScreen extends StatefulWidget {
  const GroupsScreen({
    super.key,
    required this.currentUserId,
    this.dataSource,
    this.onBack,
    this.onGoLive,
  });

  /// The signed-in user's id (matches `messages.sender_id` /
  /// `conversation_participants.user_id`).
  final String currentUserId;

  /// Optional injected data source; defaults to [GroupsRemoteDataSource.autoDetect].
  final GroupsRemoteDataSource? dataSource;

  /// Optional back affordance. When null, no back button is shown (the screen
  /// is assumed to be a tab). When provided, a back button is rendered.
  final VoidCallback? onBack;

  /// Optional "Go Live from group" handler, forwarded to each opened
  /// [GroupChatScreen]. When provided, group rooms surface a "Go Live" action
  /// that calls back with the group's conversation id + title so the coordinator
  /// can start a group-scoped livestream (this module does not depend on
  /// features/live). When null, the affordance is hidden. Additive — the
  /// existing public constructor is unchanged.
  final GroupGoLiveCallback? onGoLive;

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  late final GroupsRemoteDataSource _dataSource;
  late Future<List<GroupListItemView>> _groupsFuture;

  @override
  void initState() {
    super.initState();
    _dataSource = widget.dataSource ?? GroupsRemoteDataSource.autoDetect();
    _groupsFuture = _loadGroups();
  }

  Future<List<GroupListItemView>> _loadGroups() async {
    final remote = await _dataSource.fetchGroups();
    return remote.map(groupToListItem).toList();
  }

  void _refresh() {
    setState(() => _groupsFuture = _loadGroups());
  }

  void _openGroup(GroupListItemView group) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => GroupChatScreen(
          dataSource: _dataSource,
          conversationId: group.conversationId,
          currentUserId: widget.currentUserId,
          initialTitle: group.title,
          initialMemberCount: group.memberCount,
          onBack: () => Navigator.of(context).pop(),
          onGoLive: widget.onGoLive,
          onLeft: () {
            Navigator.of(context).pop();
            _refresh();
          },
        ),
      ),
    ).then((_) => _refresh());
  }

  void _openCreateGroup() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: GroupColors.barrier,
      builder: (sheetContext) => CreateGroupSheet(
        dataSource: _dataSource,
        onCreate: (result) async {
          Navigator.of(sheetContext).pop();
          final conversationId = await _dataSource.createGroup(
            memberIds: result.memberIds,
            name: result.name,
          );
          if (!mounted) return;
          if (conversationId == null) {
            _toast('Could not create the group. Try again.');
            return;
          }
          _refresh();
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => GroupChatScreen(
                dataSource: _dataSource,
                conversationId: conversationId,
                currentUserId: widget.currentUserId,
                initialTitle: result.name,
                // creator + selected members.
                initialMemberCount: result.memberIds.length + 1,
                onBack: () => Navigator.of(context).pop(),
                onGoLive: widget.onGoLive,
                onLeft: () {
                  Navigator.of(context).pop();
                  _refresh();
                },
              ),
            ),
          ).then((_) => _refresh());
        },
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
    return ColoredBox(
      color: GroupColors.background,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(onBack: widget.onBack, onCreate: _openCreateGroup),
            Expanded(
              child: RefreshIndicator(
                color: GroupColors.primary,
                backgroundColor: GroupColors.card,
                onRefresh: () async => _refresh(),
                child: FutureBuilder<List<GroupListItemView>>(
                  future: _groupsFuture,
                  builder: (context, snapshot) {
                    final groups = snapshot.data;
                    if (groups == null) {
                      return const Center(
                        child: CircularProgressIndicator(
                          color: GroupColors.primary,
                        ),
                      );
                    }
                    if (groups.isEmpty) {
                      return _EmptyGroupsState(onCreate: _openCreateGroup);
                    }
                    return ListView.builder(
                      padding: const EdgeInsets.only(
                        top: GroupSpacing.xs,
                        bottom: GroupSpacing.xl,
                      ),
                      itemCount: groups.length,
                      itemBuilder: (context, index) {
                        final group = groups[index];
                        return GroupListTile(
                          group: group,
                          onTap: () => _openGroup(group),
                        );
                      },
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

class _Header extends StatelessWidget {
  const _Header({required this.onCreate, this.onBack});

  final VoidCallback onCreate;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GroupSpacing.lg,
        GroupSpacing.md,
        GroupSpacing.sm,
        GroupSpacing.sm,
      ),
      child: Row(
        children: [
          if (onBack != null)
            Padding(
              padding: const EdgeInsets.only(right: GroupSpacing.xs),
              child: IconButton(
                onPressed: onBack,
                tooltip: 'Back',
                icon: const Icon(
                  Icons.arrow_back,
                  color: GroupColors.foreground,
                ),
              ),
            ),
          const Expanded(
            child: Text(
              'Groups',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
                color: GroupColors.foreground,
              ),
            ),
          ),
          DecoratedBox(
            decoration: const BoxDecoration(
              gradient: GroupGradients.sendAction,
              shape: BoxShape.circle,
              boxShadow: GroupShadows.pink,
            ),
            child: IconButton(
              tooltip: 'New group',
              onPressed: onCreate,
              icon: const Icon(
                Icons.group_add_outlined,
                color: GroupColors.primaryForeground,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyGroupsState extends StatelessWidget {
  const _EmptyGroupsState({required this.onCreate});

  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    // Wrapped in a scroll view so RefreshIndicator can pull even when empty.
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Center(
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
                          Icons.groups_2_rounded,
                          size: 28,
                          color: GroupColors.primaryForeground,
                        ),
                      ),
                    ),
                    const SizedBox(height: GroupSpacing.lg),
                    const Text(
                      'No groups yet',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        color: GroupColors.foreground,
                      ),
                    ),
                    const SizedBox(height: GroupSpacing.sm),
                    const Text(
                      'Create a group to chat with several people at once.',
                      textAlign: TextAlign.center,
                      style: GroupTextStyles.previewMuted,
                    ),
                    const SizedBox(height: GroupSpacing.lg),
                    _CreateButton(onTap: onCreate),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CreateButton extends StatelessWidget {
  const _CreateButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(GroupRadii.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(GroupRadii.md),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: GroupSpacing.xl,
            vertical: GroupSpacing.md,
          ),
          decoration: BoxDecoration(
            gradient: GroupGradients.sendAction,
            borderRadius: BorderRadius.circular(GroupRadii.md),
            boxShadow: GroupShadows.pink,
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.group_add_outlined,
                size: 18,
                color: GroupColors.primaryForeground,
              ),
              SizedBox(width: GroupSpacing.sm),
              Text(
                'New group',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: GroupColors.primaryForeground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
