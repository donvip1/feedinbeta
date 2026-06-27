import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/local/post_draft_repository.dart';
import '../../data/local/upload_queue_repository.dart';
import '../../features/create/post_draft.dart';

class UploadQueueService {
  const UploadQueueService({
    required bool isConfigured,
    required PostDraftRepository draftRepository,
    required UploadQueueRepository uploadQueueRepository,
  }) : _isConfigured = isConfigured,
       _draftRepository = draftRepository,
       _uploadQueueRepository = uploadQueueRepository;

  final bool _isConfigured;
  final PostDraftRepository _draftRepository;
  final UploadQueueRepository _uploadQueueRepository;

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
        final mediaUrls = await _uploadMediaIfNeeded(client, userId, draft);
        final mediaTypes = _mediaTypesFor(draft, mediaUrls.length);

        switch (draft.draftKind) {
          case 'story':
            await _publishStoryDraft(client, userId, draft, mediaUrls, mediaTypes);
            storiesPublished++;
            break;
          case 'post':
            await _publishPostDraft(client, userId, draft, mediaUrls, mediaTypes);
            postsPublished++;
            break;
        }

        await _draftRepository.markState(
          draftId: draft.id,
          uploadState: DraftUploadState.uploaded,
        );
        await _uploadQueueRepository.remove(draft.id);
        uploaded++;
      } catch (error) {
        await _draftRepository.markState(
          draftId: draft.id,
          uploadState: DraftUploadState.failed,
        );
        failed++;
        return UploadQueueSummary(
          attempted: true,
          uploaded: uploaded,
          failed: failed,
          message: 'Upload failed: ${_formatError(error)}',
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
    );
  }

  Future<void> _publishPostDraft(
    SupabaseClient client,
    String userId,
    PostDraft draft,
    List<String> mediaUrls,
    List<String> mediaTypes,
  ) async {
    await client.from('posts').insert({
      'user_id': userId,
      'content': draft.content.isEmpty ? null : draft.content,
      'media_url': mediaUrls.firstOrNull,
      'media_type': mediaTypes.firstOrNull,
      'media_urls': mediaUrls,
      'media_types': mediaTypes,
      'privacy': draft.privacy,
      'post_type': 'post',
      'status': 'active',
    });
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

    final urls = <String>[];
    for (final (index, mediaPath) in mediaPaths.indexed) {
      if (mediaPath.isEmpty) continue;
      final file = File(mediaPath);
      if (!file.existsSync()) continue;

      final extension = mediaPath.contains('.')
          ? mediaPath.split('.').last
          : 'bin';
      final storagePath =
          '$userId/${draft.id}/${DateTime.now().millisecondsSinceEpoch}_$index.$extension';
      await client.storage.from('post-media').upload(storagePath, file);
      urls.add(client.storage.from('post-media').getPublicUrl(storagePath));
    }
    return urls;
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
  });

  final bool attempted;
  final int uploaded;
  final int failed;
  final String message;
}
