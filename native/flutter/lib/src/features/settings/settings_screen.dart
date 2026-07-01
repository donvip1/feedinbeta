import 'package:flutter/material.dart';
import 'dart:async';

import '../../core/storage/local_storage_maintenance.dart';
import '../../core/storage/storage_diagnostics_service.dart';
import '../../core/sync/sync_service.dart';
import '../../core/sync/upload_queue_service.dart';
import '../../data/local/preferences_repository_contract.dart';
import '../../shared/storage_budget.dart';
import 'app_preferences.dart';
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
            _buildPrivacyMediaCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildDeviceStorageCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildMaintenanceCard(),
            const SizedBox(height: SettingsSpacing.lg),
            _buildBudgetsCard(),
          ],
        ),
      ),
    );
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

  /// Maintenance & account: sync / upload / diagnostics / sign-out, plus the
  /// last operation's status message as a banner.
  Widget _buildMaintenanceCard() {
    return SettingsCard(
      icon: Icons.tune,
      title: 'Maintenance & account',
      description: 'Sync data, run diagnostics, or sign out.',
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
              const SizedBox(height: SettingsSpacing.sm),
              SettingsActionButton(
                label: 'Sign out',
                icon: Icons.logout,
                variant: SettingsButtonVariant.destructive,
                expanded: true,
                onPressed: widget.onSignOut,
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
