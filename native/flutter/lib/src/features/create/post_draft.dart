class PostDraft {
  const PostDraft({
    required this.id,
    required this.content,
    required this.createdAtMillis,
    this.mediaPath,
    this.mediaType,
    this.uploadState = DraftUploadState.local,
  });

  final String id;
  final String content;
  final String? mediaPath;
  final String? mediaType;
  final int createdAtMillis;
  final DraftUploadState uploadState;

  PostDraft copyWith({DraftUploadState? uploadState}) {
    return PostDraft(
      id: id,
      content: content,
      mediaPath: mediaPath,
      mediaType: mediaType,
      createdAtMillis: createdAtMillis,
      uploadState: uploadState ?? this.uploadState,
    );
  }

  factory PostDraft.fromJson(Map<String, Object?> json) {
    return PostDraft(
      id: json['id'] as String,
      content: json['content'] as String? ?? '',
      mediaPath: json['mediaPath'] as String?,
      mediaType: json['mediaType'] as String?,
      createdAtMillis: json['createdAtMillis'] as int,
      uploadState: DraftUploadState.values.byName(
        json['uploadState'] as String? ?? DraftUploadState.local.name,
      ),
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'content': content,
      'mediaPath': mediaPath,
      'mediaType': mediaType,
      'createdAtMillis': createdAtMillis,
      'uploadState': uploadState.name,
    };
  }
}

enum DraftUploadState { local, queued, uploading, uploaded, failed }
