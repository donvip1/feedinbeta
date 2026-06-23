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

    final drafts = {for (final draft in await _draftRepository.loadDrafts()) draft.id: draft};
    final queue = await _uploadQueueRepository.loadQueuedItems();

    var uploaded = 0;
    var failed = 0;

    for (final item in queue) {
      final draft = drafts[item.draftId];
      if (draft == null) {
        await _uploadQueueRepository.remove(item.draftId);
        continue;
      }

      try {
        await _draftRepository.markState(
          draftId: draft.id,
          uploadState: DraftUploadState.uploading,
        );
        final mediaUrl = await _uploadMediaIfNeeded(client, userId, draft);

        await client.from('posts').insert({
          'user_id': userId,
          'content': draft.content.isEmpty ? null : draft.content,
          'media_url': mediaUrl,
          'media_type': draft.mediaType ?? (mediaUrl == null ? 'text' : null),
          'post_type': 'public',
        });

        await _draftRepository.markState(
          draftId: draft.id,
          uploadState: DraftUploadState.uploaded,
        );
        await _uploadQueueRepository.remove(draft.id);
        uploaded++;
      } catch (_) {
        await _draftRepository.markState(
          draftId: draft.id,
          uploadState: DraftUploadState.failed,
        );
        failed++;
      }
    }

    return UploadQueueSummary(
      attempted: true,
      uploaded: uploaded,
      failed: failed,
      message: 'Upload queue processed.',
    );
  }

  Future<String?> _uploadMediaIfNeeded(
    SupabaseClient client,
    String userId,
    PostDraft draft,
  ) async {
    final mediaPath = draft.mediaPath;
    if (mediaPath == null || mediaPath.isEmpty) return null;

    final file = File(mediaPath);
    if (!file.existsSync()) return null;

    final extension = mediaPath.contains('.') ? mediaPath.split('.').last : 'bin';
    final storagePath =
        '$userId/${draft.id}/${DateTime.now().millisecondsSinceEpoch}.$extension';
    await client.storage.from('post-media').upload(storagePath, file);
    return client.storage.from('post-media').getPublicUrl(storagePath);
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
