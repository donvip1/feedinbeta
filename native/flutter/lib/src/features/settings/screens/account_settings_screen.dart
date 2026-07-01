import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/account_profile_data_source.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Account settings: edit profile (display name / username / bio), read-only
/// email + FeedIn id. Ports src/pages/AccountSettings.tsx (basic-info slice).
///
/// Location / phone / gender / occupation from the web editor are intentionally
/// omitted because those columns are not in the native `profiles` schema yet
/// (flagged as a backend gap on the main Settings screen).
class AccountSettingsScreen extends StatefulWidget {
  const AccountSettingsScreen({super.key, this.dataSource});

  /// Optional injected source; falls back to an auto-detecting instance so the
  /// screen builds when pushed without dependency injection.
  final AccountProfileDataSource? dataSource;

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends State<AccountSettingsScreen> {
  late final AccountProfileDataSource _source;
  final _displayNameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _bioController = TextEditingController();
  // Read-only identity fields. Held in state (rather than created inline in
  // build) so they aren't leaked/recreated on every rebuild.
  final _emailController = TextEditingController();
  final _shortIdController = TextEditingController();

  AccountProfile? _profile;
  bool _loading = true;
  bool _saving = false;
  String? _statusMessage;
  SettingsBannerTone _statusTone = SettingsBannerTone.info;

  @override
  void initState() {
    super.initState();
    _source = widget.dataSource ?? AccountProfileDataSource.autoDetect();
    _load();
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _usernameController.dispose();
    _bioController.dispose();
    _emailController.dispose();
    _shortIdController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final profile = await _source.load();
    if (!mounted) return;
    setState(() {
      _profile = profile;
      _loading = false;
      _emailController.text = profile?.email ?? 'Not signed in';
      _shortIdController.text = profile?.shortId ?? '—';
      if (profile != null) {
        _displayNameController.text = profile.displayName;
        _usernameController.text = profile.username;
        _bioController.text = profile.bio;
      }
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _statusMessage = null;
    });

    try {
      final wrote = await _source.save(
        displayName: _displayNameController.text.trim(),
        username: _usernameController.text.trim(),
        bio: _bioController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _statusTone = wrote
            ? SettingsBannerTone.online
            : SettingsBannerTone.offline;
        _statusMessage = wrote
            ? 'Profile updated.'
            : 'Sign in to save changes to your account.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _statusTone = SettingsBannerTone.offline;
        _statusMessage = 'Could not save: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SettingsSubScaffold(
      title: 'Account',
      icon: Icons.person_outline,
      accent: SettingsColors.blueInfo,
      footer: SettingsActionButton(
        label: _saving ? 'Saving...' : 'Save changes',
        icon: Icons.save_outlined,
        variant: SettingsButtonVariant.primary,
        expanded: true,
        busy: _saving,
        onPressed: _saving || _loading ? null : _save,
      ),
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
            icon: Icons.badge_outlined,
            title: 'Identity',
            description: 'Your email and unique FeedIn id. These can\'t be '
                'changed here.',
            children: [
              const SettingsDivider(),
              Padding(
                padding: const EdgeInsets.all(SettingsSpacing.lg),
                child: Column(
                  children: [
                    _AccountAvatar(
                      avatarUrl: _profile?.avatarUrl,
                      displayName: _displayNameController.text.isNotEmpty
                          ? _displayNameController.text
                          : (_profile?.displayName ?? ''),
                    ),
                    const SizedBox(height: SettingsSpacing.lg),
                    SettingsTextField(
                      label: 'Email',
                      controller: _emailController,
                      readOnly: true,
                      helper: 'Contact the Help Center to change your email.',
                      prefixIcon: Icons.mail_outline,
                    ),
                    const SizedBox(height: SettingsSpacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: SettingsTextField(
                            label: 'FeedIn ID',
                            controller: _shortIdController,
                            readOnly: true,
                          ),
                        ),
                        const SizedBox(width: SettingsSpacing.sm),
                        Padding(
                          padding: const EdgeInsets.only(top: 20),
                          child: SettingsActionButton(
                            label: 'Copy',
                            icon: Icons.copy_outlined,
                            onPressed: _profile == null
                                ? null
                                : () {
                                    unawaited(
                                      Clipboard.setData(
                                        ClipboardData(text: _profile!.userId),
                                      ),
                                    );
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('User ID copied'),
                                      ),
                                    );
                                  },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: SettingsSpacing.lg),
          SettingsCard(
            icon: Icons.edit_outlined,
            title: 'Basic information',
            description: 'How you appear across FeedIn.',
            children: [
              const SettingsDivider(),
              Padding(
                padding: const EdgeInsets.all(SettingsSpacing.lg),
                child: Column(
                  children: [
                    SettingsTextField(
                      label: 'Display name',
                      controller: _displayNameController,
                      hint: 'Your display name',
                    ),
                    const SizedBox(height: SettingsSpacing.md),
                    SettingsTextField(
                      label: 'Username',
                      controller: _usernameController,
                      hint: '@username',
                      prefixIcon: Icons.alternate_email,
                    ),
                    const SizedBox(height: SettingsSpacing.md),
                    SettingsTextField(
                      label: 'Bio',
                      controller: _bioController,
                      hint: 'Tell people about yourself',
                      maxLines: 4,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_statusMessage != null) ...[
            const SizedBox(height: SettingsSpacing.lg),
            SettingsStatusBanner(
              icon: _statusTone == SettingsBannerTone.online
                  ? Icons.check_circle_outline
                  : Icons.info_outline,
              message: _statusMessage!,
              tone: _statusTone,
            ),
          ],
        ],
      ],
    );
  }
}

/// A read-only avatar preview for the account Identity card. Shows the profile
/// photo (with a gradient-initials fallback) plus a note that photo changes
/// happen on the web — native has no image picker/cropper wired yet.
class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({required this.avatarUrl, required this.displayName});

  final String? avatarUrl;
  final String displayName;

  @override
  Widget build(BuildContext context) {
    final initial = displayName.trim().isNotEmpty
        ? displayName.trim()[0].toUpperCase()
        : 'U';
    final hasImage = avatarUrl != null && avatarUrl!.trim().isNotEmpty;
    return Row(
      children: [
        Container(
          width: 64,
          height: 64,
          clipBehavior: Clip.antiAlias,
          decoration: const BoxDecoration(
            gradient: SettingsGradients.primary,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: hasImage
              ? Image.network(
                  avatarUrl!,
                  width: 64,
                  height: 64,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => _Initial(initial),
                )
              : _Initial(initial),
        ),
        const SizedBox(width: SettingsSpacing.md),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Profile photo', style: SettingsTextStyles.rowTitle),
              SizedBox(height: SettingsSpacing.xs),
              Text(
                'Update your photo from the web app for now.',
                style: SettingsTextStyles.rowDescription,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Initial extends StatelessWidget {
  const _Initial(this.initial);

  final String initial;

  @override
  Widget build(BuildContext context) {
    return Text(
      initial,
      style: const TextStyle(
        color: SettingsColors.primaryForeground,
        fontSize: 24,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}
