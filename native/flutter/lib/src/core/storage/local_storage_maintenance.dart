import 'package:hive_ce/hive.dart';

import 'media_cache_service.dart';

class LocalStorageMaintenance {
  const LocalStorageMaintenance({
    required Box<Map> profileBox,
    required Box<Map> feedBox,
    required Box<Map> pendingActionsBox,
    required Box<Map> conversationsBox,
    required Box<Map> messagesBox,
    required MediaCacheService mediaCacheService,
  }) : _profileBox = profileBox,
       _feedBox = feedBox,
       _pendingActionsBox = pendingActionsBox,
       _conversationsBox = conversationsBox,
       _messagesBox = messagesBox,
       _mediaCacheService = mediaCacheService;

  final Box<Map> _profileBox;
  final Box<Map> _feedBox;
  final Box<Map> _pendingActionsBox;
  final Box<Map> _conversationsBox;
  final Box<Map> _messagesBox;
  final MediaCacheService _mediaCacheService;

  Future<LocalStorageSnapshot> snapshot() async {
    final mediaCache = await _mediaCacheService.snapshot();
    return LocalStorageSnapshot(
      profileRecords: _profileBox.length,
      feedPosts: _feedBox.length,
      pendingActions: _pendingActionsBox.length,
      conversations: _conversationsBox.length,
      messages: _messagesBox.length,
      mediaFiles: mediaCache.fileCount,
      mediaBytes: mediaCache.totalBytes,
    );
  }

  Future<void> clearFeedCache() async {
    await _feedBox.clear();
  }

  Future<void> clearPendingActions() async {
    await _pendingActionsBox.clear();
  }

  Future<void> clearMessages() async {
    await _messagesBox.clear();
    await _conversationsBox.clear();
  }

  Future<void> clearMediaCache() async {
    await _mediaCacheService.clear();
  }
}

class LocalStorageSnapshot {
  const LocalStorageSnapshot({
    required this.profileRecords,
    required this.feedPosts,
    required this.pendingActions,
    required this.conversations,
    required this.messages,
    required this.mediaFiles,
    required this.mediaBytes,
  });

  final int profileRecords;
  final int feedPosts;
  final int pendingActions;
  final int conversations;
  final int messages;
  final int mediaFiles;
  final int mediaBytes;

  double get mediaMegabytes => mediaBytes / (1024 * 1024);
}
