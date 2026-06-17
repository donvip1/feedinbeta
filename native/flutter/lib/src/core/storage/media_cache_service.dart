import 'dart:io';

import 'package:path_provider/path_provider.dart';

class MediaCacheService {
  const MediaCacheService();

  static const cacheDirectoryName = 'feedin_media_cache';

  Future<Directory> mediaCacheDirectory() async {
    final root = await getApplicationCacheDirectory();
    final directory = Directory('${root.path}/$cacheDirectoryName');
    if (!directory.existsSync()) {
      await directory.create(recursive: true);
    }
    return directory;
  }

  Future<MediaCacheSnapshot> snapshot() async {
    final directory = await mediaCacheDirectory();
    var fileCount = 0;
    var totalBytes = 0;

    await for (final entity in directory.list(recursive: true)) {
      if (entity is! File) continue;
      fileCount++;
      totalBytes += await entity.length();
    }

    return MediaCacheSnapshot(fileCount: fileCount, totalBytes: totalBytes);
  }

  Future<void> clear() async {
    final directory = await mediaCacheDirectory();
    if (directory.existsSync()) {
      await directory.delete(recursive: true);
    }
    await directory.create(recursive: true);
  }
}

class MediaCacheSnapshot {
  const MediaCacheSnapshot({
    required this.fileCount,
    required this.totalBytes,
  });

  final int fileCount;
  final int totalBytes;

  double get totalMegabytes => totalBytes / (1024 * 1024);
}
