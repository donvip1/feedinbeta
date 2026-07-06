import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/account_profile_data_source.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Security overview: the current session plus the account id.
///
/// The native schema has no `user_sessions` / 2FA tables and no password-reset
/// or session-revocation RPC is wired natively yet, so this screen intentionally
/// only surfaces what genuinely works today: the real current session (from the
/// Supabase auth user) and a tap-to-copy account id. Placeholder controls for
/// password change, two-factor and session management are deliberately omitted
/// rather than shown as non-functional rows.
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
        if (!_loading && _profile != null) ...[
          const SizedBox(height: SettingsSpacing.lg),
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
        ],
      ],
    );
  }
}
