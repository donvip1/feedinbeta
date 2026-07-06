import 'package:flutter/material.dart';
import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart' show UserIdentity;

import '../../core/config/feedin_config.dart';
import '../../core/security/secure_session_store.dart';
import '../../core/storage/local_storage_maintenance.dart';
import '../../data/local/preferences_repository_contract.dart';
import '../auth/data/auth_repository.dart';
import '../auth/data/auth_repository_contract.dart';
import 'app_preferences.dart';
import 'screens/account_settings_screen.dart';
import 'screens/appearance_language_screen.dart';
import 'screens/blocked_users_screen.dart';
import 'screens/help_about_screen.dart';
import 'screens/notification_preferences_screen.dart';
import 'screens/contact_privacy_screen.dart';
import 'screens/privacy_settings_screen.dart';
import 'screens/security_settings_screen.dart';
import 'settings_theme.dart';
import 'settings_widgets.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.preferencesRepository,
    required this.storageMaintenance,
    required this.onSignOut,
    this.authRepository,
  });

  final PreferencesRepositoryContract preferencesRepository;
  final LocalStorageMaintenance storageMaintenance;
  final VoidCallback onSignOut;

  /// Auth repository backing the "Connected accounts" tile. Optional so the
  /// screen can construct its own from the ambient config (mirroring the
  /// `autoDetect` data-source pattern) and stay decoupled from the shell.
  final AuthRepositoryContract? authRepository;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final AuthRepositoryContract _authRepository;
  AppPreferences _preferences = AppPreferences.defaults;
  bool _clearingCache = false;

  @override
  void initState() {
    super.initState();
    _authRepository =
        widget.authRepository ??
        AuthRepository(
          config: FeedinConfig.fromEnvironment,
          sessionStore: const SecureSessionStore(),
        );
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final preferences = await widget.preferencesRepository.load();
    if (!mounted) return;
    setState(() => _preferences = preferences);
  }

  Future<void> _updatePreferences(AppPreferences preferences) async {
    await widget.preferencesRepository.save(preferences);
    if (!mounted) return;
    setState(() => _preferences = preferences);
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: SettingsColors.background,
      child: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SettingsSpacing.lg,
            SettingsSpacing.lg,
            SettingsSpacing.lg,
            SettingsSpacing.xl,
          ),
          children: [
            const Text('Settings', style: SettingsTextStyles.screenTitle),
            const SizedBox(height: SettingsSpacing.lg),
            _buildAccountCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildPrivacySafetyCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildNotificationsCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildAppearanceCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildHelpAboutCard(),
          ],
        ),
      ),
    );
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  Future<void> _push(Widget screen) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  Future<void> _openPrivacy() {
    return _push(
      PrivacySettingsScreen(
        preferences: _preferences,
        onChanged: _updatePreferences,
        onOpenBlockedUsers: () => unawaited(_push(const BlockedUsersScreen())),
      ),
    );
  }

  // ── Account ───────────────────────────────────────────────────────────────

  /// Account: profile, connected accounts, clear cache, and a danger zone
  /// (sign out / delete account).
  Widget _buildAccountCard() {
    return SettingsCard(
      icon: Icons.person_outline,
      title: 'Account',
      description: 'Your profile, connected accounts and storage.',
      children: [
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.person_outline,
          title: 'Profile',
          description: 'Name, username, email & bio',
          accent: SettingsColors.blueInfo,
          onTap: () => unawaited(_push(const AccountSettingsScreen())),
        ),
        const SettingsDivider(),
        _ConnectedAccountsRow(authRepository: _authRepository),
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.cleaning_services_outlined,
          title: 'Clear cache',
          description: 'Free up space used by cached feed & media',
          accent: const Color(0xFF14B8A6),
          onTap: _clearingCache ? () {} : () => unawaited(_confirmClearCache()),
          trailing: _clearingCache
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: SettingsColors.mutedForeground,
                  ),
                )
              : null,
        ),
        const SettingsDivider(),
        Padding(
          padding: const EdgeInsets.all(SettingsSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SettingsActionButton(
                label: 'Sign out',
                icon: Icons.logout,
                variant: SettingsButtonVariant.destructive,
                expanded: true,
                onPressed: widget.onSignOut,
              ),
              const SizedBox(height: SettingsSpacing.sm),
              SettingsActionButton(
                label: 'Delete account',
                icon: Icons.delete_forever_outlined,
                variant: SettingsButtonVariant.destructive,
                expanded: true,
                onPressed: _confirmDeleteAccount,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmClearCache() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: SettingsColors.card,
          shape: RoundedRectangleBorder(borderRadius: SettingsRadii.card),
          title: const Text(
            'Clear cache?',
            style: TextStyle(color: SettingsColors.foreground),
          ),
          content: const Text(
            'This clears cached posts and downloaded media on this device. '
            'Your account, drafts and messages are not affected — content '
            're-downloads as you browse.',
            style: TextStyle(color: SettingsColors.mutedForeground),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text(
                'Cancel',
                style: TextStyle(color: SettingsColors.mutedForeground),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text(
                'Clear cache',
                style: TextStyle(color: SettingsColors.primary),
              ),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() => _clearingCache = true);
    try {
      await widget.storageMaintenance.clearFeedCache();
      await widget.storageMaintenance.clearMediaCache();
    } finally {
      if (mounted) setState(() => _clearingCache = false);
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Cache cleared')),
    );
  }

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: SettingsColors.card,
          shape: RoundedRectangleBorder(borderRadius: SettingsRadii.card),
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded,
                  color: SettingsColors.destructive),
              SizedBox(width: SettingsSpacing.sm),
              Expanded(
                child: Text(
                  'Delete account?',
                  style: TextStyle(color: SettingsColors.destructive),
                ),
              ),
            ],
          ),
          content: const Text(
            'This cannot be undone. Your profile, posts, messages and '
            'connections would be permanently removed.\n\nAccount deletion '
            'needs a backend endpoint that isn\'t wired to the native app '
            'yet, so this will only sign you out for now.',
            style: TextStyle(color: SettingsColors.mutedForeground),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text(
                'Cancel',
                style: TextStyle(color: SettingsColors.mutedForeground),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text(
                'Sign out',
                style: TextStyle(color: SettingsColors.destructive),
              ),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      widget.onSignOut();
    }
  }

  // ── Privacy & Safety ────────────────────────────────────────────────────

  /// Privacy & safety: visibility/interaction toggles, private account,
  /// message requests, last seen & contact privacy, blocked users, security.
  Widget _buildPrivacySafetyCard() {
    return SettingsCard(
      icon: Icons.shield_outlined,
      title: 'Privacy & safety',
      description: 'Control your visibility, who can reach you and security.',
      children: [
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.visibility_outlined,
          title: 'Privacy',
          description: 'Who can message, follow & see you',
          accent: const Color(0xFFA855F7),
          onTap: () => unawaited(_openPrivacy()),
        ),
        const SettingsDivider(),
        SettingsToggleRow(
          icon: Icons.lock_outline,
          title: 'Private account',
          description: 'Only approved followers can see your activity',
          value: _preferences.privateAccount,
          sensitive: true,
          onChanged: (value) => unawaited(
            _updatePreferences(_preferences.copyWith(privateAccount: value)),
          ),
        ),
        const SettingsDivider(),
        SettingsToggleRow(
          icon: Icons.mark_chat_unread_outlined,
          title: 'Message requests',
          description: 'Let people you don\'t follow message you',
          value: _preferences.allowMessageRequests,
          onChanged: (value) => unawaited(
            _updatePreferences(
              _preferences.copyWith(allowMessageRequests: value),
            ),
          ),
        ),
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.remove_red_eye_outlined,
          title: 'Last seen & contact privacy',
          description: 'Who sees your last seen, photo, status & about',
          accent: const Color(0xFF22C55E),
          onTap: () => unawaited(_push(const ContactPrivacyScreen())),
        ),
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.person_off_outlined,
          title: 'Blocked & muted',
          description: 'People you\'ve blocked or muted',
          accent: SettingsColors.destructive,
          onTap: () => unawaited(_push(const BlockedUsersScreen())),
        ),
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.verified_user_outlined,
          title: 'Security',
          description: 'Your current session & account id',
          accent: const Color(0xFF06B6D4),
          onTap: () => unawaited(_push(const SecuritySettingsScreen())),
        ),
      ],
    );
  }

  // ── Notifications ───────────────────────────────────────────────────────

  Widget _buildNotificationsCard() {
    return SettingsCard(
      icon: Icons.notifications_none,
      title: 'Notifications',
      description: 'Choose which alerts you receive.',
      children: [
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.notifications_none,
          title: 'Notifications',
          description: 'Per-type push & email alerts',
          accent: SettingsColors.primary,
          onTap: () =>
              unawaited(_push(const NotificationPreferencesScreen())),
        ),
      ],
    );
  }

  // ── Appearance ──────────────────────────────────────────────────────────

  /// Appearance: theme & language sub-screen plus on-device media/data toggles
  /// (autoplay, Wi-Fi-only caching).
  Widget _buildAppearanceCard() {
    return SettingsCard(
      icon: Icons.palette_outlined,
      title: 'Appearance',
      description: 'Theme, language and how media loads on this device.',
      children: [
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.palette_outlined,
          title: 'Appearance & language',
          description: 'Theme, motion & display language',
          accent: const Color(0xFF14B8A6),
          onTap: () => unawaited(
            _push(
              AppearanceLanguageScreen(
                preferences: _preferences,
                onChanged: _updatePreferences,
              ),
            ),
          ),
        ),
        const SettingsDivider(),
        SettingsToggleRow(
          icon: Icons.play_circle_outline,
          title: 'Autoplay videos',
          description: 'Play videos automatically as you scroll',
          value: _preferences.mediaAutoplay,
          onChanged: (value) => unawaited(
            _updatePreferences(_preferences.copyWith(mediaAutoplay: value)),
          ),
        ),
        const SettingsDivider(),
        SettingsToggleRow(
          icon: Icons.wifi,
          title: 'Cache media on Wi-Fi only',
          description: 'Save mobile data by caching media on Wi-Fi',
          value: _preferences.saveMediaOnWifiOnly,
          onChanged: (value) => unawaited(
            _updatePreferences(
              _preferences.copyWith(saveMediaOnWifiOnly: value),
            ),
          ),
        ),
      ],
    );
  }

  // ── Help & about ────────────────────────────────────────────────────────

  Widget _buildHelpAboutCard() {
    return SettingsCard(
      icon: Icons.help_outline,
      title: 'Help & about',
      description: 'Support, legal and app info.',
      children: [
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.help_outline,
          title: 'Help & about',
          description: 'FAQ, terms, privacy & version',
          accent: const Color(0xFF06B6D4),
          onTap: () => unawaited(_push(const HelpAboutScreen())),
        ),
      ],
    );
  }
}

