class FeedPost {
  const FeedPost({
    required this.id,
    required this.authorName,
    required this.body,
    required this.meta,
    required this.createdAtMillis,
  });

  final String id;
  final String authorName;
  final String body;
  final String meta;
  final int createdAtMillis;

  factory FeedPost.fromJson(Map<String, Object?> json) {
    return FeedPost(
      id: json['id'] as String,
      authorName: json['authorName'] as String,
      body: json['body'] as String,
      meta: json['meta'] as String,
      createdAtMillis: json['createdAtMillis'] as int,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'authorName': authorName,
      'body': body,
      'meta': meta,
      'createdAtMillis': createdAtMillis,
    };
  }
}
