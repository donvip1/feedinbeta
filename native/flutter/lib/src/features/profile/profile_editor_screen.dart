import 'package:flutter/material.dart';

import '../../data/local/profile_repository_contract.dart';
import 'user_profile.dart';

class ProfileEditorScreen extends StatefulWidget {
  const ProfileEditorScreen({
    super.key,
    required this.profile,
    required this.profileRepository,
    required this.onSaved,
  });

  final UserProfile profile;
  final ProfileRepositoryContract profileRepository;
  final ValueChanged<UserProfile> onSaved;

  @override
  State<ProfileEditorScreen> createState() => _ProfileEditorScreenState();
}

class _ProfileEditorScreenState extends State<ProfileEditorScreen> {
  late final TextEditingController _displayNameController;
  late final TextEditingController _handleController;
  late final TextEditingController _bioController;
  bool _isSaving = false;
  String? _message;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _displayNameController = TextEditingController(
      text: widget.profile.displayName,
    );
    _handleController = TextEditingController(text: widget.profile.handle);
    _bioController = TextEditingController(text: widget.profile.bio);
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _handleController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final displayName = _displayNameController.text.trim();
    final handle = _safeHandle(_handleController.text);
    if (displayName.length < 2 || handle.length < 3) {
      setState(
        () => _errorMessage =
            'Add a display name and a handle with at least 3 characters.',
      );
      return;
    }

    setState(() {
      _isSaving = true;
      _message = null;
      _errorMessage = null;
    });

    final profile = widget.profile.copyWith(
      displayName: displayName,
      handle: handle,
      bio: _bioController.text.trim(),
    );

    try {
      await widget.profileRepository.syncProfile(profile);
      widget.onSaved(profile);
      if (!mounted) return;
      setState(() => _message = 'Profile saved and synced.');
    } catch (_) {
      await widget.profileRepository.saveCurrentProfile(profile);
      widget.onSaved(profile);
      if (!mounted) return;
      setState(() => _message = 'Profile saved locally.');
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  static String _safeHandle(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll(RegExp('[^a-z0-9_]+'), '_')
        .replaceAll(RegExp('_+'), '_')
        .replaceAll(RegExp('^_|_\$'), '');
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Edit profile',
          style: Theme.of(
            context,
          ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _displayNameController,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: 'Display name',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _handleController,
          textInputAction: TextInputAction.next,
          decoration: const InputDecoration(
            labelText: 'Handle',
            prefixText: '@',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _bioController,
          minLines: 3,
          maxLines: 5,
          decoration: const InputDecoration(
            labelText: 'Bio',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _isSaving ? null : _save,
          icon: const Icon(Icons.save_outlined),
          label: Text(_isSaving ? 'Saving...' : 'Save profile'),
        ),
        if (_message != null) ...[
          const SizedBox(height: 12),
          Text(
            _message!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
        if (_errorMessage != null) ...[
          const SizedBox(height: 12),
          Text(
            _errorMessage!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
      ],
    );
  }
}
