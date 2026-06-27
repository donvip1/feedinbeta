import 'package:flutter/material.dart';

import '../auth/data/auth_repository.dart';
import 'user_profile.dart';

class ProfileCompletionScreen extends StatefulWidget {
  const ProfileCompletionScreen({
    super.key,
    required this.user,
    required this.onComplete,
    this.requireRemoteSync = false,
  });

  final AuthUser user;
  final Future<void> Function(UserProfile profile) onComplete;
  final bool requireRemoteSync;

  @override
  State<ProfileCompletionScreen> createState() =>
      _ProfileCompletionScreenState();
}

class _ProfileCompletionScreenState extends State<ProfileCompletionScreen> {
  late final TextEditingController _displayNameController;
  late final TextEditingController _handleController;
  final _bioController = TextEditingController();
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final emailName = widget.user.email?.split('@').first;
    _displayNameController = TextEditingController(
      text: widget.user.isDemo ? 'feedIn Tester' : emailName ?? '',
    );
    _handleController = TextEditingController(
      text: widget.user.isDemo ? 'feedin_tester' : _safeHandle(emailName ?? ''),
    );
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _handleController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _completeProfile() async {
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
      _errorMessage = null;
    });

    final profile = UserProfile(
      userId: widget.user.id,
      displayName: displayName,
      handle: handle,
      bio: _bioController.text.trim(),
      completedAtMillis: DateTime.now().millisecondsSinceEpoch,
    );

    try {
      await widget.onComplete(profile);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = widget.requireRemoteSync
            ? 'Profile could not sync to Supabase: ${_formatError(error)}'
            : 'Profile saved locally, but sync failed: ${_formatError(error)}';
      });
      return;
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  static String _formatError(Object error) {
    return error
        .toString()
        .replaceFirst('PostgrestException(message: ', '')
        .replaceFirst('StorageException(message: ', '')
        .replaceFirst(RegExp(r', code: .*'), '')
        .replaceFirst(RegExp(r', statusCode: .*'), '');
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
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Complete profile',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Your profile is saved locally first and synced to feedIn when available.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 24),
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
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Bio',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _isSaving ? null : _completeProfile,
                    child: Text(_isSaving ? 'Saving...' : 'Continue'),
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
