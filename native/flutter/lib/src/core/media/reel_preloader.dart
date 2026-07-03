import 'dart:async';

import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// Pre-fetches upcoming reel videos to disk so that, by the time the user swipes
/// to them, playback starts from a local file instead of a cold network stream
/// (TikTok-style instant start).
///
/// The feed pager calls [preloadAround] on every page change with the upcoming
/// reel URLs; the immersive player calls [cachedFileFor] to use an
/// already-downloaded file when one is ready. Backed by
/// [DefaultCacheManager] (also used by cached_network_image), so the video and
/// image caches share one on-disk store with sane eviction.
///
/// Everything is best-effort: a failed prefetch is swallowed and the player
/// simply falls back to streaming the network URL.
class ReelPreloader {
  ReelPreloader._();

  static final ReelPreloader instance = ReelPreloader._();

  final BaseCacheManager _cache = DefaultCacheManager();

  /// URLs currently being downloaded, so we don't kick off duplicate fetches.
  final Set<String> _inFlight = {};

  /// How many upcoming reels to warm ahead of the active one.
  static const int _lookahead = 3;

  /// Warm the next [_lookahead] reels given the full ordered list of reel URLs
  /// and the [activeIndex] currently on screen. Null/empty URLs are skipped.
  void preloadAround(List<String?> reelUrls, int activeIndex) {
    for (var offset = 1; offset <= _lookahead; offset++) {
      final index = activeIndex + offset;
      if (index < 0 || index >= reelUrls.length) break;
      final url = reelUrls[index];
      if (url != null && url.isNotEmpty) {
        unawaited(_warm(url));
      }
    }
  }

  Future<void> _warm(String url) async {
    if (_inFlight.contains(url)) return;
    _inFlight.add(url);
    try {
      // Downloads to the shared cache if not already present; no-op when cached.
      await _cache.downloadFile(url);
    } catch (_) {
      // Ignore — the player will stream the URL directly.
    } finally {
      _inFlight.remove(url);
    }
  }

  /// Returns the local cached file path for [url] if it's already fully
  /// downloaded, otherwise null (the caller then streams the URL).
  Future<String?> cachedFileFor(String? url) async {
    if (url == null || url.isEmpty) return null;
    try {
      final info = await _cache.getFileFromCache(url);
      final file = info?.file;
      if (file != null && file.existsSync() && file.lengthSync() > 0) {
        return file.path;
      }
    } catch (_) {
      // ignore
    }
    return null;
  }
}
