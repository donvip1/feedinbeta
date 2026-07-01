import 'dart:async';

import 'package:flutter/material.dart';

import '../data/blocked_users_data_source.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Blocked & muted users list with unblock / unmute actions.
/// Ports src/pages/BlockedUsers.tsx (Blocked / Muted tabs).
///
/// The backing `blocked_users` / `muted_users` tables are not part of the
/// native schema yet — [BlockedUsersDataSource] returns an "unavailable" result
/// in that case and this screen shows an explanatory empty state.
class BlockedUsersScreen extends StatefulWidget {
  const BlockedUsersScreen({super.key, this.dataSource});

  final BlockedUsersDataSource? dataSource;

  @override
  State<BlockedUsersScreen> createState() => _BlockedUsersScreenState();
}

class _BlockedUsersScreenState extends State<BlockedUsersScreen> {
  late final BlockedUsersDataSource _source;
  bool _loading = true;
  ModeratedListResult _blocked = const ModeratedListResult.unavailable();
  ModeratedListResult _muted = const ModeratedListResult.unavailable();
  final _busyRows = <String>{};

  @override
  void initState() {
    super.initState();
    _source = widget.dataSource ?? BlockedUsersDataSource.autoDetect();
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait([
      _source.fetchBlocked(),
      _source.fetchMuted(),
    ]);
    if (!mounted) return;
    setState(() {
      _blocked = results[0];
      _muted = results[1];
      _loading = false;
    });
  }

  Future<void> _unblock(ModeratedUser user) async {
    setState(() => _busyRows.add(user.rowId));
    final ok = await _source.unblock(user.rowId);
    if (!mounted) return;
    setState(() {
      _busyRows.remove(user.rowId);
      if (ok) {
        _blocked = ModeratedListResult(
          available: true,
          users: _blocked.users.where((u) => u.rowId != user.rowId).toList(),
        );
      }
    });
  }

  Future<void> _unmute(ModeratedUser user) async {
    setState(() => _busyRows.add(user.rowId));
    final ok = await _source.unmute(user.rowId);
    if (!mounted) return;
    setState(() {
      _busyRows.remove(user.rowId);
      if (ok) {
        _muted = ModeratedListResult(
          available: true,
          users: _muted.users.where((u) => u.rowId != user.rowId).toList(),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: SettingsSubScaffold(
        title: 'Blocked & muted',
        icon: Icons.person_off_outlined,
        accent: SettingsColors.destructive,
        children: [
          Container(
            decoration: BoxDecoration(
              color: SettingsColors.card,
              borderRadius: SettingsRadii.card,
              border: Border.all(color: SettingsColors.border),
            ),
            child: const TabBar(
              indicatorColor: SettingsColors.primary,
              labelColor: SettingsColors.foreground,
              unselectedLabelColor: SettingsColors.mutedForeground,
              tabs: [
                Tab(text: 'Blocked'),
                Tab(text: 'Muted'),
              ],
            ),
          ),
          const SizedBox(height: SettingsSpacing.lg),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: SettingsSpacing.xl),
              child: LinearProgressIndicator(
                color: SettingsColors.primary,
                backgroundColor: SettingsColors.muted,
              ),
            )
          else
            SizedBox(
              height: 420,
              child: TabBarView(
                children: [
                  _buildList(
                    result: _blocked,
                    emptyIcon: Icons.person_off_outlined,
                    emptyLabel: 'No blocked users',
                    actionLabel: 'Unblock',
                    onAction: _unblock,
                  ),
                  _buildList(
                    result: _muted,
                    emptyIcon: Icons.volume_off_outlined,
                    emptyLabel: 'No muted users',
                    actionLabel: 'Unmute',
                    onAction: _unmute,
                    showExpiry: true,
                  ),
                ],
              ),
            ),
          const SizedBox(height: SettingsSpacing.lg),
          const SettingsStatusBanner(
            icon: Icons.info_outline,
            message:
                'Blocked users can\'t see your profile or contact you. Muted '
                'users can still interact, but you won\'t get their alerts.',
            tone: SettingsBannerTone.neutral,
          ),
        ],
      ),
    );
  }

  Widget _buildList({
    required ModeratedListResult result,
    required IconData emptyIcon,
    required String emptyLabel,
    required String actionLabel,
    required Future<void> Function(ModeratedUser) onAction,
    bool showExpiry = false,
  }) {
    if (!result.available) {
      return _EmptyState(
        icon: Icons.cloud_off_outlined,
        label: 'Block list unavailable',
        detail:
            'The blocked_users / muted_users tables aren\'t in the native '
            'schema yet.',
      );
    }
    if (result.users.isEmpty) {
      return _EmptyState(icon: emptyIcon, label: emptyLabel);
    }

    return Container(
      decoration: BoxDecoration(
        color: SettingsColors.card,
        borderRadius: SettingsRadii.card,
        border: Border.all(color: SettingsColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: ListView.separated(
        padding: EdgeInsets.zero,
        itemCount: result.users.length,
        separatorBuilder: (_, __) => const SettingsDivider(),
        itemBuilder: (context, index) {
          final user = result.users[index];
          return SettingsPersonRow(
            displayName: user.displayName ?? 'Unknown user',
            username: user.username ?? 'user',
            avatarUrl: user.avatarUrl,
            subtitle: showExpiry && user.expiresAt != null
                ? 'Expires ${user.expiresAt!.toLocal().toString().split(' ').first}'
                : null,
            actionLabel: actionLabel,
            busy: _busyRows.contains(user.rowId),
            onAction: () => unawaited(onAction(user)),
          );
        },
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.label, this.detail});

  final IconData icon;
  final String label;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SettingsSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: SettingsColors.mutedForeground),
            const SizedBox(height: SettingsSpacing.md),
            Text(label, style: SettingsTextStyles.rowTitle),
            if (detail != null) ...[
              const SizedBox(height: SettingsSpacing.xs),
              Text(
                detail!,
                textAlign: TextAlign.center,
                style: SettingsTextStyles.rowDescription,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
