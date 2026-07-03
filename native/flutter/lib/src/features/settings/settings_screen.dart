import 'package:flutter/material.dart';
import 'dart:async';

import '../../core/storage/local_storage_maintenance.dart';
import '../../core/storage/storage_diagnostics_service.dart';
import '../../core/sync/sync_service.dart';
import '../../core/sync/upload_queue_service.dart';
import '../../data/local/preferences_repository_contract.dart';
import '../../shared/storage_budget.dart';
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
    required this.syncService,
    required this.uploadQueueService,
    required this.storageDiagnosticsService,
    required this.preferencesRepository,
    required this.realtimeConnected,
    required this.storageMaintenance,
    required this.onSignOut,
  });

  final SyncServiceContract syncService;
  final UploadQueueService uploadQueueService;
  final StorageDiagnosticsService storageDiagnosticsService;
  final PreferencesRepositoryContract preferencesRepository;
  final bool realtimeConnected;
  final LocalStorageMaintenance storageMaintenance;
  final VoidCallback onSignOut;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _isSyncing = false;
  bool _isUploading = false;
  bool _isCheckingStorage = false;
  AppPreferences _preferences = AppPreferences.defaults;
  String? _syncMessage;
  late Future<LocalStorageSnapshot> _storageSnapshotFuture;

  @override
  void initState() {
    super.initState();
    _storageSnapshotFuture = widget.storageMaintenance.snapshot();
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

  Future<void> _uploadDrafts() async {
    setState(() {
      _isUploading = true;
      _syncMessage = null;
    });

    final summary = await widget.uploadQueueService.processQueue();

    if (!mounted) return;
    setState(() {
      _isUploading = false;
      _syncMessage =
          '${summary.message} Uploaded: ${summary.uploaded}, failed: ${summary.failed}.';
      _storageSnapshotFuture = widget.storageMaintenance.snapshot();
    });
  }

  Future<void> _checkStorage() async {
    setState(() {
      _isCheckingStorage = true;
      _syncMessage = null;
    });

    final summary = await widget.storageDiagnosticsService.checkPostMedia();

    if (!mounted) return;
    setState(() {
      _isCheckingStorage = false;
      _syncMessage =
          '${summary.message} List: ${summary.canListOwnPrefix}, public URL: ${summary.publicUrlGenerated}.';
    });
  }

  void _refreshStorageSnapshot() {
    setState(() {
      _storageSnapshotFuture = widget.storageMaintenance.snapshot();
    });
  }

  Future<void> _syncNow() async {
    setState(() {
      _isSyncing = true;
      _syncMessage = null;
    });

    final summary = await widget.syncService.syncNow();

    if (!mounted) return;
    setState(() {
      _isSyncing = false;
      _syncMessage =
          '${summary.message} Feed: ${summary.feedActionsSynced}, sent: ${summary.messagesSynced}, pulled: ${summary.remoteMessagesPulled}.';
    });
  }

  Future<void> _clearFeedCache() async {
    await widget.storageMaintenance.clearFeedCache();
    _refreshStorageSnapshot();
  }

  Future<void> _clearPendingActions() async {
    await widget.storageMaintenance.clearPendingActions();
    _refreshStorageSnapshot();
  }

  Future<void> _clearMessages() async {
    await widget.storageMaintenance.clearMessages();
    _refreshStorageSnapshot();
  }

  Future<void> _clearMediaCache() async {
    await widget.storageMaintenance.clearMediaCache();
    _refreshStorageSnapshot();
  }

  Future<void> _clearNotifications() async {
    await widget.storageMaintenance.clearNotifications();
    _refreshStorageSnapshot();
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
            _buildAccountPrivacyCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildPreferencesCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildPrivacyMediaCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildDeviceStorageCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildMaintenanceCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildBudgetsCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildHelpAboutCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildDangerZoneCard(),
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

  /// Account & privacy: entries into the account, privacy, notifications,
  /// security, and blocked-users sub-screens (web Settings.tsx
  /// 'Account & Privacy' group).
  Widget _buildAccountPrivacyCard() {
    return SettingsCard(
      icon: Icons.manage_accounts_outlined,
      title: 'Account & privacy',
      description: 'Profile, privacy, notifications and security.',
      children: [
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.person_outline,
          title: 'Account',
          description: 'Profile, username & email',
          accent: SettingsColors.blueInfo,
          onTap: () => unawaited(_push(const AccountSettingsScreen())),
        ),
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.shield_outlined,
          title: 'Privacy',
          description: 'Who can message, follow & see you',
          accent: const Color(0xFFA855F7),
          onTap: () => unawaited(_openPrivacy()),
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
          icon: Icons.notifications_none,
          title: 'Notifications',
          description: 'Per-type push & email alerts',
          accent: SettingsColors.primary,
          onTap: () =>
              unawaited(_push(const NotificationPreferencesScreen())),
        ),
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.verified_user_outlined,
          title: 'Security',
          description: 'Sessions, 2FA & login activity',
          accent: const Color(0xFF06B6D4),
          onTap: () => unawaited(_push(const SecuritySettingsScreen())),
        ),
        const SettingsDivider(),
        SettingsNavRow(
          icon: Icons.person_off_outlined,
          title: 'Blocked & muted',
          description: 'People you\'ve blocked or muted',
          accent: SettingsColors.destructive,
          onTap: () => unawaited(_push(const BlockedUsersScreen())),
        ),
      ],
    );
  }

  /// Preferences: appearance & language sub-screen (web 'Preferences' group +
  /// Dark Mode toggle).
  Widget _buildPreferencesCard() {
    return SettingsCard(
      icon: Icons.tune,
      title: 'Preferences',
      description: 'Appearance, language and app behaviour.',
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
      ],
    );
  }

  /// Help & legal: help/about sub-screen (web 'Help & Legal' group).
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

  /// Danger zone: sign out + delete account (web PrivacySettings danger zone +
  /// Settings.tsx sign-out).
  Widget _buildDangerZoneCard() {
    return SettingsCard(
      icon: Icons.warning_amber_rounded,
      title: 'Account actions',
      description: 'Sign out or permanently delete your account.',
      accent: SettingsColors.destructive,
      accentBubble: SettingsColors.destructiveSoft,
      children: [
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

  /// Privacy & Media toggles (web PrivacySettingsPanel grouping + tinted rows).
  Widget _buildPrivacyMediaCard() {
    return SettingsCard(
      icon: Icons.shield_outlined,
      title: 'Privacy & media',
      description: 'Control your visibility and how media loads on this device.',
      children: [
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

  /// Device storage: local-record stats + realtime banner + cleanup actions
  /// (web CacheSettings titled card + destructive cleanup actions).
  Widget _buildDeviceStorageCard() {
    return SettingsCard(
      icon: Icons.sd_storage_outlined,
      title: 'Device storage',
      description: 'Local records cached on this device.',
      children: [
        const SettingsDivider(),
        Padding(
          padding: const EdgeInsets.all(SettingsSpacing.lg),
          child: FutureBuilder<LocalStorageSnapshot>(
            future: _storageSnapshotFuture,
            builder: (context, snapshot) {
              final storage = snapshot.data;
              if (storage == null) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: SettingsSpacing.md),
                  child: LinearProgressIndicator(
                    color: SettingsColors.primary,
                    backgroundColor: SettingsColors.muted,
                  ),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: SettingsSpacing.sm,
                    runSpacing: SettingsSpacing.sm,
                    children: [
                      SettingsStat(
                        label: 'Feed',
                        value: '${storage.feedPosts}',
                      ),
                      SettingsStat(
                        label: 'Queued',
                        value: '${storage.pendingActions}',
                      ),
                      SettingsStat(
                        label: 'Chats',
                        value: '${storage.conversations}',
                      ),
                      SettingsStat(
                        label: 'Messages',
                        value: '${storage.messages}',
                      ),
                      SettingsStat(
                        label: 'Alerts',
                        value: '${storage.notifications}',
                      ),
                      SettingsStat(
                        label: 'Profiles',
                        value: '${storage.profileRecords}',
                      ),
                      SettingsStat(
                        label: 'Media',
                        value:
                            '${storage.mediaFiles} / ${storage.mediaMegabytes.toStringAsFixed(1)} MB',
                      ),
                    ],
                  ),
                  const SizedBox(height: SettingsSpacing.md),
                  SettingsStatusBanner(
                    icon: widget.realtimeConnected
                        ? Icons.sensors
                        : Icons.sensors_off,
                    message: widget.realtimeConnected
                        ? 'Realtime connected'
                        : 'Realtime offline',
                    tone: widget.realtimeConnected
                        ? SettingsBannerTone.online
                        : SettingsBannerTone.offline,
                  ),
                ],
              );
            },
          ),
        ),
        const SettingsDivider(),
        Padding(
          padding: const EdgeInsets.all(SettingsSpacing.lg),
          child: Wrap(
            spacing: SettingsSpacing.sm,
            runSpacing: SettingsSpacing.sm,
            children: [
              SettingsActionButton(
                label: 'Clear feed cache',
                icon: Icons.cleaning_services,
                variant: SettingsButtonVariant.destructive,
                onPressed: _clearFeedCache,
              ),
              SettingsActionButton(
                label: 'Clear queue',
                icon: Icons.playlist_remove,
                variant: SettingsButtonVariant.destructive,
                onPressed: _clearPendingActions,
              ),
              SettingsActionButton(
                label: 'Clear messages',
                icon: Icons.delete_sweep,
                variant: SettingsButtonVariant.destructive,
                onPressed: _clearMessages,
              ),
              SettingsActionButton(
                label: 'Clear alerts',
                icon: Icons.notifications_off,
                variant: SettingsButtonVariant.destructive,
                onPressed: _clearNotifications,
              ),
              SettingsActionButton(
                label: 'Clear media',
                icon: Icons.video_file,
                variant: SettingsButtonVariant.destructive,
                onPressed: _clearMediaCache,
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Maintenance & diagnostics: sync / upload / diagnostics, plus the last
  /// operation's status message as a banner.
  Widget _buildMaintenanceCard() {
    return SettingsCard(
      icon: Icons.build_outlined,
      title: 'Maintenance & diagnostics',
      description: 'Sync data or run storage diagnostics.',
      children: [
        const SettingsDivider(),
        Padding(
          padding: const EdgeInsets.all(SettingsSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SettingsActionButton(
                label: _isSyncing ? 'Syncing...' : 'Sync now',
                icon: Icons.sync,
                variant: SettingsButtonVariant.primary,
                expanded: true,
                busy: _isSyncing,
                onPressed: _isSyncing ? null : _syncNow,
              ),
              const SizedBox(height: SettingsSpacing.sm),
              SettingsActionButton(
                label: _isUploading ? 'Uploading...' : 'Upload drafts',
                icon: Icons.cloud_upload_outlined,
                expanded: true,
                busy: _isUploading,
                onPressed: _isUploading ? null : _uploadDrafts,
              ),
              const SizedBox(height: SettingsSpacing.sm),
              SettingsActionButton(
                label: _isCheckingStorage ? 'Checking...' : 'Check storage',
                icon: Icons.storage_outlined,
                expanded: true,
                busy: _isCheckingStorage,
                onPressed: _isCheckingStorage ? null : _checkStorage,
              ),
              if (_syncMessage != null) ...[
                const SizedBox(height: SettingsSpacing.md),
                SettingsStatusBanner(
                  icon: Icons.info_outline,
                  message: _syncMessage!,
                  tone: SettingsBannerTone.info,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  /// Storage budgets reference (web 'Cache Strategy' explainer card).
  Widget _buildBudgetsCard() {
    final rows = <Widget>[];
    for (var i = 0; i < storageBudgets.length; i++) {
      if (i > 0) rows.add(const SettingsDivider());
      rows.add(_BudgetRow(budget: storageBudgets[i]));
    }

    return SettingsCard(
      icon: Icons.donut_large_outlined,
      title: 'Storage budgets',
      description: 'Per-cache limits and auto-cleanup policy.',
      children: [const SettingsDivider(), ...rows],
    );
  }
}

/// A single storage-budget row: name + budget over a retained/auto-clean pill.
class _BudgetRow extends StatelessWidget {
  const _BudgetRow({required this.budget});

  final StorageBudget budget;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: SettingsSpacing.lg,
        vertical: SettingsSpacing.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(budget.name, style: SettingsTextStyles.rowTitle),
                const SizedBox(height: SettingsSpacing.xs),
                Text(
                  '${budget.megabytes} MB budget',
                  style: SettingsTextStyles.rowDescription,
                ),
              ],
            ),
          ),
          const SizedBox(width: SettingsSpacing.md),
          _BudgetPolicyPill(autoCleanup: budget.autoCleanup),
        ],
      ),
    );
  }
}

/// 'Auto cleanup' (online tint) vs 'Retained' (muted) policy pill.
class _BudgetPolicyPill extends StatelessWidget {
  const _BudgetPolicyPill({required this.autoCleanup});

  final bool autoCleanup;

  @override
  Widget build(BuildContext context) {
    final fg = autoCleanup
        ? SettingsColors.online
        : SettingsColors.mutedForeground;
    final bg = autoCleanup ? SettingsColors.onlineSoft : SettingsColors.mutedSoft;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SettingsSpacing.md,
        vertical: SettingsSpacing.xs,
      ),
      decoration: BoxDecoration(color: bg, borderRadius: SettingsRadii.chip),
      child: Text(
        autoCleanup ? 'Auto cleanup' : 'Retained',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}
