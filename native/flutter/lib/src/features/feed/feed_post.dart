class FeedPost {
  const FeedPost({
    required this.id,
    required this.userId,
    required this.authorName,
    required this.body,
    required this.meta,
    required this.createdAtMillis,
    this.mediaUrl,
    this.mediaType,
    this.mediaUrls = const [],
    this.mediaTypes = const [],
    this.localMediaPath,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.viewsCount = 0,
    this.refeedsCount = 0,
    this.location,
    this.postType,
    this.avatarUrl,
    this.authorHandle,
  });

  final String id;
  final String userId;
  final String authorName;
  final String body;
  final String meta;
  final int createdAtMillis;
  final String? mediaUrl;
  final String? mediaType;
  final List<String> mediaUrls;
  final List<String> mediaTypes;
  final String? localMediaPath;
  final int likesCount;
  final int commentsCount;
  final int viewsCount;
  final int refeedsCount;
  final String? location;
  final String? postType;

  /// Author avatar image URL from the `profiles` join. Null when the author
  /// has no avatar set (the UI falls back to a brand-gradient initial).
  final String? avatarUrl;

  /// Author handle (e.g. `@username`) from the `profiles` join, if available.
  final String? authorHandle;

  FeedPost copyWith({String? localMediaPath}) {
    return FeedPost(
      id: id,
      userId: userId,
      authorName: authorName,
      body: body,
      meta: meta,
      createdAtMillis: createdAtMillis,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      mediaUrls: mediaUrls,
      mediaTypes: mediaTypes,
      localMediaPath: localMediaPath ?? this.localMediaPath,
      likesCount: likesCount,
      commentsCount: commentsCount,
      viewsCount: viewsCount,
      refeedsCount: refeedsCount,
      location: location,
      postType: postType,
      avatarUrl: avatarUrl,
      authorHandle: authorHandle,
    );
  }

  factory FeedPost.fromJson(Map<String, Object?> json) {
    return FeedPost(
      id: json['id'] as String,
      userId: json['userId'] as String? ?? '',
      authorName: json['authorName'] as String,
      body: json['body'] as String,
      meta: json['meta'] as String,
      createdAtMillis: json['createdAtMillis'] as int,
      mediaUrl: json['mediaUrl'] as String?,
      mediaType: json['mediaType'] as String?,
      mediaUrls:
          (json['mediaUrls'] as List?)?.whereType<String>().toList() ??
          const [],
      mediaTypes:
          (json['mediaTypes'] as List?)?.whereType<String>().toList() ??
          const [],
      localMediaPath: json['localMediaPath'] as String?,
      likesCount: json['likesCount'] as int? ?? 0,
      commentsCount: json['commentsCount'] as int? ?? 0,
      viewsCount: json['viewsCount'] as int? ?? 0,
      refeedsCount: json['refeedsCount'] as int? ?? 0,
      location: json['location'] as String?,
      postType: json['postType'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      authorHandle: json['authorHandle'] as String?,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'userId': userId,
      'authorName': authorName,
      'body': body,
      'meta': meta,
      'createdAtMillis': createdAtMillis,
      'mediaUrl': mediaUrl,
      'mediaType': mediaType,
      'mediaUrls': mediaUrls,
      'mediaTypes': mediaTypes,
      'localMediaPath': localMediaPath,
      'likesCount': likesCount,
      'commentsCount': commentsCount,
      'viewsCount': viewsCount,
      'refeedsCount': refeedsCount,
      'location': location,
      'postType': postType,
      'avatarUrl': avatarUrl,
      'authorHandle': authorHandle,
    };
  }
}

class LiveFeedItem {
  const LiveFeedItem({
    required this.id,
    required this.title,
    required this.type,
    required this.viewerCount,
    required this.hostName,
    this.thumbnailUrl,
    this.topic,
  });

  final String id;
  final String title;
  final String type;
  final int viewerCount;
  final String hostName;
  final String? thumbnailUrl;
  final String? topic;
}
