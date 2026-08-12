import 'dart:async';
import 'dart:convert';
import 'dart:io';

/// A single GIF result from Tenor, reduced to what the picker needs.
class GifResult {
  const GifResult({
    required this.id,
    required this.previewUrl,
    required this.gifUrl,
    this.description = 'GIF',
  });

  /// Small looping preview shown in the picker grid.
  final String previewUrl;

  /// Full-size GIF URL that gets posted.
  final String gifUrl;
  final String id;
  final String description;
}

/// Thin Tenor v2 client for the in-app GIF picker.
///
/// Tenor is Google's GIF service; a free API key is supplied via
/// `--dart-define=FEEDIN_TENOR_API_KEY=…` and surfaced through
/// [FeedinConfig.tenorApiKey]. When no key is configured the picker is never
/// shown, so this service is only constructed with a non-empty key.
class GifService {
  GifService({required this.apiKey, HttpClient? client})
    : _client = client ?? HttpClient();

  final String apiKey;
  final HttpClient _client;

  static const _host = 'tenor.googleapis.com';
  static const _clientKey = 'feedin-native';

  /// Trending/featured GIFs for the empty search state.
  Future<List<GifResult>> featured({int limit = 24}) {
    return _get('/v2/featured', {'limit': '$limit'});
  }

  /// Search GIFs for [query].
  Future<List<GifResult>> search(String query, {int limit = 24}) {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return featured(limit: limit);
    return _get('/v2/search', {'q': trimmed, 'limit': '$limit'});
  }

  Future<List<GifResult>> _get(String path, Map<String, String> params) async {
    final uri = Uri.https(_host, path, {
      'key': apiKey,
      'client_key': _clientKey,
      'media_filter': 'tinygif,gif',
      'contentfilter': 'high',
      ...params,
    });
    try {
      final request = await _client.getUrl(uri);
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return const [];
      }
      final body = await response.transform(utf8.decoder).join();
      final decoded = jsonDecode(body);
      final results = (decoded is Map && decoded['results'] is List)
          ? decoded['results'] as List
          : const [];
      return results
          .map(_parse)
          .whereType<GifResult>()
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }

  GifResult? _parse(dynamic raw) {
    if (raw is! Map) return null;
    final formats = raw['media_formats'];
    if (formats is! Map) return null;
    String? url(String key) {
      final entry = formats[key];
      if (entry is Map && entry['url'] is String) return entry['url'] as String;
      return null;
    }

    final gif = url('gif') ?? url('mediumgif') ?? url('tinygif');
    final preview = url('tinygif') ?? url('nanogif') ?? gif;
    if (gif == null || preview == null) return null;
    return GifResult(
      id: raw['id']?.toString() ?? gif,
      previewUrl: preview,
      gifUrl: gif,
      description: (raw['content_description'] as String?)?.trim().isNotEmpty ==
              true
          ? raw['content_description'] as String
          : 'GIF',
    );
  }

  void dispose() => _client.close(force: true);
}
