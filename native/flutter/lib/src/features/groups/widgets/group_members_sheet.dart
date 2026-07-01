import 'package:flutter/material.dart';

import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import 'group_avatar.dart';

/// Bottom sheet listing a group's members. Mirrors the web `GroupMembersSheet`:
/// a "{n} Members · {m} online" header, a search field, and a role-sorted list
/// with presence dots and owner/member badges. Purely presentational — the host
/// owns the roster, loading state and the "add members" action.
class GroupMembersSheet extends StatefulWidget {
  const GroupMembersSheet({
    super.key,
    required this.members,
    required this.isLoading,
    this.onAddMembers,
    this.onLeave,
  });

  final List<GroupMemberView> members;
  final bool isLoading;
  final VoidCallback? onAddMembers;
  final VoidCallback? onLeave;

  @override
  State<GroupMembersSheet> createState() => _GroupMembersSheetState();
}

class _GroupMembersSheetState extends State<GroupMembersSheet> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  int get _onlineCount => widget.members
      .where((m) => groupPresenceShowsDot(m.presence))
      .length;

  List<GroupMemberView> get _filtered {
    final q = _query.trim().toLowerCase();
    final list = q.isEmpty
        ? [...widget.members]
        : widget.members
              .where((m) => m.displayName.toLowerCase().contains(q))
              .toList();
    // Owner first, then members; stable within groups.
    list.sort((a, b) {
      final ar = a.role == GroupRole.owner ? 0 : 1;
      final br = b.role == GroupRole.owner ? 0 : 1;
      return ar.compareTo(br);
    });
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final members = _filtered;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: FractionallySizedBox(
        heightFactor: 0.85,
        child: Container(
          decoration: const BoxDecoration(
            color: GroupColors.card,
            borderRadius: GroupRadii.sheetTop,
          ),
          child: Column(
            children: [
              const SizedBox(height: GroupSpacing.sm),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GroupColors.border,
                  borderRadius: BorderRadius.circular(GroupRadii.pill),
                ),
              ),
              _header(),
              _search(),
              Expanded(
                child: widget.isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: GroupColors.primary,
                        ),
                      )
                    : members.isEmpty
                    ? _empty()
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(
                          horizontal: GroupSpacing.sm,
                          vertical: GroupSpacing.xs,
                        ),
                        itemCount: members.length,
                        itemBuilder: (context, index) =>
                            _MemberRow(member: members[index]),
                      ),
              ),
              if (widget.onLeave != null) _leaveFooter(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GroupSpacing.lg,
        GroupSpacing.md,
        GroupSpacing.sm,
        GroupSpacing.sm,
      ),
      child: Row(
        children: [
          Expanded(
            child: RichText(
              text: TextSpan(
                text: '${widget.members.length} Members',
                style: GroupTextStyles.headerName,
                children: [
                  if (_onlineCount > 0)
                    TextSpan(
                      text: '  ·  $_onlineCount online',
                      style: GroupTextStyles.subtitle,
                    ),
                ],
              ),
            ),
          ),
          if (widget.onAddMembers != null)
            IconButton(
              tooltip: 'Add members',
              onPressed: widget.onAddMembers,
              icon: const Icon(
                Icons.person_add_alt_1,
                color: GroupColors.primary,
              ),
            ),
        ],
      ),
    );
  }

  Widget _search() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GroupSpacing.lg,
        0,
        GroupSpacing.lg,
        GroupSpacing.sm,
      ),
      child: TextField(
        controller: _searchController,
        onChanged: (value) => setState(() => _query = value),
        style: const TextStyle(fontSize: 15, color: GroupColors.foreground),
        cursorColor: GroupColors.primary,
        decoration: InputDecoration(
          isDense: true,
          filled: true,
          fillColor: GroupColors.input,
          hintText: 'Search members…',
          hintStyle: const TextStyle(
            fontSize: 15,
            color: GroupColors.mutedForeground,
          ),
          prefixIcon: const Icon(
            Icons.search,
            size: 20,
            color: GroupColors.mutedForeground,
          ),
          contentPadding: const EdgeInsets.symmetric(
            vertical: GroupSpacing.md,
            horizontal: GroupSpacing.md,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(GroupRadii.md),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  Widget _empty() {
    return Center(
      child: Text(
        _query.isEmpty ? 'No members' : 'No members match "$_query"',
        style: GroupTextStyles.previewMuted,
      ),
    );
  }

  Widget _leaveFooter() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(GroupSpacing.lg),
        child: SizedBox(
          width: double.infinity,
          child: TextButton.icon(
            onPressed: widget.onLeave,
            style: TextButton.styleFrom(
              foregroundColor: GroupColors.destructive,
              padding: const EdgeInsets.symmetric(vertical: GroupSpacing.md),
            ),
            icon: const Icon(Icons.logout, size: 18),
            label: const Text(
              'Leave group',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({required this.member});

  final GroupMemberView member;

  Color get _presenceColor {
    switch (member.presence) {
      case GroupPresence.online:
        return GroupColors.online;
      case GroupPresence.activeNow:
        return GroupColors.activeNow;
      case GroupPresence.away:
      case GroupPresence.offline:
        return GroupColors.mutedForeground;
    }
  }

  @override
  Widget build(BuildContext context) {
    final showDot = groupPresenceShowsDot(member.presence);
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: GroupSpacing.sm,
        vertical: GroupSpacing.sm,
      ),
      child: Row(
        children: [
          GroupAvatar(
            initial: member.initial,
            avatarUrl: member.avatarUrl,
            size: GroupSpacing.avatarMd,
            showPresenceDot: showDot,
            presenceColor: _presenceColor,
          ),
          const SizedBox(width: GroupSpacing.md),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        member.isMe
                            ? '${member.displayName} (You)'
                            : member.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GroupTextStyles.groupName,
                      ),
                    ),
                    if (member.role == GroupRole.owner) ...[
                      const SizedBox(width: GroupSpacing.xs),
                      const _RoleBadge(),
                    ],
                  ],
                ),
                if (member.username != null && member.username!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    '@${member.username}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GroupTextStyles.previewMuted,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  const _RoleBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: GroupColors.ownerBadgeBg,
        borderRadius: BorderRadius.circular(GroupRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.workspace_premium,
            size: 12,
            color: GroupColors.ownerBadge,
          ),
          const SizedBox(width: 3),
          Text(
            'Owner',
            style: GroupTextStyles.roleBadge.copyWith(
              color: GroupColors.ownerBadge,
            ),
          ),
        ],
      ),
    );
  }
}
