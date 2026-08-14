import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/feed/feed_post.dart';
import '../local/local_feed_repository_contract.dart';

class FeedRemoteDataSource {
  const FeedRemoteDataSource({required this.isConfigured});

  final bool isConfigured;

  static const _postFields =
      'id, user_id, content, media_url, media_type, media_urls, media_types, media_filter_id, media_filter_ids, created_at, likes_count, comments_count, views_count, refeeds_count, location, post_type, status, original_post_id, profiles:user_id(username, display_name, avatar_url)';

  Future<List<FeedPost>> fetchFeed({
    int limit = 30,
    int? beforeCreatedAtMillis,
    String? userId,
  }) async {
    if (!isConfigured) return const [];

    const fields = _postFields;
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

  Future<List<FeedPost>> fetchSavedPosts({int limit = 60}) async {
    if (!isConfigured) return const <FeedPost>[];
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return const <FeedPost>[];
    final savedRows = await client
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', userId)
        .order('created_at', ascending: false)
        .limit(limit);
    final postIds = savedRows.map((row) => row['post_id'].toString()).toList();
    if (postIds.isEmpty) return const <FeedPost>[];
    final rows = await client
        .from('posts')
        .select(_postFields)
        .eq('status', 'active')
        .inFilter('id', postIds);
    final mapped = await _mapRowsWithEngagement(
      rows.map((row) => Map<String, dynamic>.from(row)).toList(),
    );
    final byId = {for (final post in mapped) post.id: post};
    return postIds.map((id) => byId[id]).whereType<FeedPost>().toList();
  }

  Future<void> deletePost(String postId) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to delete posts.');
    await client.from('posts').delete().eq('id', postId).eq('user_id', userId);
  }

  Future<FeedSearchResults> search(String query, {int limit = 30}) async {
    if (!isConfigured) return const FeedSearchResults();
    final normalized = query.trim().replaceFirst(RegExp(r'^#'), '');
    if (normalized.isEmpty) return const FeedSearchResults();

    final client = Supabase.instance.client;
    final pattern = _postgrestPattern(normalized);
    final results = await Future.wait<dynamic>([
      client
          .from('posts')
          .select(_postFields)
          .eq('status', 'active')
          .or('content.ilike.$pattern,location.ilike.$pattern')
          .order('created_at', ascending: false)
          .limit(limit),
      client
          .from('profiles')
          .select('id, display_name, username, avatar_url, bio')
          .or('display_name.ilike.$pattern,username.ilike.$pattern')
          .limit(limit),
    ]);

    final postRows = (results[0] as List)
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
    final posts = await _mapRowsWithEngagement(postRows);
    final people = (results[1] as List)
        .whereType<Map>()
        .map((row) {
          final displayName = row['display_name']?.toString().trim();
          final username = row['username']?.toString().trim();
          return FeedSearchPerson(
            userId: row['id'].toString(),
            displayName: displayName?.isNotEmpty == true
                ? displayName!
                : username?.isNotEmpty == true
                ? username!
                : 'feedIn User',
            handle: username?.isNotEmpty == true ? username! : 'feedin_user',
            avatarUrl: row['avatar_url']?.toString(),
            bio: row['bio']?.toString(),
          );
        })
        .toList(growable: false);

    return FeedSearchResults(
      posts: posts,
      people: people,
      hashtags: _extractHashtags(posts, normalized, limit),
    );
  }

  String _postgrestPattern(String query) {
    final escaped = query
        .replaceAll('\\', r'\\')
        .replaceAll('%', r'\%')
        .replaceAll('_', r'\_')
        .replaceAll(',', r'\,')
        .replaceAll('(', r'\(')
        .replaceAll(')', r'\)');
    return '%$escaped%';
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
    final client = Supabase.instance.client;
    final viewerId = client.auth.currentUser?.id;
    final rows = await client
        .from('post_comments')
        .select(
          'id, user_id, content, created_at, parent_comment_id, likes_count, '
          'profiles!post_comments_user_id_fkey(display_name, username, avatar_url)',
        )
        .eq('post_id', postId)
        .order('created_at');
    final commentIds = rows.map((row) => row['id'].toString()).toList();
    final likedIds = <String>{};
    if (viewerId != null && commentIds.isNotEmpty) {
      final likes = await client
          .from('post_comment_likes')
          .select('comment_id')
          .eq('user_id', viewerId)
          .inFilter('comment_id', commentIds);
      likedIds.addAll(likes.map((row) => row['comment_id'].toString()));
    }
    return rows
        .map(
          (row) => _mapComment(
            Map<String, dynamic>.from(row),
            viewerHasLiked: likedIds.contains(row['id'].toString()),
          ),
        )
        .toList();
  }