/// The "Connected accounts" row: shows whether Google is linked and offers a
/// Connect / Disconnect action inline. Loads the linked identities lazily and
/// reflects link/unlink results in place.
class _ConnectedAccountsRow extends StatefulWidget {
  const _ConnectedAccountsRow({required this.authRepository});

  final AuthRepositoryContract authRepository;

  @override
  State<_ConnectedAccountsRow> createState() => _ConnectedAccountsRowState();
}

class _ConnectedAccountsRowState extends State<_ConnectedAccountsRow> {
  bool _loading = true;
  bool _busy = false;
  UserIdentity? _googleIdentity;

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final identities = await widget.authRepository.listIdentities();
      UserIdentity? google;
      for (final identity in identities) {
        if (identity.provider == 'google') {
          google = identity;
          break;
        }
      }
      if (!mounted) return;
      setState(() {
        _googleIdentity = google;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _connect() async {
    setState(() => _busy = true);
    try {
      await widget.authRepository.linkGoogleIdentity();
      await _refresh();
      _snack('Google connected');
    } catch (error) {
      _snack('Couldn\'t connect Google: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _disconnect() async {
    final identity = _googleIdentity;
    if (identity == null) return;
    setState(() => _busy = true);
    try {
      await widget.authRepository.unlinkIdentity(identity);
      await _refresh();
      _snack('Google disconnected');
    } catch (error) {
      _snack('Couldn\'t disconnect Google: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final connected = _googleIdentity != null;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: SettingsSpacing.lg,
        vertical: SettingsSpacing.md,
      ),
      child: Row(
        children: [
          Container(
            width: SettingsSpacing.iconBubble,
            height: SettingsSpacing.iconBubble,
            decoration: const BoxDecoration(
              color: SettingsColors.iconBubble,
              borderRadius: SettingsRadii.tile,
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.link,
              size: 18,
              color: Color(0xFF4285F4),
            ),
          ),
          const SizedBox(width: SettingsSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Connected accounts',
                  style: SettingsTextStyles.rowTitle,
                ),
                const SizedBox(height: SettingsSpacing.xs),
                Text(
                  _loading
                      ? 'Checking Google connection…'
                      : connected
                          ? 'Google connected'
                          : 'Connect your Google account',
                  style: SettingsTextStyles.rowDescription,
                ),
              ],
            ),
          ),
          const SizedBox(width: SettingsSpacing.md),
          if (_loading)
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: SettingsColors.mutedForeground,
              ),
            )
          else
            SettingsActionButton(
              label: connected ? 'Disconnect' : 'Connect',
              icon: connected ? Icons.link_off : Icons.link,
              variant: connected
                  ? SettingsButtonVariant.destructive
                  : SettingsButtonVariant.outline,
              busy: _busy,
              onPressed: _busy
                  ? null
                  : connected
                      ? _disconnect
                      : _connect,
            ),
        ],
      ),
    );
  }
}
