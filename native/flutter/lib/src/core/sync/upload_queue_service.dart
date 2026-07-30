import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/local/post_draft_repository.dart';
import '../../data/local/upload_queue_repository.dart';
import '../../features/create/post_draft.dart';
import '../media/media_compressor.dart';

class UploadQueueService {
  const UploadQueueService({
    required bool isConfigured,
    required PostDraftRepository draftRepository,
    required UploadQueueRepository uploadQueueRepository,
    MediaCompressor compressor = const MediaCompressor(),
  }) : _isConfigured = isConfigured,
       _draftRepository = draftRepository,
       _uploadQueueRepository = uploadQueueRepository,
       _compressor = compressor;

  final bool _isConfigured;
  final PostDraftRepository _draftRepository;
  final UploadQueueRepository _uploadQueueRepository;
  final MediaCompressor _compressor;

  Future<UploadQueueSummary> processQueue() async {
    if (!_isConfigured) {
      return const UploadQueueSummary(
        attempted: false,
        uploaded: 0,
        failed: 0,
        message: 'Supabase is not configured. Draft uploads remain queued.',
      );
    }

    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) {
      return const UploadQueueSummary(
        attempted: false,
        uploaded: 0,
        failed: 0,
        message: 'Sign in before uploading queued drafts.',
      );
    }

    final drafts = {
      for (final draft in await _draftRepository.loadDrafts()) draft.id: draft,
    };
    final queue = await _uploadQueueRepository.loadQueuedItems();

    var uploaded = 0;
    var failed = 0;
    var skipped = 0;
    var postsPublished = 0;
    var storiesPublished = 0;
    final publishedPostIds = <String>[];

    for (final item in queue) {
      final draft = drafts[item.draftId];
      if (draft == null) {
        await _uploadQueueRepository.remove(item.draftId);
        continue;
      }

      try {
        if (draft.draftKind != 'post' && draft.draftKind != 'story') {
          skipped++;
          continue;
        }

        await _draftRepository.markState(
          draftId: draft.id,
          uploadState: DraftUploadState.uploading,
        );
        await _uploadQueueRepository.updateProgress(draft.id, 10);
        final mediaUrls = await _uploadMediaIfNeeded(client, userId, draft);
        await _uploadQueueRepository.updateProgress(draft.id, 90);
        final mediaTypes = _mediaTypesFor(draft, mediaUrls.length);

        switch (draft.draftKind) {
          case 'story':
            await _publishStoryDraft(
              client,
              userId,
              draft,
              mediaUrls,
              mediaTypes,
            );
            storiesPublished++;
            break;
          case 'post':
            final postId = await _publishPostDraft(
              client,
              userId,
              draft,
              mediaUrls,
              mediaTypes,
            );
            publishedPostIds.add(postId);
            postsPublished++;
            break;
        }

        await _uploadQueueRepository.updateProgress(draft.id, 100);
        await _uploadQueueRepository.remove(draft.id);
        await _draftRepository.deleteDraft(draft.id);
        uploaded++;
      } catch (error) {
        await _draftRepository.markState(
          draftId: draft.id,
          uploadState: DraftUploadState.failed,
        );
        await _uploadQueueRepository.updateProgress(draft.id, 0);
        failed++;
        return UploadQueueSummary(
          attempted: true,
          uploaded: uploaded,
          failed: failed,
          message: 'Upload failed: ${_formatError(error)}',
          publishedPostIds: publishedPostIds,
        );
      }
    }

