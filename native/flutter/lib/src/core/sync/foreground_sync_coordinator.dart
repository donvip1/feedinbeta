import 'dart:async';

import 'sync_service.dart';
import 'upload_queue_service.dart';

class ForegroundSyncCoordinator {
  ForegroundSyncCoordinator({
    required SyncServiceContract syncService,
    required UploadQueueService uploadQueueService,
    Duration interval = const Duration(minutes: 2),
  }) : _syncService = syncService,
       _uploadQueueService = uploadQueueService,
       _interval = interval;

  final SyncServiceContract _syncService;
  final UploadQueueService _uploadQueueService;
  final Duration _interval;
  Timer? _timer;
  bool _isRunning = false;

  bool get isActive => _timer?.isActive ?? false;

  void start() {
    if (isActive) return;
    _timer = Timer.periodic(_interval, (_) => unawaited(runOnce()));
    unawaited(runOnce());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> runOnce() async {
    if (_isRunning) return;
    _isRunning = true;
    try {
      await _syncService.syncNow();
      await _uploadQueueService.processQueue();
    } finally {
      _isRunning = false;
    }
  }
}
