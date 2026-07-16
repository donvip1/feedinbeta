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
        'id, user_id, content, media_url, media_type, media_urls, media_types, created_at, likes_count, comments_count, views_count, refeeds_count, location, post_type, status, original_post_id, profiles:user_id(username, display_name, avatar_url)';
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

    final rows = response.map((row) => Map<String, dynamic>.from(row)).toList();
    final originalIds = rows
        .map((row) => row['original_post_id']?.toString())
        .whereType<String>()
        .toSet();
    final originalRows = originalIds.isEmpty
        ? const <Map<String, dynamic>>[]
        : (await Supabase.instance.client
                  .from('posts')
                  .select(fields)
                  .inFilter('id', originalIds.toList()))
              .map((row) => Map<String, dynamic>.from(row))
              .toList();
    final allRows = [...rows, ...originalRows];
    final postIds = allRows
        .map((row) => row['id']?.toString())
        .whereType<String>()
        .toSet()
        .toList();
    final client = Supabase.instance.client;
    final viewerId = client.auth.currentUser?.id;
    final likedIds = <String>{};
    final savedIds = <String>{};
    final refeededIds = <String>{};
    if (viewerId != null && postIds.isNotEmpty) {
      final engagement = await Future.wait([
        client
            .from('post_likes')
            .select('post_id')
            .eq('user_id', viewerId)
            .inFilter('post_id', postIds),
        client
            .from('saved_posts')
            .select('post_id')
            .eq('user_id', viewerId)
            .inFilter('post_id', postIds),
        client
            .from('posts')
            .select('original_post_id')
            .eq('user_id', viewerId)
            .eq('post_type', 'refeed')
            .inFilter('original_post_id', postIds),
      ]);
      likedIds.addAll(engagement[0].map((row) => row['post_id'].toString()));
      savedIds.addAll(engagement[1].map((row) => row['post_id'].toString()));
      refeededIds.addAll(
        engagement[2].map((row) => row['original_post_id'].toString()),
      );
    }
    final mappedOriginals = <String, FeedPost>{};
    for (final row in originalRows) {
      final id = row['id'].toString();
      mappedOriginals[id] = _mapPost(
        row,
        viewerHasLiked: likedIds.contains(id),
        viewerHasSaved: savedIds.contains(id),
        viewerHasRefeeded: refeededIds.contains(id),
      );
    }
    return rows
        .map(
          (row) => _mapPost(
            row,
            viewerHasLiked: likedIds.contains(row['id'].toString()),
            viewerHasSaved: savedIds.contains(row['id'].toString()),
            viewerHasRefeeded: refeededIds.contains(row['id'].toString()),
            originalPost: mappedOriginals[row['original_post_id']?.toString()],
          ),
        )
        .toList();
  }

  Future<bool> toggleLike(String postId, {required bool liked}) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to like posts.');
    if (liked) {
      await client
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
    } else {
      await client.from('post_likes').upsert({
        'post_id': postId,
        'user_id': userId,
      });
    }
    return !liked;
  }

  Future<bool> toggleSave(String postId, {required bool saved}) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to save posts.');
    if (saved) {
      await client
          .from('saved_posts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
    } else {
      await client.from('saved_posts').upsert({
        'post_id': postId,
        'user_id': userId,
      });
    }
    return !saved;
  }

  Future<List<FeedComment>> fetchComments(String postId) async {
    final rows = await Supabase.instance.client
        .from('post_comments')
        .select(
          'id, user_id, content, created_at, '
          'profiles!post_comments_user_id_fkey(display_name, username, avatar_url)',
        )
        .eq('post_id', postId)
        .order('created_at');
    return rows.map((row) {
      final profile = row['profiles'];
      final displayName = profile is Map
          ? profile['display_name']?.toString()
          : null;
      final username = profile is Map ? profile['username']?.toString() : null;
      return FeedComment(
        id: row['id'].toString(),
        userId: row['user_id'].toString(),
        authorName: displayName?.isNotEmpty == true
            ? displayName!
            : username?.isNotEmpty == true
            ? username!
            : 'feedIn User',
        authorHandle: username?.isNotEmpty == true ? '@$username' : null,
        content: row['content']?.toString() ?? '',
        createdAtMillis:
            DateTime.tryParse(
              row['created_at']?.toString() ?? '',
            )?.millisecondsSinceEpoch ??
            DateTime.now().millisecondsSinceEpoch,
        avatarUrl: profile is Map ? profile['avatar_url']?.toString() : null,
      );
    }).toList();
  }

  Future<FeedComment> addComment(String postId, String body) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to comment.');
    final row = await client
        .from('post_comments')
        .insert({'post_id': postId, 'user_id': userId, 'content': body.trim()})
        .select(
          'id, user_id, content, created_at, '
          'profiles!post_comments_user_id_fkey(display_name, username, avatar_url)',
        )
        .single();
    final profile = row['profiles'];
    final displayName = profile is Map
        ? profile['display_name']?.toString()
        : null;
    final username = profile is Map ? profile['username']?.toString() : null;
    return FeedComment(
      id: row['id'].toString(),
      userId: userId,
      authorName: displayName?.isNotEmpty == true
          ? displayName!
          : username?.isNotEmpty == true
          ? username!
          : 'feedIn User',
      authorHandle: username?.isNotEmpty == true ? '@$username' : null,
      content: row['content']?.toString() ?? body.trim(),
      createdAtMillis:
          DateTime.tryParse(
            row['created_at']?.toString() ?? '',
          )?.millisecondsSinceEpoch ??
          DateTime.now().millisecondsSinceEpoch,
      avatarUrl: profile is Map ? profile['avatar_url']?.toString() : null,
    );
  }

  Future<bool> toggleRefeed(String postId, {required bool refeeded}) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to re-share posts.');
    if (refeeded) {
      await client
          .from('posts')
          .delete()
          .eq('user_id', userId)
          .eq('post_type', 'refeed')
          .eq('original_post_id', postId);
    } else {
      await client.from('posts').insert({
        'user_id': userId,
        'original_post_id': postId,
        'content': '',
        'post_type': 'refeed',
        'status': 'active',
      });
    }
    return !refeeded;
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

  FeedPost _mapPost(
    Map<String, dynamic> row, {
    bool viewerHasLiked = false,
    bool viewerHasSaved = false,
    bool viewerHasRefeeded = false,
    FeedPost? originalPost,
  }) {
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
      originalPostId: row['original_post_id']?.toString(),
      originalPost: originalPost,
      viewerHasLiked: viewerHasLiked,
      viewerHasSaved: viewerHasSaved,
      viewerHasRefeeded: viewerHasRefeeded,
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
