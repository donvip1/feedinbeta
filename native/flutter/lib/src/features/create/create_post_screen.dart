import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/local/post_draft_repository.dart';
import '../../data/local/upload_queue_repository.dart';
import 'post_draft.dart';

class CreatePostScreen extends StatefulWidget {
  const CreatePostScreen({
    super.key,
    required this.draftRepository,
    required this.uploadQueueRepository,
  });

  final PostDraftRepository draftRepository;
  final UploadQueueRepository uploadQueueRepository;

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<CreatePostScreen> {
  final _contentController = TextEditingController();
  final _picker = ImagePicker();
  XFile? _selectedMedia;
  String? _selectedMediaType;
  late Future<_DraftQueueSnapshot> _draftsFuture;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _draftsFuture = _loadDraftSnapshot();
  }

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return;
    setState(() {
      _selectedMedia = picked;
      _selectedMediaType = 'image';
    });
  }

  Future<void> _pickVideo() async {
    final picked = await _picker.pickVideo(source: ImageSource.gallery);
    if (picked == null) return;
    setState(() {
      _selectedMedia = picked;
      _selectedMediaType = 'video';
    });
  }

  Future<void> _saveDraft({required bool queueForUpload}) async {
    final content = _contentController.text.trim();
    if (content.isEmpty && _selectedMedia == null) return;

    setState(() => _isSaving = true);
    final draft = await widget.draftRepository.saveDraft(
      content: content,
      mediaPath: _selectedMedia?.path,
      mediaType: _selectedMediaType,
    );

    if (queueForUpload) {
      await widget.uploadQueueRepository.enqueueDraft(draft.id);
      await widget.draftRepository.markState(
        draftId: draft.id,
        uploadState: DraftUploadState.queued,
      );
    }

    _contentController.clear();
    if (!mounted) return;
    setState(() {
      _selectedMedia = null;
      _selectedMediaType = null;
      _isSaving = false;
      _draftsFuture = _loadDraftSnapshot();
    });
  }

  Future<_DraftQueueSnapshot> _loadDraftSnapshot() async {
    final drafts = await widget.draftRepository.loadDrafts();
    final queue = await widget.uploadQueueRepository.loadQueuedItems();
    return _DraftQueueSnapshot(
      drafts: drafts,
      queuedDraftIds: queue.map((item) => item.draftId).toSet(),
    );
  }

  Future<void> _queueDraft(PostDraft draft) async {
    await widget.uploadQueueRepository.enqueueDraft(draft.id);
    await widget.draftRepository.markState(
      draftId: draft.id,
      uploadState: DraftUploadState.queued,
    );
    if (!mounted) return;
    setState(() => _draftsFuture = _loadDraftSnapshot());
  }

  Future<void> _cancelQueuedDraft(PostDraft draft) async {
    await widget.uploadQueueRepository.remove(draft.id);
    await widget.draftRepository.markState(
      draftId: draft.id,
      uploadState: DraftUploadState.local,
    );
    if (!mounted) return;
    setState(() => _draftsFuture = _loadDraftSnapshot());
  }

  Future<void> _deleteDraft(PostDraft draft) async {
    await widget.uploadQueueRepository.remove(draft.id);
    await widget.draftRepository.deleteDraft(draft.id);
    if (!mounted) return;
    setState(() => _draftsFuture = _loadDraftSnapshot());
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Create',
          style: Theme.of(
            context,
          ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _contentController,
          minLines: 4,
          maxLines: 8,
          decoration: const InputDecoration(
            hintText: 'What are you sharing on FEEDIN?',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        if (_selectedMedia != null)
          _SelectedMediaPreview(
            path: _selectedMedia!.path,
            mediaType: _selectedMediaType,
            onRemove: () => setState(() {
              _selectedMedia = null;
              _selectedMediaType = null;
            }),
          ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ActionChip(
              avatar: const Icon(Icons.photo_library_outlined),
              label: const Text('Photo'),
              onPressed: _pickImage,
            ),
            ActionChip(
              avatar: const Icon(Icons.video_library_outlined),
              label: const Text('Video'),
              onPressed: _pickVideo,
            ),
            FilledButton.icon(
              onPressed: _isSaving
                  ? null
                  : () => _saveDraft(queueForUpload: false),
              icon: const Icon(Icons.save_outlined),
              label: const Text('Save draft'),
            ),
            FilledButton.icon(
              onPressed: _isSaving ? null : () => _saveDraft(queueForUpload: true),
              icon: const Icon(Icons.cloud_upload_outlined),
              label: const Text('Queue upload'),
            ),
          ],
        ),
        const SizedBox(height: 24),
        Text(
          'Drafts',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 12),
        FutureBuilder<_DraftQueueSnapshot>(
          future: _draftsFuture,
          builder: (context, snapshot) {
            final draftSnapshot = snapshot.data;
            if (draftSnapshot == null) {
              return const Center(child: CircularProgressIndicator());
            }
            final drafts = draftSnapshot.drafts;
            if (drafts.isEmpty) {
              return const Text('No drafts yet.');
            }
            return Column(
              children: drafts.map((draft) {
                final isQueued = draftSnapshot.queuedDraftIds.contains(
                  draft.id,
                );
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: ListTile(
                      leading: Icon(
                        draft.mediaType == 'video'
                            ? Icons.play_circle_outline
                            : draft.mediaType == 'image'
                            ? Icons.image_outlined
                            : Icons.notes,
                      ),
                      title: Text(
                        draft.content.isEmpty ? 'Media draft' : draft.content,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: [
                          Chip(
                            visualDensity: VisualDensity.compact,
                            label: Text(
                              isQueued ? 'queued' : draft.uploadState.name,
                            ),
                          ),
                          if (draft.mediaType != null)
                            Chip(
                              visualDensity: VisualDensity.compact,
                              label: Text(draft.mediaType!),
                            ),
                        ],
                      ),
                      trailing: Wrap(
                        spacing: 4,
                        children: [
                          if (isQueued)
                            IconButton(
                              tooltip: 'Cancel upload',
                              icon: const Icon(Icons.pause_circle_outline),
                              onPressed: () => _cancelQueuedDraft(draft),
                            )
                          else if (draft.uploadState != DraftUploadState.uploaded)
                            IconButton(
                              tooltip: draft.uploadState ==
                                      DraftUploadState.failed
                                  ? 'Retry upload'
                                  : 'Queue upload',
                              icon: const Icon(Icons.cloud_upload_outlined),
                              onPressed: () => _queueDraft(draft),
                            ),
                          IconButton(
                            tooltip: 'Delete draft',
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () => _deleteDraft(draft),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _DraftQueueSnapshot {
  const _DraftQueueSnapshot({
    required this.drafts,
    required this.queuedDraftIds,
  });

  final List<PostDraft> drafts;
  final Set<String> queuedDraftIds;
}

class _SelectedMediaPreview extends StatelessWidget {
  const _SelectedMediaPreview({
    required this.path,
    required this.mediaType,
    required this.onRemove,
  });

  final String path;
  final String? mediaType;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Stack(
        children: [
          AspectRatio(
            aspectRatio: 4 / 3,
            child: mediaType == 'image'
                ? Image.file(File(path), fit: BoxFit.cover)
                : DecoratedBox(
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    ),
                    child: const Center(
                      child: Icon(Icons.play_circle_fill, size: 56),
                    ),
                  ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: IconButton.filled(
              tooltip: 'Remove',
              onPressed: onRemove,
              icon: const Icon(Icons.close),
            ),
          ),
        ],
      ),
    );
  }
}
