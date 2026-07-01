import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/account_profile_data_source.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Security overview: current session, two-factor, login activity.
///
/// The native schema has no `user_sessions` / 2FA tables, and no password-reset
/// or session-revocation RPC is wired natively yet. This screen therefore shows
/// the real current session (from the Supabase auth user) and renders the
/// remaining controls as UI with an explicit "not available yet" state so the
/// parity surface is present and the gap is visible. Ports the Security /
/// Sessions entries from src/pages/Settings.tsx.
class SecuritySettingsScreen extends StatefulWidget {
  const SecuritySettingsScreen({super.key, this.dataSource});

  final AccountProfileDataSource? dataSource;

  @override
  State<SecuritySettingsScreen> createState() => _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState extends State<SecuritySettingsScreen> {
  late final AccountProfileDataSource _source;
  AccountProfile? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _source = widget.dataSource ?? AccountProfileDataSource.autoDetect();
    _load();
  }

  Future<void> _load() async {
    final profile = await _source.load();
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _loading = false;
    });
  }

  void _notAvailable(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$feature needs a backend endpoint (not wired).')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSubScaffold(
      title: 'Security',
      icon: Icons.verified_user_outlined,
      accent: const Color(0xFF06B6D4),
      children: [
        SettingsCard(
          icon: Icons.smartphone,
          title: 'This device',
          description: 'The session you\'re signed in with right now.',
          children: [
            const SettingsDivider(),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(SettingsSpacing.lg),
                child: LinearProgressIndicator(
                  color: SettingsColors.primary,
                  backgroundColor: SettingsColors.muted,
                ),
              )
            else
              SettingsPersonRow(
                displayName: _profile?.displayName.isNotEmpty == true
                    ? _profile!.displayName
                    : 'Current session',
                username: _profile?.username ?? 'you',
                subtitle: _profile?.email,
                actionLabel: 'Active',
                onAction: () {},
              ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        SettingsCard(
          icon: Icons.lock_reset_outlined,
          title: 'Sign-in & password',
          children: [
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.password_outlined,
              title: 'Change password',
              description: 'Send a password reset email',
              onTap: () => _notAvailable('Password change'),
            ),
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.shield_moon_outlined,
              title: 'Two-factor authentication',
              description: 'Add an extra layer of security',
              onTap: () => _notAvailable('Two-factor auth'),
              trailing: const SettingsCountPill(label: 'Off'),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        SettingsCard(
          icon: Icons.history,
          title: 'Login activity',
          description: 'Recent sign-ins to your account.',
          children: [
            const SettingsDivider(),
            SettingsNavRow(
              icon: Icons.devices_other_outlined,
              title: 'Active sessions',
              description: 'Review devices signed in to your account',
              onTap: () => _notAvailable('Session management'),
            ),
          ],
        ),
        const SizedBox(height: SettingsSpacing.lg),
        if (!_loading && _profile != null)
          SettingsCard(
            icon: Icons.fingerprint,
            title: 'Account id',
            children: [
              const SettingsDivider(),
              SettingsNavRow(
                icon: Icons.tag,
                title: _profile!.shortId,
                description: 'Tap to copy your full user id',
                onTap: () {
                  unawaited(
                    Clipboard.setData(
                      ClipboardData(text: _profile!.userId),
                    ),
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('User ID copied')),
                  );
                },
                trailing: const Icon(
                  Icons.copy_outlined,
                  size: 16,
                  color: SettingsColors.mutedForeground,
                ),
              ),
            ],
          ),
        const SizedBox(height: SettingsSpacing.lg),
        const SettingsStatusBanner(
          icon: Icons.info_outline,
          message:
              'Password reset, 2FA and session management need backend '
              'endpoints (auth RPC + user_sessions table) that aren\'t wired '
              'to the native app yet.',
          tone: SettingsBannerTone.neutral,
        ),
      ],
    );
  }
}
