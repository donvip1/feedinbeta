class FeedPostMedia {
  const FeedPostMedia({
    required this.url,
    required this.type,
    required this.filterId,
    this.localPath,
  });

  final String url;
  final String type;
  final String filterId;
  final String? localPath;

  bool get isVideo => type == 'video';
  bool get isImage => !isVideo;
}

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
    this.mediaFilterId,
    this.mediaFilterIds = const [],
    this.localMediaPath,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.viewsCount = 0,
    this.refeedsCount = 0,
    this.location,
    this.postType,
    this.avatarUrl,
    this.authorHandle,
    this.originalPostId,
    this.originalPost,
    this.viewerHasLiked = false,
    this.viewerHasSaved = false,
    this.viewerHasRefeeded = false,
    this.isPromoted = false,
    this.isTrending = false,
    this.isNewPost = false,
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
  final String? mediaFilterId;
  final List<String> mediaFilterIds;
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
  final String? originalPostId;
  final FeedPost? originalPost;
  final bool viewerHasLiked;
  final bool viewerHasSaved;
  final bool viewerHasRefeeded;

  /// Ranking flags supplied by the server feed engine (`feed-engine`). Default
  /// false for locally-cached / reverse-chron posts. Used only for badging
  /// ("Promoted" / "Trending"); ordering is decided server-side.
  final bool isPromoted;
  final bool isTrending;
  final bool isNewPost;

  /// Media/original content represented by this Feed row.
  ///
  /// Refeed rows are wrappers. Their media comes from [originalPost], while the
  /// wrapper's author and body remain meaningful for Quote Refeeds.
  FeedPost get displayedPost => originalPost ?? this;

  bool get isRefeed => originalPost != null || originalPostId != null;

  bool get isQuoteRefeed =>
      isRefeed && body.trim().isNotEmpty && originalPost != null;

  List<FeedPostMedia> get normalizedMedia {
    final urls = <String>[];
    for (final value in mediaUrls) {
      final trimmed = value.trim();
      if (trimmed.isNotEmpty && !urls.contains(trimmed)) urls.add(trimmed);
    }
    final legacyUrl = mediaUrl?.trim();
    if (urls.isEmpty && legacyUrl != null && legacyUrl.isNotEmpty) {
      urls.add(legacyUrl);
    }

    return [
      for (final (index, url) in urls.indexed)
        FeedPostMedia(
          url: url,
          type: index < mediaTypes.length && mediaTypes[index].trim().isNotEmpty
              ? mediaTypes[index].trim().toLowerCase()
              : index == 0 && mediaType?.trim().isNotEmpty == true
              ? mediaType!.trim().toLowerCase()
              : 'image',
          filterId:
              index < mediaFilterIds.length &&
                  mediaFilterIds[index].trim().isNotEmpty
              ? mediaFilterIds[index].trim()
              : index == 0 && mediaFilterId?.trim().isNotEmpty == true
              ? mediaFilterId!.trim()
              : 'original',
          localPath: index == 0 ? localMediaPath : null,
        ),
    ];
  }

  bool get hasVideoMedia => normalizedMedia.any((media) => media.isVideo);

  bool get isPhotoOnly {
    final media = normalizedMedia;
    return media.isNotEmpty && media.every((item) => item.isImage);
  }

  FeedPost copyWith({
    String? localMediaPath,
    int? likesCount,
    int? commentsCount,
    int? refeedsCount,
    bool? viewerHasLiked,
    bool? viewerHasSaved,
    bool? viewerHasRefeeded,
    FeedPost? originalPost,
  }) {
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
      mediaFilterId: mediaFilterId,
      mediaFilterIds: mediaFilterIds,
      localMediaPath: localMediaPath ?? this.localMediaPath,
      likesCount: likesCount ?? this.likesCount,
      commentsCount: commentsCount ?? this.commentsCount,
      viewsCount: viewsCount,
      refeedsCount: refeedsCount ?? this.refeedsCount,
      location: location,
      postType: postType,
      avatarUrl: avatarUrl,
      authorHandle: authorHandle,
      originalPostId: originalPostId,
      originalPost: originalPost ?? this.originalPost,
      viewerHasLiked: viewerHasLiked ?? this.viewerHasLiked,
      viewerHasSaved: viewerHasSaved ?? this.viewerHasSaved,
      viewerHasRefeeded: viewerHasRefeeded ?? this.viewerHasRefeeded,
      isPromoted: isPromoted,
      isTrending: isTrending,
      isNewPost: isNewPost,
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
      mediaFilterId: json['mediaFilterId'] as String?,
      mediaFilterIds:
          (json['mediaFilterIds'] as List?)?.whereType<String>().toList() ??
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
      originalPostId: json['originalPostId'] as String?,
      originalPost: json['originalPost'] is Map
          ? FeedPost.fromJson(
              Map<String, Object?>.from(json['originalPost']! as Map),
            )
          : null,
      viewerHasLiked: json['viewerHasLiked'] as bool? ?? false,
      viewerHasSaved: json['viewerHasSaved'] as bool? ?? false,
      viewerHasRefeeded: json['viewerHasRefeeded'] as bool? ?? false,
      isPromoted: json['isPromoted'] as bool? ?? false,
      isTrending: json['isTrending'] as bool? ?? false,
      isNewPost: json['isNewPost'] as bool? ?? false,
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
      'mediaFilterId': mediaFilterId,
      'mediaFilterIds': mediaFilterIds,
      'localMediaPath': localMediaPath,
      'likesCount': likesCount,
      'commentsCount': commentsCount,
      'viewsCount': viewsCount,
      'refeedsCount': refeedsCount,
      'location': location,
      'postType': postType,
      'avatarUrl': avatarUrl,
      'authorHandle': authorHandle,
      'originalPostId': originalPostId,
      'originalPost': originalPost?.toJson(),
      'viewerHasLiked': viewerHasLiked,
      'viewerHasSaved': viewerHasSaved,
      'viewerHasRefeeded': viewerHasRefeeded,
      'isPromoted': isPromoted,
      'isTrending': isTrending,
      'isNewPost': isNewPost,
    };
  }
}

class FeedComment {
  const FeedComment({
    required this.id,
    required this.userId,
    required this.authorName,
    required this.authorHandle,
    required this.content,
    required this.createdAtMillis,
    this.avatarUrl,
    this.parentCommentId,
    this.likesCount = 0,
    this.viewerHasLiked = false,
  });

  final String id;
  final String userId;
  final String authorName;
  final String? authorHandle;
  final String content;
  final int createdAtMillis;
  final String? avatarUrl;
  final String? parentCommentId;
  final int likesCount;
  final bool viewerHasLiked;

  FeedComment copyWith({int? likesCount, bool? viewerHasLiked}) {
    return FeedComment(
      id: id,
      userId: userId,
      authorName: authorName,
      authorHandle: authorHandle,
      content: content,
      createdAtMillis: createdAtMillis,
      avatarUrl: avatarUrl,
      parentCommentId: parentCommentId,
      likesCount: likesCount ?? this.likesCount,
      viewerHasLiked: viewerHasLiked ?? this.viewerHasLiked,
    );
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
