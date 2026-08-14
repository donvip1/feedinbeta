class PostDraft {
  const PostDraft({
    required this.id,
    required this.content,
    required this.createdAtMillis,
    this.mediaPath,
    this.mediaType,
    this.mediaPaths = const [],
    this.mediaTypes = const [],
    this.privacy = 'everyone',
    this.draftKind = 'post',
    this.mediaFilterId,
    this.mediaFilterIds = const [],
    this.uploadState = DraftUploadState.local,
  });

  final String id;
  final String content;
  final String? mediaPath;
  final String? mediaType;
  final List<String> mediaPaths;
  final List<String> mediaTypes;
  final String privacy;
  final String draftKind;
  final String? mediaFilterId;
  final List<String> mediaFilterIds;
  final int createdAtMillis;
  final DraftUploadState uploadState;

  PostDraft copyWith({DraftUploadState? uploadState}) {
    return PostDraft(
      id: id,
      content: content,
      mediaPath: mediaPath,
      mediaType: mediaType,
      mediaPaths: mediaPaths,
      mediaTypes: mediaTypes,
      privacy: privacy,
      draftKind: draftKind,
      mediaFilterId: mediaFilterId,
      mediaFilterIds: mediaFilterIds,
      createdAtMillis: createdAtMillis,
      uploadState: uploadState ?? this.uploadState,
    );
  }

  factory PostDraft.fromJson(Map<String, Object?> json) {
    final legacyMediaPath = json['mediaPath'] as String?;
    final legacyMediaType = json['mediaType'] as String?;
    final mediaPaths =
        (json['mediaPaths'] as List?)?.whereType<String>().toList() ??
        (legacyMediaPath == null
            ? const <String>[]
            : <String>[legacyMediaPath]);
    final mediaTypes =
        (json['mediaTypes'] as List?)?.whereType<String>().toList() ??
        (legacyMediaType == null
            ? const <String>[]
            : <String>[legacyMediaType]);

    return PostDraft(
      id: json['id'] as String,
      content: json['content'] as String? ?? '',
      mediaPath: legacyMediaPath ?? mediaPaths.firstOrNull,
      mediaType: legacyMediaType ?? mediaTypes.firstOrNull,
      mediaPaths: mediaPaths,
      mediaTypes: mediaTypes,
      privacy: json['privacy'] as String? ?? 'everyone',
      draftKind: json['draftKind'] as String? ?? 'post',
      mediaFilterId: json['mediaFilterId'] as String?,
      mediaFilterIds:
          (json['mediaFilterIds'] as List?)?.whereType<String>().toList() ??
          const [],
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
      'mediaPaths': mediaPaths,
      'mediaTypes': mediaTypes,
      'privacy': privacy,
      'draftKind': draftKind,
      'mediaFilterId': mediaFilterId,
      'mediaFilterIds': mediaFilterIds,
      'createdAtMillis': createdAtMillis,
      'uploadState': uploadState.name,
    };
  }
}

enum DraftUploadState { local, queued, uploading, uploaded, failed }
