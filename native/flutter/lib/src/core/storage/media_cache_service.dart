import 'dart:io';

import 'package:crypto/crypto.dart';
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

  Future<String?> cacheRemoteMedia(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme) return null;

    final extension = _extensionFor(uri.path);
    final fileName = '${sha1.convert(url.codeUnits)}$extension';
    final directory = await mediaCacheDirectory();
    final file = File('${directory.path}/$fileName');

    if (file.existsSync() && await file.length() > 0) {
      return file.path;
    }

    final request = await HttpClient().getUrl(uri);
    final response = await request.close();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return null;
    }

    await response.pipe(file.openWrite());
    return file.path;
  }

  Future<void> clear() async {
    final directory = await mediaCacheDirectory();
    if (directory.existsSync()) {
      await directory.delete(recursive: true);
    }
    await directory.create(recursive: true);
  }

  String _extensionFor(String path) {
    final lastSegment = path.split('/').last;
    final dotIndex = lastSegment.lastIndexOf('.');
    if (dotIndex == -1 || dotIndex == lastSegment.length - 1) {
      return '';
    }
    return lastSegment.substring(dotIndex).split('?').first;
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
