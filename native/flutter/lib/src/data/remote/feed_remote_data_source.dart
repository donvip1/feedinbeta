import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/feed/feed_post.dart';

class FeedRemoteDataSource {
  const FeedRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<List<FeedPost>> fetchFeed({
    int limit = 30,
    int? beforeCreatedAtMillis,
  }) async {
    if (!isConfigured) return const [];

    const fields =
        'id, content, media_url, media_type, created_at, user_id, profiles(display_name, username)';
    final query = Supabase.instance.client.from('posts').select(fields);
    final filteredQuery = beforeCreatedAtMillis == null
        ? query
        : query.lt(
            'created_at',
            DateTime.fromMillisecondsSinceEpoch(
              beforeCreatedAtMillis,
              isUtc: true,
            ).toIso8601String(),
          );
    final response = await filteredQuery
        .order('created_at', ascending: false)
        .limit(limit);

    return response.map(_mapPost).toList();
  }

  FeedPost _mapPost(Map<String, dynamic> row) {
    final profile = row['profiles'];
    final authorName = profile is Map
        ? (profile['display_name'] as String?) ??
              (profile['username'] as String?) ??
              'FEEDIN User'
        : 'FEEDIN User';

    return FeedPost(
      id: row['id'].toString(),
      authorName: authorName,
      body: row['content']?.toString() ?? '',
      meta: 'Synced from server',
      mediaUrl: row['media_url']?.toString(),
      mediaType: row['media_type']?.toString(),
      createdAtMillis:
          DateTime.tryParse(
            row['created_at']?.toString() ?? '',
          )?.millisecondsSinceEpoch ??
          DateTime.now().millisecondsSinceEpoch,
    );
  }
}
