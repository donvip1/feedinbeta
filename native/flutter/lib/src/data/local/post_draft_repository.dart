import 'package:hive_ce/hive.dart';
import 'package:uuid/uuid.dart';

import '../../features/create/post_draft.dart';
import 'local_record_decoder.dart';

class PostDraftRepository {
  PostDraftRepository({required Box<Map> box}) : _box = box;

  final Box<Map> _box;

  Future<List<PostDraft>> loadDrafts() async {
    final drafts =
        _box.values
            .map((value) => decodeLocalRecord(value, PostDraft.fromJson))
            .whereType<PostDraft>()
            .toList()
          ..sort((a, b) => b.createdAtMillis.compareTo(a.createdAtMillis));
    return drafts;
  }

  Future<PostDraft> saveDraft({
    required String content,
    String? mediaPath,
    String? mediaType,
    List<String> mediaPaths = const [],
    List<String> mediaTypes = const [],
    String privacy = 'everyone',
    String draftKind = 'post',
    String? mediaFilterId,
    List<String> mediaFilterIds = const [],
  }) async {
    final normalizedMediaPaths = mediaPaths.isNotEmpty
        ? List<String>.unmodifiable(mediaPaths)
        : mediaPath == null
        ? const <String>[]
        : <String>[mediaPath];
    final normalizedMediaTypes = mediaTypes.isNotEmpty
        ? List<String>.unmodifiable(mediaTypes)
        : mediaType == null
        ? const <String>[]
        : <String>[mediaType];

    final draft = PostDraft(
      id: const Uuid().v4(),
      content: content.trim(),
      mediaPath: mediaPath ?? normalizedMediaPaths.firstOrNull,
      mediaType: mediaType ?? normalizedMediaTypes.firstOrNull,
      mediaPaths: normalizedMediaPaths,
      mediaTypes: normalizedMediaTypes,
      privacy: privacy,
      draftKind: draftKind,
      mediaFilterId: mediaFilterId,
      mediaFilterIds: List<String>.unmodifiable(mediaFilterIds),
      createdAtMillis: DateTime.now().millisecondsSinceEpoch,
    );
    await _box.put(draft.id, draft.toJson());
    return draft;
  }

  Future<void> markState({
    required String draftId,
    required DraftUploadState uploadState,
  }) async {
    final raw = _box.get(draftId);
    if (raw == null) return;
    final draft = PostDraft.fromJson(Map<String, Object?>.from(raw));
    await _box.put(draftId, draft.copyWith(uploadState: uploadState).toJson());
  }

  Future<void> deleteDraft(String draftId) async {
    await _box.delete(draftId);
  }
}
