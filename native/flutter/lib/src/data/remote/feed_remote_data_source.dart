import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/feed/feed_post.dart';

class FeedRemoteDataSource {
  const FeedRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  Future<List<FeedPost>> fetchFeed({
    int limit = 30,
    int? beforeCreatedAtMillis,
    String? userId,
  }) async {
    if (!isConfigured) return const [];

    const fields =
        'id, user_id, content, media_url, media_type, media_urls, media_types, created_at, likes_count, comments_count, views_count, refeeds_count, location, post_type, status, profiles:user_id(username, display_name, avatar_url)';
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
    final userFilteredQuery = userId == null
        ? filteredQuery
        : filteredQuery.eq('user_id', userId);
    final response = await userFilteredQuery
        .eq('status', 'active')
        .order('created_at', ascending: false)
        .limit(limit);

    return response.map(_mapPost).toList();
  }

  Future<List<LiveFeedItem>> fetchLiveItems() async {
    if (!isConfigured) return const [];

    final client = Supabase.instance.client;
    final streams = await client
        .from('live_streams')
        .select('id, title, status, viewer_count, thumbnail_url, user_id')
        .ilike('status', 'live')
        .order('viewer_count', ascending: false)
        .limit(20);
    final spaces = await client
        .from('live_spaces')
        .select('id, title, status, viewer_count, topic_category, user_id')
        .ilike('status', 'live')
        .order('viewer_count', ascending: false)
        .limit(20);

    final userIds = <String>{
      ...streams.map((row) => row['user_id']?.toString()).whereType<String>(),
      ...spaces.map((row) => row['user_id']?.toString()).whereType<String>(),
    };
    final profiles = userIds.isEmpty
        ? const <Map<String, dynamic>>[]
        : await client
              .from('profiles')
              .select('id, display_name, username')
              .inFilter('id', userIds.toList());
    final profileMap = {
      for (final profile in profiles)
        profile['id'].toString():
            profile['display_name']?.toString() ??
            profile['username']?.toString() ??
            'feedIn Host',
    };

    final items = [
      ...streams.map(
        (row) => LiveFeedItem(
          id: row['id'].toString(),
          title: row['title']?.toString() ?? 'Live stream',
          type: 'video',
          viewerCount: _intValue(row['viewer_count']),
          hostName: profileMap[row['user_id']?.toString()] ?? 'feedIn Host',
          thumbnailUrl: row['thumbnail_url']?.toString(),
        ),
      ),
      ...spaces.map(
        (row) => LiveFeedItem(
          id: row['id'].toString(),
          title: row['title']?.toString() ?? 'Live space',
          type: 'space',
          viewerCount: _intValue(row['viewer_count']),
          hostName: profileMap[row['user_id']?.toString()] ?? 'feedIn Host',
          topic: row['topic_category']?.toString(),
        ),
      ),
    ]..sort((a, b) => b.viewerCount.compareTo(a.viewerCount));

    return items;
  }

  FeedPost _mapPost(Map<String, dynamic> row) {
    final profile = row['profiles'];
    final username = profile is Map
        ? (profile['username'] as String?)?.trim()
        : null;
    final displayName = profile is Map
        ? (profile['display_name'] as String?)?.trim()
        : null;
    final avatarUrl = profile is Map
        ? (profile['avatar_url'] as String?)?.trim()
        : null;

    final authorName = (displayName != null && displayName.isNotEmpty)
        ? displayName
        : (username != null && username.isNotEmpty)
        ? username
        : 'feedIn User';
    final authorHandle = (username != null && username.isNotEmpty)
        ? '@$username'
        : null;

    return FeedPost(
      id: row['id'].toString(),
      userId: row['user_id']?.toString() ?? '',
      authorName: authorName,
      body: row['content']?.toString() ?? '',
      meta: authorHandle ?? 'Synced from server',
      avatarUrl: (avatarUrl != null && avatarUrl.isNotEmpty) ? avatarUrl : null,
      authorHandle: authorHandle,
      mediaUrl: row['media_url']?.toString(),
      mediaType: row['media_type']?.toString(),
      mediaUrls: _stringList(row['media_urls']),
      mediaTypes: _stringList(row['media_types']),
      likesCount: _intValue(row['likes_count']),
      commentsCount: _intValue(row['comments_count']),
      viewsCount: _intValue(row['views_count']),
      refeedsCount: _intValue(row['refeeds_count']),
      location: row['location']?.toString(),
      postType: row['post_type']?.toString(),
      createdAtMillis:
          DateTime.tryParse(
            row['created_at']?.toString() ?? '',
          )?.millisecondsSinceEpoch ??
          DateTime.now().millisecondsSinceEpoch,
    );
  }

  List<String> _stringList(Object? value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }
    return const [];
  }

  int _intValue(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}
