import 'package:flutter/material.dart';

import '../../core/storage/local_storage_maintenance.dart';
import '../../core/sync/sync_service.dart';
import '../../shared/storage_budget.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.syncService,
    required this.storageMaintenance,
    required this.onSignOut,
  });

  final SyncServiceContract syncService;
  final LocalStorageMaintenance storageMaintenance;
  final VoidCallback onSignOut;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _isSyncing = false;
  String? _syncMessage;
  late Future<LocalStorageSnapshot> _storageSnapshotFuture;

  @override
  void initState() {
    super.initState();
    _storageSnapshotFuture = widget.storageMaintenance.snapshot();
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
          '${summary.message} Feed: ${summary.feedActionsSynced}, messages: ${summary.messagesSynced}.';
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

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: storageBudgets.length + 2,
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
                          Chip(label: Text('Profiles ${storage.profileRecords}')),
                          Chip(
                            label: Text(
                              'Media ${storage.mediaFiles} / ${storage.mediaMegabytes.toStringAsFixed(1)} MB',
                            ),
                          ),
                        ],
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
