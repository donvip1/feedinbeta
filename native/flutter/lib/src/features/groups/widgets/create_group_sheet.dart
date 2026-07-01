import 'dart:async';

import 'package:flutter/material.dart';

import '../data/groups_remote_data_source.dart';
import '../groups_theme.dart';
import '../view_models/group_view_models.dart';
import 'group_avatar.dart';

/// Result of the create-group flow: the chosen name + selected member ids.
class CreateGroupResult {
  const CreateGroupResult({required this.name, required this.memberIds});

  final String name;
  final List<String> memberIds;
}

/// Bottom sheet for creating a group. Mirrors the web `CreateGroupModal` (name
/// field) fused with a member picker: a debounced user search, tappable results
/// that toggle selection, a selected-members chip strip, and a Create button
/// enabled once a name + at least two members are chosen (a "group" needs the
/// creator + 2 others).
///
/// This widget owns its search state and calls [dataSource].searchCandidates
/// directly; it returns a [CreateGroupResult] via [onCreate] and never performs
/// the creation itself (the screen does, so it can navigate into the new room).
class CreateGroupSheet extends StatefulWidget {
  const CreateGroupSheet({
    super.key,
    required this.dataSource,
    required this.onCreate,
  });

  final GroupsRemoteDataSource dataSource;
  final void Function(CreateGroupResult result) onCreate;

  @override
  State<CreateGroupSheet> createState() => _CreateGroupSheetState();
}

class _CreateGroupSheetState extends State<CreateGroupSheet> {
  static const Duration _debounce = Duration(milliseconds: 300);

  final _nameController = TextEditingController();
  final _searchController = TextEditingController();
  Timer? _debounceTimer;
  int _requestToken = 0;

  bool _isSearching = false;
  List<GroupCandidateView> _results = const [];
  final Map<String, GroupCandidateView> _selected = {};
  bool _submitting = false;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _nameController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  bool get _canCreate =>
      !_submitting &&
      _nameController.text.trim().isNotEmpty &&
      _selected.length >= 2;

