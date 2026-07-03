import 'dart:io';

import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_compress/video_compress.dart';

/// Compresses picked media before upload to cut bandwidth and speed up feed
/// loads: images → WebP, videos → an optimised MP4. Every path is guarded so a
/// compression failure (unsupported codec, platform quirk, headless test) falls
/// back to the original file — an upload must never fail because compression did.
///
/// WebP + MP4 are both on the `post-media` bucket's allowed_mime_types list.
class MediaCompressor {
  const MediaCompressor();

  /// Returns a [CompressedMedia] for [sourcePath]. [mediaKind] is the draft's
  /// media type ('image' | 'video'); anything else is passed through untouched.
  Future<CompressedMedia> compressForUpload(
    String sourcePath,
    String mediaKind,
  ) async {
    try {
      if (mediaKind == 'video') {
        return await _compressVideo(sourcePath) ?? _passthrough(sourcePath);
      }
      if (mediaKind == 'image') {
        return await _compressImage(sourcePath) ?? _passthrough(sourcePath);
      }
    } catch (_) {
      // fall through to passthrough
    }
    return _passthrough(sourcePath);
  }

  Future<CompressedMedia?> _compressImage(String sourcePath) async {
    final dir = await getTemporaryDirectory();
    final target =
        '${dir.path}/cmp_${DateTime.now().millisecondsSinceEpoch}.webp';
    final result = await FlutterImageCompress.compressAndGetFile(
      sourcePath,
      target,
      format: CompressFormat.webp,
      quality: 80,
      // Cap the longest edge so oversized camera shots don't bloat the feed.
      minWidth: 1440,
      minHeight: 1440,
    );
    if (result == null) return null;
    final compressed = File(result.path);
    if (!compressed.existsSync() || compressed.lengthSync() == 0) return null;
    // Only keep the compressed copy if it's actually smaller.
    final original = File(sourcePath);
    if (original.existsSync() &&
        compressed.lengthSync() >= original.lengthSync()) {
      return _passthrough(sourcePath);
    }
    return CompressedMedia(
      path: result.path,
      extension: 'webp',
      contentType: 'image/webp',
    );
  }

  Future<CompressedMedia?> _compressVideo(String sourcePath) async {
    final info = await VideoCompress.compressVideo(
      sourcePath,
      quality: VideoQuality.MediumQuality,
      deleteOrigin: false,
      includeAudio: true,
    );
    final path = info?.path;
    if (path == null) return null;
    final compressed = File(path);
    if (!compressed.existsSync() || compressed.lengthSync() == 0) return null;
    final original = File(sourcePath);
    if (original.existsSync() &&
        compressed.lengthSync() >= original.lengthSync()) {
      return _passthrough(sourcePath);
    }
    return CompressedMedia(
      path: path,
      extension: 'mp4',
      contentType: 'video/mp4',
    );
  }

  CompressedMedia _passthrough(String sourcePath) {
    final ext = sourcePath.contains('.')
        ? sourcePath.split('.').last.toLowerCase()
        : 'bin';
    return CompressedMedia(path: sourcePath, extension: ext, contentType: null);
  }
}

/// The result of a compression pass: a file to upload plus its extension and
/// (when known) content type. [contentType] is null for passthrough files so the
/// caller keeps its existing extension-based content-type resolution.
class CompressedMedia {
  const CompressedMedia({
    required this.path,
    required this.extension,
    required this.contentType,
  });

  final String path;
  final String extension;
  final String? contentType;
}
