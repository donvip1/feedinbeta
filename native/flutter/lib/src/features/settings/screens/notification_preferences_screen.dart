import 'dart:async';

import 'package:flutter/material.dart';

import '../data/notification_preferences_data_source.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// One toggle row's static metadata (SQL key + copy + icon).
class _PrefRow {
  const _PrefRow(this.key, this.icon, this.title, this.description);
  final String key;
  final IconData icon;
  final String title;
  final String description;
}

class _PrefGroup {
  const _PrefGroup(this.title, this.rows);
  final String title;
  final List<_PrefRow> rows;
}

/// Per-type notification preferences, backed by the live
/// `notification_preferences` table. Ports src/pages/NotificationSettings.tsx
/// (push master toggle, enable/disable all, grouped per-type switches, email).
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key, this.dataSource});

  final NotificationPreferencesDataSource? dataSource;

  @override
  State<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends State<NotificationPreferencesScreen> {
  late final NotificationPreferencesDataSource _source;
  NotificationPreferences _prefs = NotificationPreferences.defaults;
  bool _loading = true;

  static const _groups = <_PrefGroup>[
    _PrefGroup('Social', [
      _PrefRow('likes_enabled', Icons.favorite_outline, 'Likes',
          'When someone likes your posts or comments'),
      _PrefRow('comments_enabled', Icons.mode_comment_outlined,
          'Comments & mentions', 'Comments on your posts and mentions'),
      _PrefRow('follows_enabled', Icons.group_outlined, 'New followers',
          'When someone follows you'),
    ]),
    _PrefGroup('Messages & friends', [
      _PrefRow('messages_enabled', Icons.chat_bubble_outline,
          'Direct messages', 'When you receive new messages'),
      _PrefRow('friend_requests_enabled', Icons.person_add_alt,
          'Friend requests', 'New friend requests and acceptances'),
    ]),
    _PrefGroup('Content', [
      _PrefRow('replies_enabled', Icons.reply_outlined, 'Replies',
          'Replies to your comments'),
      _PrefRow('stories_enabled', Icons.auto_awesome_outlined, 'Stories',
          'Story replies and reactions'),
      _PrefRow('badges_enabled', Icons.workspace_premium_outlined, 'Badges',
          'When you earn a new badge'),
    ]),
  ];

  @override
  void initState() {
    super.initState();
    _source = widget.dataSource ??
        NotificationPreferencesDataSource.autoDetect();
    _load();
  }

  Future<void> _load() async {
    final prefs = await _source.load();
    if (!mounted) return;
    setState(() {
      _prefs = prefs;
      _loading = false;
    });
  }

  Future<void> _persist(NotificationPreferences next) async {
    setState(() => _prefs = next);
    await _source.save(next);
  }

  void _setKey(String key, bool value) {
    unawaited(_persist(_prefs.copyWithKey(key, value)));
  }

  void _setAll(bool value) {
    var next = _prefs;
    for (final group in _groups) {
      for (final row in group.rows) {
        next = next.copyWithKey(row.key, value);
      }
    }
    unawaited(_persist(next));
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSubScaffold(
      title: 'Notifications',
      icon: Icons.notifications_none,
      accent: SettingsColors.primary,
      children: [
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: SettingsSpacing.xl),
            child: LinearProgressIndicator(
              color: SettingsColors.primary,
              backgroundColor: SettingsColors.muted,
            ),
          )
        else ...[
          SettingsCard(
            icon: _prefs.pushEnabled
                ? Icons.notifications_active_outlined
                : Icons.notifications_off_outlined,
            title: 'Push notifications',
            description: 'Get notified about activity even when you\'re away.',
            children: [
              const SettingsDivider(),
              SettingsToggleRow(
                icon: Icons.smartphone,
                title: 'Enable push',
                description: 'Master switch for all push alerts',
                value: _prefs.pushEnabled,
                onChanged: (v) => _setKey('push_enabled', v),
              ),
              const SettingsDivider(),
              Padding(
                padding: const EdgeInsets.all(SettingsSpacing.lg),
                child: Row(
                  children: [
                    Expanded(
                      child: SettingsActionButton(
                        label: 'Enable all',
                        icon: Icons.done_all,
                        expanded: true,
                        onPressed: () => _setAll(true),
                      ),
                    ),
                    const SizedBox(width: SettingsSpacing.sm),
                    Expanded(
                      child: SettingsActionButton(
                        label: 'Disable all',
                        icon: Icons.remove_done,
                        expanded: true,
                        onPressed: () => _setAll(false),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          for (final group in _groups) ...[
            const SizedBox(height: SettingsSpacing.lg),
            SettingsCard(
              icon: Icons.tune,
              title: group.title,
              children: [
                for (var i = 0; i < group.rows.length; i++) ...[
                  const SettingsDivider(),
                  SettingsToggleRow(
                    icon: group.rows[i].icon,
                    title: group.rows[i].title,
                    description: group.rows[i].description,
                    value: _prefs.valueOf(group.rows[i].key),
                    onChanged: (v) => _setKey(group.rows[i].key, v),
                  ),
                ],
              ],
            ),
          ],
          const SizedBox(height: SettingsSpacing.lg),
          SettingsCard(
            icon: Icons.mail_outline,
            title: 'Email',
            children: [
              const SettingsDivider(),
              SettingsToggleRow(
                icon: Icons.mail_outline,
                title: 'Email notifications',
                description: 'Receive important updates via email',
                value: _prefs.emailEnabled,
                onChanged: (v) => _setKey('email_enabled', v),
              ),
            ],
          ),
          const SizedBox(height: SettingsSpacing.lg),
          SettingsStatusBanner(
            icon: _source.isLive ? Icons.cloud_done_outlined : Icons.cloud_off,
            message: _source.isLive
                ? 'Saved to your account and synced across devices.'
                : 'Sign in to sync notification preferences to your account.',
            tone: _source.isLive
                ? SettingsBannerTone.online
                : SettingsBannerTone.offline,
          ),
        ],
      ],
    );
  }
}
