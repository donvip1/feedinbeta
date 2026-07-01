import 'dart:async';

import 'package:flutter/material.dart';

import '../app_preferences.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Granular privacy controls: who can see your activity, message/follow you,
/// read receipts, private account. Ports src/pages/PrivacySettings.tsx.
///
/// The web app persists these to a `privacy_settings` table; that table does
/// NOT exist in the native schema yet, so these toggles are stored LOCALLY in
/// [AppPreferences] via the existing preferences repository (passed down as
/// [preferences] + [onChanged]). A banner flags the local-only status.
class PrivacySettingsScreen extends StatefulWidget {
  const PrivacySettingsScreen({
    super.key,
    required this.preferences,
    required this.onChanged,
    this.onOpenBlockedUsers,
  });

  final AppPreferences preferences;

  /// Persist a new preferences snapshot (wired to the repository upstream).
  final Future<void> Function(AppPreferences) onChanged;

  /// Navigate to the blocked/muted list (optional).
  final VoidCallback? onOpenBlockedUsers;

  @override
  State<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends State<PrivacySettingsScreen> {
  late AppPreferences _prefs = widget.preferences;

  Future<void> _update(AppPreferences next) async {
    setState(() => _prefs = next);
    await widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSubScaffold(
      title: 'Privacy',
      icon: Icons.shield_outlined,
      accent: const Color(0xFFA855F7),
      children: [
        SettingsCard(
          icon: Icons.visibility_outlined,
          title: 'Visibility',
          description: 'Control who can see you and interact with you.',
          children: [
            const SettingsDivider(),
            SettingsToggleRow(
              icon: Icons.lock_outline,
              title: 'Private account',
              description: 'Only approved followers can see your activity',
              value: _prefs.privateAccount,
              sensitive: true,
              onChanged: (v) => unawaited(
                _update(_prefs.copyWith(privateAccount: v)),
              ),
            ),
            const SettingsDivider(),
            SettingsToggleRow(
              icon: Icons.circle,
              title: 'Show online status',
              description: 'Let people see when you\'re active',
              value: _prefs.showOnlineStatus,
              onChanged: (v) => unawaited(
                _update(_prefs.copyWith(showOnlineStatus: v)),
              ),
            ),
            const SettingsDivider(),
            SettingsToggleRow(
              icon: Icons.timeline_outlined,
              title: 'Activity status',
              description: 'Show your recent activity to others',
              value: _prefs.showActivityStatus,
              onChanged: (v) => unawaited(
                _update(_prefs.copyWith(showActivityStatus: v)),
              ),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        SettingsCard(
          icon: Icons.forum_outlined,
          title: 'Interactions',
          description: 'Who can reach you and what they can see.',
          children: [
            const SettingsDivider(),
            SettingsToggleRow(
              icon: Icons.mark_chat_unread_outlined,
              title: 'Messages from non-followers',
              description: 'Let people you don\'t follow message you',
              value: _prefs.allowMessageRequests,
              onChanged: (v) => unawaited(
                _update(_prefs.copyWith(allowMessageRequests: v)),
              ),
            ),
            const SettingsDivider(),
            SettingsToggleRow(
              icon: Icons.person_add_alt,
              title: 'Allow follow requests',
              description: 'Let others request to follow you',
              value: _prefs.allowFriendRequests,
              onChanged: (v) => unawaited(
                _update(_prefs.copyWith(allowFriendRequests: v)),
              ),
            ),
            const SettingsDivider(),
            SettingsToggleRow(
              icon: Icons.done_all,
              title: 'Read receipts',
              description: 'Show when you\'ve read messages',
              value: _prefs.showReadReceipts,
              onChanged: (v) => unawaited(
                _update(_prefs.copyWith(showReadReceipts: v)),
              ),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        SettingsCard(
          icon: Icons.block,
          title: 'Blocking',
          description: 'Manage people you\'ve blocked or muted.',
          children: [
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.person_off_outlined,
              title: 'Blocked & muted users',
              description: 'Review and unblock people',
              onTap: widget.onOpenBlockedUsers ?? () {},
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        const SettingsStatusBanner(
          icon: Icons.info_outline,
          message:
              'Privacy choices are stored on this device. A shared '
              'privacy_settings table is needed to sync them across devices.',
          tone: SettingsBannerTone.neutral,
        ),
      ],
    );
  }
}
