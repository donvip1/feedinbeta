import 'package:flutter/material.dart';
import 'dart:async';

import '../../core/storage/local_storage_maintenance.dart';
import '../../core/storage/storage_diagnostics_service.dart';
import '../../core/sync/sync_service.dart';
import '../../core/sync/upload_queue_service.dart';
import '../../data/local/preferences_repository_contract.dart';
import '../../shared/storage_budget.dart';
import 'app_preferences.dart';

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
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: storageBudgets.length + 3,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        if (index == 0) {
          return Text(
            'Device storage',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          );
        }

        if (index == storageBudgets.length + 1) {
          return Card(
            child: Column(
              children: [
                SwitchListTile(
                  secondary: const Icon(Icons.lock_outline),
                  title: const Text('Private account'),
                  value: _preferences.privateAccount,
                  onChanged: (value) {
                    unawaited(
                      _updatePreferences(
                        _preferences.copyWith(privateAccount: value),
                      ),
                    );
                  },
                ),
                SwitchListTile(
                  secondary: const Icon(Icons.mark_chat_unread_outlined),
                  title: const Text('Message requests'),
                  value: _preferences.allowMessageRequests,
                  onChanged: (value) {
                    unawaited(
                      _updatePreferences(
                        _preferences.copyWith(
                          allowMessageRequests: value,
                        ),
                      ),
                    );
                  },
                ),
                SwitchListTile(
                  secondary: const Icon(Icons.play_circle_outline),
                  title: const Text('Autoplay videos'),
                  value: _preferences.mediaAutoplay,
                  onChanged: (value) {
                    unawaited(
                      _updatePreferences(
                        _preferences.copyWith(mediaAutoplay: value),
                      ),
                    );
                  },
                ),
                SwitchListTile(
                  secondary: const Icon(Icons.wifi),
                  title: const Text('Cache media on Wi-Fi only'),
                  value: _preferences.saveMediaOnWifiOnly,
                  onChanged: (value) {
                    unawaited(
                      _updatePreferences(
                        _preferences.copyWith(
                          saveMediaOnWifiOnly: value,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          );
        }

        if (index == storageBudgets.length + 2) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FutureBuilder<LocalStorageSnapshot>(
                future: _storageSnapshotFuture,
                builder: (context, snapshot) {
                  final storage = snapshot.data;
                  if (storage == null) {
                    return const LinearProgressIndicator();
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Local records',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          Chip(label: Text('Feed ${storage.feedPosts}')),
                          Chip(label: Text('Queued ${storage.pendingActions}')),
                          Chip(label: Text('Chats ${storage.conversations}')),
                          Chip(label: Text('Messages ${storage.messages}')),
                          Chip(
                            label: Text('Alerts ${storage.notifications}'),
                          ),
                          Chip(label: Text('Profiles ${storage.profileRecords}')),
                          Chip(
                            label: Text(
                              'Media ${storage.mediaFiles} / ${storage.mediaMegabytes.toStringAsFixed(1)} MB',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Chip(
                        avatar: Icon(
                          widget.realtimeConnected
                              ? Icons.sensors
                              : Icons.sensors_off,
                        ),
                        label: Text(
                          widget.realtimeConnected
                              ? 'Realtime connected'
                              : 'Realtime offline',
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ActionChip(
                            avatar: const Icon(Icons.cleaning_services),
                            label: const Text('Clear feed cache'),
                            onPressed: _clearFeedCache,
                          ),
                          ActionChip(
                            avatar: const Icon(Icons.playlist_remove),
                            label: const Text('Clear queue'),
                            onPressed: _clearPendingActions,
                          ),
                          ActionChip(
                            avatar: const Icon(Icons.delete_sweep),
                            label: const Text('Clear messages'),
                            onPressed: _clearMessages,
                          ),
                          ActionChip(
                            avatar: const Icon(Icons.notifications_off),
                            label: const Text('Clear alerts'),
                            onPressed: _clearNotifications,
                          ),
                          ActionChip(
                            avatar: const Icon(Icons.video_file),
                            label: const Text('Clear media'),
                            onPressed: _clearMediaCache,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],
                  );
                },
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.sync),
                    label: Text(_isSyncing ? 'Syncing...' : 'Sync now'),
                    onPressed: _isSyncing ? null : _syncNow,
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.cloud_upload_outlined),
                    label: Text(_isUploading ? 'Uploading...' : 'Upload drafts'),
                    onPressed: _isUploading ? null : _uploadDrafts,
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.storage_outlined),
                    label: Text(
                      _isCheckingStorage ? 'Checking...' : 'Check storage',
                    ),
                    onPressed: _isCheckingStorage ? null : _checkStorage,
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.logout),
                    label: const Text('Sign out'),
                    onPressed: widget.onSignOut,
                  ),
                ],
              ),
              if (_syncMessage != null) ...[
                const SizedBox(height: 10),
                Text(
                  _syncMessage!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          );
        }

        final budget = storageBudgets[index - 1];
        return Card(
          child: ListTile(
            title: Text(budget.name),
            subtitle: Text('${budget.megabytes} MB budget'),
            trailing: Text(budget.autoCleanup ? 'Auto cleanup' : 'Retained'),
          ),
        );
      },
    );
  }
}
