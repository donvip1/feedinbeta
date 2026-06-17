import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/feed/feed_post.dart';

class FeedRemoteDataSource {
  const FeedRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<List<FeedPost>> fetchFeed() async {
    if (!isConfigured) return const [];

    final response = await Supabase.instance.client
        .from('posts')
        .select('id, content, created_at, user_id, profiles(display_name, username)')
        .order('created_at', ascending: false)
        .limit(30);

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
      createdAtMillis:
          DateTime.tryParse(
            row['created_at']?.toString() ?? '',
          )?.millisecondsSinceEpoch ??
          DateTime.now().millisecondsSinceEpoch,
    );
  }
}
