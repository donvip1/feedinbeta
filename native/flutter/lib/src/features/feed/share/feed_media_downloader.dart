import 'dart:io';

import 'package:flutter/foundation.dart' show consolidateHttpClientResponseBytes;
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';

/// Raised when saving post media to the gallery fails, with a user-facing
/// [message].
class MediaDownloadException implements Exception {
  const MediaDownloadException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Seam over the platform photo gallery so [FeedMediaDownloader] can be unit
/// tested without touching the real photo library.
abstract interface class MediaSaverGateway {
  Future<bool> hasAccess();
  Future<bool> requestAccess();
  Future<void> saveImage(String path);
  Future<void> saveVideo(String path);
}

/// Real gallery gateway backed by the `gal` package.
class GalMediaSaverGateway implements MediaSaverGateway {
  const GalMediaSaverGateway();

  @override
  Future<bool> hasAccess() => Gal.hasAccess();

  @override
  Future<bool> requestAccess() => Gal.requestAccess();

  @override
  Future<void> saveImage(String path) => Gal.putImage(path);

  @override
  Future<void> saveVideo(String path) => Gal.putVideo(path);
}

/// Downloads a post's media to a temp file and saves it to the device gallery.
///
/// Phase 1 saves the RAW media (no watermark). Web parity watermarking
/// (`addWatermarkToMedia`) is a deferred follow-up — images via compositing,
/// video via ffmpeg. All I/O is injectable so the routing logic is testable.
class FeedMediaDownloader {
  FeedMediaDownloader({
    this.gateway = const GalMediaSaverGateway(),
    Future<List<int>> Function(Uri url)? fetchBytes,
    Future<Directory> Function()? tempDirProvider,
  }) : _fetchBytes = fetchBytes,
       _tempDirProvider = tempDirProvider;

  final MediaSaverGateway gateway;
  final Future<List<int>> Function(Uri url)? _fetchBytes;
  final Future<Directory> Function()? _tempDirProvider;

  /// Downloads [url] and saves it to the gallery. [isVideo] selects the video
  /// vs image bucket and the fallback extension. Throws [MediaDownloadException]
  /// on any failure (empty url, permission denied, network, save error).
  Future<void> saveToGallery({
    required String url,
    required bool isVideo,
  }) async {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      throw const MediaDownloadException('No media to download.');
    }

    if (!await gateway.hasAccess()) {
      final granted = await gateway.requestAccess();
      if (!granted) {
        throw const MediaDownloadException(
          'Allow gallery access to download.',
        );
      }
    }

    final file = await _downloadToTemp(trimmed, isVideo: isVideo);
    try {
      if (isVideo) {
        await gateway.saveVideo(file.path);
      } else {
        await gateway.saveImage(file.path);
      }
    } on GalException {
      throw const MediaDownloadException('Could not save to your gallery.');
    }
  }

  Future<File> _downloadToTemp(String url, {required bool isVideo}) async {
    final uri = Uri.parse(url);
    final bytes = await (_fetchBytes?.call(uri) ?? _httpGet(uri));
    final dir = await (_tempDirProvider?.call() ?? getTemporaryDirectory());
    final ext = _extensionFor(url, isVideo: isVideo);
    final file = File(
      '${dir.path}/feedin_${DateTime.now().millisecondsSinceEpoch}.$ext',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  Future<List<int>> _httpGet(Uri uri) async {
    final client = HttpClient();
    try {
      final request = await client.getUrl(uri);
      final response = await request.close();
      if (response.statusCode != HttpStatus.ok) {
        throw MediaDownloadException('Download failed (${response.statusCode}).');
      }
      return await consolidateHttpClientResponseBytes(response);
    } on MediaDownloadException {
      rethrow;
    } on Object {
      throw const MediaDownloadException('Could not download the media.');
    } finally {
      client.close();
    }
  }

  String _extensionFor(String url, {required bool isVideo}) {
    final path = Uri.tryParse(url)?.path ?? url;
    final dot = path.lastIndexOf('.');
    if (dot != -1 && dot >= path.length - 5) {
      final ext = path.substring(dot + 1).toLowerCase();
      if (ext.isNotEmpty && ext.length <= 4) return ext;
    }
    return isVideo ? 'mp4' : 'jpg';
  }
}