  Future<FeedComment> addComment(
    String postId,
    String body, {
    String? parentCommentId,
  }) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to comment.');
    final row = await client
        .from('post_comments')
        .insert({
          'post_id': postId,
          'user_id': userId,
          'content': body.trim(),
          if (parentCommentId != null) 'parent_comment_id': parentCommentId,
        })
        .select(
          'id, user_id, content, created_at, parent_comment_id, likes_count, '
          'profiles!post_comments_user_id_fkey(display_name, username, avatar_url)',
        )
        .single();
    return _mapComment(Map<String, dynamic>.from(row));
  }

  Future<bool> toggleCommentLike(
    String commentId, {
    required bool liked,
  }) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to like comments.');
    if (liked) {
      await client
          .from('post_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);
    } else {
      await client.from('post_comment_likes').upsert({
        'comment_id': commentId,
        'user_id': userId,
      });
    }
    return !liked;
  }

  Future<void> deleteComment(String commentId) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      throw const AuthException('Sign in to delete comments.');
    }
    await client
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);
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

  Future<FeedPost> createQuoteRefeed(String postId, String quote) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) throw const AuthException('Sign in to quote posts.');
    final trimmedQuote = quote.trim();
    if (trimmedQuote.isEmpty) {
      throw const FormatException('Add a comment before posting a quote.');
    }

    final row = await client
        .from('posts')
        .insert({
          'user_id': userId,
          'original_post_id': postId,
          'content': trimmedQuote,
          'post_type': 'refeed',
          'status': 'active',
        })
        .select(_postFields)
        .single();
    final originalRow = await client
        .from('posts')
        .select(_postFields)
        .eq('id', postId)
        .single();
    return _mapPost(
      Map<String, dynamic>.from(row),
      originalPost: _mapPost(Map<String, dynamic>.from(originalRow)),
    );
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

  Future<List<FeedPost>> _mapRowsWithEngagement(
    List<Map<String, dynamic>> rows,
  ) async {
    if (rows.isEmpty) return const <FeedPost>[];
    final client = Supabase.instance.client;
    final postIds = rows.map((row) => row['id'].toString()).toList();
    final viewerId = client.auth.currentUser?.id;
    final likedIds = <String>{};
    final savedIds = <String>{};
    final refeededIds = <String>{};
    if (viewerId != null) {
      final engagement = await Future.wait<dynamic>([
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
      likedIds.addAll(
        (engagement[0] as List).map((row) => row['post_id'].toString()),
      );
      savedIds.addAll(
        (engagement[1] as List).map((row) => row['post_id'].toString()),
      );
      refeededIds.addAll(
        (engagement[2] as List).map(
          (row) => row['original_post_id'].toString(),
        ),
      );
    }

    return rows
        .map(
          (row) => _mapPost(
            row,
            viewerHasLiked: likedIds.contains(row['id'].toString()),
            viewerHasSaved: savedIds.contains(row['id'].toString()),
            viewerHasRefeeded: refeededIds.contains(row['id'].toString()),
          ),
        )
        .toList(growable: false);
  }

  List<FeedSearchHashtag> _extractHashtags(
    List<FeedPost> posts,
    String query,
    int limit,
  ) {
    final counts = <String, int>{};
    final pattern = RegExp(r'#[A-Za-z0-9_]+');
    final needle = query.toLowerCase();
    for (final post in posts) {
      for (final match in pattern.allMatches(post.displayedPost.body)) {
        final tag = match.group(0)!.substring(1).toLowerCase();
        if (!tag.contains(needle)) continue;
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    final entries = counts.entries.toList()
      ..sort((a, b) {
        final byCount = b.value.compareTo(a.value);
        return byCount != 0 ? byCount : a.key.compareTo(b.key);
      });
    return entries
        .take(limit)
        .map(
          (entry) => FeedSearchHashtag(tag: entry.key, postCount: entry.value),
        )
        .toList(growable: false);
  }

  FeedComment _mapComment(
    Map<String, dynamic> row, {
    bool viewerHasLiked = false,
  }) {
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
      parentCommentId: row['parent_comment_id']?.toString(),
      likesCount: _intValue(row['likes_count']),
      viewerHasLiked: viewerHasLiked,
    );
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
      mediaFilterId: row['media_filter_id']?.toString(),
      mediaFilterIds: _stringList(row['media_filter_ids']),
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