    return UploadQueueSummary(
      attempted: true,
      uploaded: uploaded,
      failed: failed,
      message: _summaryMessage(
        postsPublished: postsPublished,
        storiesPublished: storiesPublished,
        skipped: skipped,
      ),
      publishedPostIds: publishedPostIds,
    );
  }

  Future<String> _publishPostDraft(
    SupabaseClient client,
    String userId,
    PostDraft draft,
    List<String> mediaUrls,
    List<String> mediaTypes,
  ) async {
    final row = await client
        .from('posts')
        .insert({
          'user_id': userId,
          'content': draft.content.isEmpty ? null : draft.content,
          'media_url': mediaUrls.firstOrNull,
          'media_type': mediaTypes.firstOrNull,
          'media_urls': mediaUrls,
          'media_types': mediaTypes,
          'media_filter_id': draft.mediaFilterId,
          'privacy': draft.privacy,
          'post_type': 'post',
          'status': 'active',
        })
        .select('id')
        .single();
    final postId = row['id']?.toString();
    if (postId == null || postId.isEmpty) {
      throw StateError('Published post did not return an ID.');
    }
    return postId;
  }

  Future<void> _publishStoryDraft(
    SupabaseClient client,
    String userId,
    PostDraft draft,
    List<String> mediaUrls,
    List<String> mediaTypes,
  ) async {
    if (mediaUrls.isEmpty) {
      throw StateError('Story publishing requires a photo or video.');
    }

    for (final (index, mediaUrl) in mediaUrls.indexed) {
      await client.from('stories').insert({
        'user_id': userId,
        'media_url': mediaUrl,
        'media_type': index < mediaTypes.length ? mediaTypes[index] : 'image',
        'caption': draft.content.isEmpty ? null : draft.content,
      });
    }
  }

  Future<List<String>> _uploadMediaIfNeeded(
    SupabaseClient client,
    String userId,
    PostDraft draft,
  ) async {
    final mediaPaths = draft.mediaPaths.isNotEmpty
        ? draft.mediaPaths
        : draft.mediaPath == null
        ? const <String>[]
        : <String>[draft.mediaPath!];
    if (mediaPaths.isEmpty) return const [];

    final rawTypes = draft.mediaTypes.isNotEmpty
        ? draft.mediaTypes
        : draft.mediaType == null
        ? const <String>[]
        : <String>[draft.mediaType!];

    final urls = <String>[];
    final total = mediaPaths.where((path) => path.isNotEmpty).length;
    for (final (index, mediaPath) in mediaPaths.indexed) {
      if (mediaPath.isEmpty) continue;
      if (!File(mediaPath).existsSync()) continue;

      final mediaKind = index < rawTypes.length ? rawTypes[index] : 'image';
      // Compress before upload (image -> WebP, video -> optimised MP4). Falls
      // back to the original file on any failure.
      final compressed = await _compressor.compressForUpload(
        mediaPath,
        mediaKind,
      );
      final file = File(compressed.path);
      if (!file.existsSync()) continue;
      final extension = compressed.extension;
      final storagePath =
          '$userId/${draft.id}/${DateTime.now().millisecondsSinceEpoch}_$index.$extension';
      // Set an explicit content-type so uploads pass the `post-media` bucket's
      // allowed_mime_types whitelist even when the file has no/unknown
      // extension; upsert guards against a storage-path collision on retry.
      await client.storage
          .from('post-media')
          .upload(
            storagePath,
            file,
            fileOptions: FileOptions(
              contentType:
                  compressed.contentType ??
                  _contentTypeFor(extension, mediaKind),
              upsert: true,
            ),
          );
      urls.add(client.storage.from('post-media').getPublicUrl(storagePath));
      final completed = urls.length;
      final progress = total <= 0
          ? 80
          : 10 + ((completed / total) * 70).round();
      await _uploadQueueRepository.updateProgress(draft.id, progress);
    }
    return urls;
  }

  /// Best-effort MIME type matching the `post-media` bucket whitelist. Falls
  /// back to a generic image/video type when the extension is unknown so the
  /// upload still satisfies the bucket's allowed_mime_types constraint.
  String _contentTypeFor(String extension, String mediaKind) {
    switch (extension.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
      case 'qt':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
      default:
        return mediaKind == 'video' ? 'video/mp4' : 'image/jpeg';
    }
  }

  List<String> _mediaTypesFor(PostDraft draft, int mediaCount) {
    final rawTypes = draft.mediaTypes.isNotEmpty
        ? draft.mediaTypes
        : draft.mediaType == null
        ? const <String>[]
        : <String>[draft.mediaType!];
    if (mediaCount == 0) return const [];
    return [
      for (var i = 0; i < mediaCount; i++)
        i < rawTypes.length ? rawTypes[i] : 'image',
    ];
  }

  String _summaryMessage({
    required int postsPublished,
    required int storiesPublished,
    required int skipped,
  }) {
    final parts = <String>[];
    if (postsPublished > 0) {
      parts.add(
        postsPublished == 1
            ? 'Posted to feedIn.'
            : 'Posted $postsPublished drafts to feedIn.',
      );
    }
    if (storiesPublished > 0) {
      parts.add(
        storiesPublished == 1
            ? 'Story published.'
            : 'Published $storiesPublished story drafts.',
      );
    }
    if (skipped > 0) {
      parts.add(
        '$skipped unsupported draft${skipped == 1 ? '' : 's'} left queued.',
      );
    }
    return parts.isEmpty ? 'Upload queue processed.' : parts.join(' ');
  }

  String _formatError(Object error) {
    return error
        .toString()
        .replaceFirst('PostgrestException(message: ', '')
        .replaceFirst('StorageException(message: ', '')
        .replaceFirst(RegExp(r', code: .*'), '')
        .replaceFirst(RegExp(r', statusCode: .*'), '');
  }
}

class UploadQueueSummary {
  const UploadQueueSummary({
    required this.attempted,
    required this.uploaded,
    required this.failed,
    required this.message,
    this.publishedPostIds = const [],
  });

  final bool attempted;
  final int uploaded;
  final int failed;
  final String message;
  final List<String> publishedPostIds;
}
