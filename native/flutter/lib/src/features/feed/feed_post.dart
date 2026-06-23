class FeedPost {
  const FeedPost({
    required this.id,
    required this.authorName,
    required this.body,
    required this.meta,
    required this.createdAtMillis,
    this.mediaUrl,
    this.mediaType,
    this.localMediaPath,
  });

  final String id;
  final String authorName;
  final String body;
  final String meta;
  final int createdAtMillis;
  final String? mediaUrl;
  final String? mediaType;
  final String? localMediaPath;

  FeedPost copyWith({String? localMediaPath}) {
    return FeedPost(
      id: id,
      authorName: authorName,
      body: body,
      meta: meta,
      createdAtMillis: createdAtMillis,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      localMediaPath: localMediaPath ?? this.localMediaPath,
    );
  }

  factory FeedPost.fromJson(Map<String, Object?> json) {
    return FeedPost(
      id: json['id'] as String,
      authorName: json['authorName'] as String,
      body: json['body'] as String,
      meta: json['meta'] as String,
      createdAtMillis: json['createdAtMillis'] as int,
      mediaUrl: json['mediaUrl'] as String?,
      mediaType: json['mediaType'] as String?,
      localMediaPath: json['localMediaPath'] as String?,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'authorName': authorName,
      'body': body,
      'meta': meta,
      'createdAtMillis': createdAtMillis,
      'mediaUrl': mediaUrl,
      'mediaType': mediaType,
      'localMediaPath': localMediaPath,
    };
  }
}