  void _onQueryChanged(String raw) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_debounce, () => _runSearch(raw));
  }

  Future<void> _runSearch(String raw) async {
    final query = raw.trim();
    if (query.length < 2) {
      setState(() {
        _results = const [];
        _isSearching = false;
      });
      return;
    }
    final token = ++_requestToken;
    setState(() => _isSearching = true);
    final remote = await widget.dataSource.searchCandidates(query);
    if (!mounted || token != _requestToken) return;
    setState(() {
      _results = remote.map(candidateToView).toList();
      _isSearching = false;
    });
  }

  void _toggle(GroupCandidateView candidate) {
    setState(() {
      if (_selected.containsKey(candidate.userId)) {
        _selected.remove(candidate.userId);
      } else {
        _selected[candidate.userId] = candidate;
      }
    });
  }

  Future<void> _submit() async {
    if (!_canCreate) return;
    setState(() => _submitting = true);
    widget.onCreate(
      CreateGroupResult(
        name: _nameController.text.trim(),
        memberIds: _selected.keys.toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: FractionallySizedBox(
        heightFactor: 0.9,
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
              _nameField(),
              if (_selected.isNotEmpty) _selectedStrip(),
              _searchField(),
              Expanded(child: _resultsList()),
              _createButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return const Padding(
      padding: EdgeInsets.fromLTRB(
        GroupSpacing.lg,
        GroupSpacing.md,
        GroupSpacing.lg,
        GroupSpacing.sm,
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text('New group', style: GroupTextStyles.headerName),
      ),
    );
  }

  Widget _nameField() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GroupSpacing.lg,
        0,
        GroupSpacing.lg,
        GroupSpacing.sm,
      ),
      child: TextField(
        controller: _nameController,
        onChanged: (_) => setState(() {}),
        textCapitalization: TextCapitalization.words,
        style: const TextStyle(fontSize: 15, color: GroupColors.foreground),
        cursorColor: GroupColors.primary,
        decoration: _fieldDecoration(
          hint: 'Group name',
          icon: Icons.groups_outlined,
        ),
      ),
    );
  }

  Widget _searchField() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GroupSpacing.lg,
        GroupSpacing.xs,
        GroupSpacing.lg,
        GroupSpacing.sm,
      ),
      child: TextField(
        controller: _searchController,
        onChanged: _onQueryChanged,
        autocorrect: false,
        enableSuggestions: false,
        style: const TextStyle(fontSize: 15, color: GroupColors.foreground),
        cursorColor: GroupColors.primary,
        decoration: _fieldDecoration(
          hint: 'Add members by username…',
          icon: Icons.search,
        ),
      ),
    );
  }

  InputDecoration _fieldDecoration({
    required String hint,
    required IconData icon,
  }) {
    return InputDecoration(
      isDense: true,
      filled: true,
      fillColor: GroupColors.input,
      hintText: hint,
      hintStyle: const TextStyle(
        fontSize: 15,
        color: GroupColors.mutedForeground,
      ),
      prefixIcon: Icon(icon, size: 20, color: GroupColors.mutedForeground),
      contentPadding: const EdgeInsets.symmetric(
        vertical: GroupSpacing.md,
        horizontal: GroupSpacing.md,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GroupRadii.md),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GroupRadii.md),
        borderSide: const BorderSide(color: GroupColors.primary, width: 1.5),
      ),
    );
  }

  Widget _selectedStrip() {
    final selected = _selected.values.toList();
    return SizedBox(
      height: 84,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: GroupSpacing.lg,
          vertical: GroupSpacing.xs,
        ),
        itemCount: selected.length,
        separatorBuilder: (_, __) => const SizedBox(width: GroupSpacing.md),
        itemBuilder: (context, index) {
          final c = selected[index];
          return SizedBox(
            width: 56,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    GroupAvatar(
                      initial: c.initial,
                      avatarUrl: c.avatarUrl,
                      size: GroupSpacing.avatarMd,
                    ),
                    Positioned(
                      right: -2,
                      top: -2,
                      child: GestureDetector(
                        onTap: () => _toggle(c),
                        child: Container(
                          width: 18,
                          height: 18,
                          decoration: const BoxDecoration(
                            color: GroupColors.destructive,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close,
                            size: 12,
                            color: GroupColors.primaryForeground,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  c.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GroupTextStyles.timestamp,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _resultsList() {
    if (_isSearching) {
      return const Center(
        child: CircularProgressIndicator(color: GroupColors.primary),
      );
    }
    if (_results.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(GroupSpacing.xl),
          child: Text(
            _searchController.text.trim().length < 2
                ? 'Search for people to add to the group.'
                : 'No users found.',
            textAlign: TextAlign.center,
            style: GroupTextStyles.previewMuted,
          ),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(
        horizontal: GroupSpacing.sm,
        vertical: GroupSpacing.xs,
      ),
      itemCount: _results.length,
      itemBuilder: (context, index) {
        final candidate = _results[index];
        final selected = _selected.containsKey(candidate.userId);
        return _CandidateRow(
          candidate: candidate,
          selected: selected,
          onTap: () => _toggle(candidate),
        );
      },
    );
  }

  Widget _createButton() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(GroupSpacing.lg),
        child: SizedBox(
          width: double.infinity,
          height: GroupSpacing.tapTarget,
          child: Opacity(
            opacity: _canCreate ? 1 : 0.5,
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(GroupRadii.md),
              child: InkWell(
                onTap: _canCreate ? _submit : null,
                borderRadius: BorderRadius.circular(GroupRadii.md),
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: GroupGradients.sendAction,
                    borderRadius: BorderRadius.circular(GroupRadii.md),
                    boxShadow: _canCreate ? GroupShadows.pink : null,
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              GroupColors.primaryForeground,
                            ),
                          ),
                        )
                      : Text(
                          _selected.length < 2
                              ? 'Add at least 2 members'
                              : 'Create group (${_selected.length})',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: GroupColors.primaryForeground,
                          ),
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CandidateRow extends StatelessWidget {
  const _CandidateRow({
    required this.candidate,
    required this.selected,
    required this.onTap,
  });

  final GroupCandidateView candidate;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(GroupRadii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GroupSpacing.md,
            vertical: GroupSpacing.sm,
          ),
          child: Row(
            children: [
              GroupAvatar(
                initial: candidate.initial,
                avatarUrl: candidate.avatarUrl,
                size: GroupSpacing.avatarMd,
              ),
              const SizedBox(width: GroupSpacing.md),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      candidate.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GroupTextStyles.groupName,
                    ),
                    if (candidate.username != null &&
                        candidate.username!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        '@${candidate.username}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GroupTextStyles.previewMuted,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: GroupSpacing.sm),
              _Checkbox(selected: selected),
            ],
          ),
        ),
      ),
    );
  }
}

class _Checkbox extends StatelessWidget {
  const _Checkbox({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 24,
      height: 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: selected ? GroupColors.primary : Colors.transparent,
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? GroupColors.primary : GroupColors.border,
          width: 2,
        ),
      ),
      child: selected
          ? const Icon(
              Icons.check,
              size: 15,
              color: GroupColors.primaryForeground,
            )
          : null,
    );
  }
}
