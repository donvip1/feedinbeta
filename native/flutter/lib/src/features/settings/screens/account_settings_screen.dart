import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/media/cached_image.dart';
import '../data/account_profile_data_source.dart';
import '../settings_theme.dart';
import '../settings_widgets.dart';
import 'settings_sub_scaffold.dart';

/// Account settings: profile photo, editable display name / username / bio, and
/// read-only email + FeedIn id. Ports src/pages/AccountSettings.tsx (basic-info
/// slice).
///
/// The photo uploads through [AccountProfileDataSource.uploadAvatar], which uses
/// the same bucket and key layout as the profile tab's uploader — the two are
/// interchangeable.
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
  bool _uploadingAvatar = false;
  String? _statusMessage;
  SettingsBannerTone _statusTone = SettingsBannerTone.info;

  final ImagePicker _picker = ImagePicker();

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

  /// Pick a new profile photo from the gallery and upload it.
  ///
  /// Mirrors `ProfileScreen._pickProfileImage` (same 88% quality / 900px cap)
  /// so an avatar set here is indistinguishable from one set on the profile tab.
  /// Guarded against re-entry while a previous upload is still in flight.
  Future<void> _changeAvatar() async {
    if (_uploadingAvatar) return;
    if (_profile == null) {
      _showStatus(
        'Sign in to change your profile photo.',
        SettingsBannerTone.offline,
      );
      return;
    }

    final XFile? picked;
    try {
      picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 88,
        maxWidth: 900,
      );
    } on PlatformException catch (error) {
      // Typically a denied gallery permission.
      _showStatus(
        'Could not open your gallery: ${error.message ?? error.code}',
        SettingsBannerTone.offline,
      );
      return;
    }
    if (picked == null) return; // user backed out — not an error

    setState(() {
      _uploadingAvatar = true;
      _statusMessage = null;
    });

    try {
      final url = await _source.uploadAvatar(File(picked.path));
      if (!mounted) return;
      setState(() {
        _uploadingAvatar = false;
        _profile = _profile?.copyWith(avatarUrl: url);
        _statusTone = SettingsBannerTone.online;
        _statusMessage = 'Profile photo updated.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _uploadingAvatar = false;
        _statusTone = SettingsBannerTone.offline;
        _statusMessage = 'Photo upload failed: ${_shortError(error)}';
      });
    }
  }

  void _showStatus(String message, SettingsBannerTone tone) {
    setState(() {
      _statusMessage = message;
      _statusTone = tone;
    });
  }

  /// Keeps a raw Supabase/storage exception from overflowing the status banner.
  static String _shortError(Object error) {
    final message = error is StateError ? error.message : error.toString();
    if (message.length <= 140) return message;
    return '${message.substring(0, 140)}...';
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
                      uploading: _uploadingAvatar,
                      onChange: _profile == null ? null : _changeAvatar,
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

/// The avatar control on the account Identity card. Shows the profile photo
/// (with a gradient-initials fallback) and, when [onChange] is non-null, makes
/// the whole row tap-to-replace with a camera badge and a busy spinner.
///
/// [onChange] is null only when nobody is signed in, in which case the row stays
/// inert rather than offering an action that cannot succeed.
class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({
    required this.avatarUrl,
    required this.displayName,
    this.uploading = false,
    this.onChange,
  });

  final String? avatarUrl;
  final String displayName;
  final bool uploading;
  final Future<void> Function()? onChange;

  @override
  Widget build(BuildContext context) {
    final initial = displayName.trim().isNotEmpty
        ? displayName.trim()[0].toUpperCase()
        : 'U';
    final hasImage = avatarUrl != null && avatarUrl!.trim().isNotEmpty;
    final enabled = onChange != null && !uploading;

    final row = Row(
      children: [
        Stack(
          clipBehavior: Clip.none,
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
                  ? CachedImage(
                      // Cache-bust on URL change: the storage key already ends
                      // in a timestamp, so a new upload yields a new URL.
                      url: avatarUrl!,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                      errorWidget: _Initial(initial),
                    )
                  : _Initial(initial),
            ),
            if (uploading)
              Positioned.fill(
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: SettingsColors.scrim,
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: SettingsColors.primaryForeground,
                      ),
                    ),
                  ),
                ),
              )
            else if (onChange != null)
              Positioned(
                right: -2,
                bottom: -2,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: const BoxDecoration(
                    color: SettingsColors.primary,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.photo_camera_rounded,
                    size: 14,
                    color: SettingsColors.primaryForeground,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(width: SettingsSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Profile photo', style: SettingsTextStyles.rowTitle),
              const SizedBox(height: SettingsSpacing.xs),
              Text(
                uploading
                    ? 'Uploading your new photo...'
                    : onChange == null
                        ? 'Sign in to change your photo.'
                        : 'Tap to choose a new photo from your gallery.',
                style: SettingsTextStyles.rowDescription,
              ),
            ],
          ),
        ),
      ],
    );

    if (!enabled) return row;

    return Semantics(
      button: true,
      label: 'Change profile photo',
      child: InkWell(
        borderRadius: SettingsRadii.card,
        onTap: () => unawaited(onChange!()),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: SettingsSpacing.xs),
          child: row,
        ),
      ),
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
