import 'package:flutter/material.dart';

import '../groups_theme.dart';

class CreateCommunityResult {
  const CreateCommunityResult({
    required this.name,
    required this.description,
    required this.isPrivate,
    required this.isPremium,
  });

  final String name;
  final String description;
  final bool isPrivate;
  final bool isPremium;
}

class CreateCommunitySheet extends StatefulWidget {
  const CreateCommunitySheet({super.key, required this.onCreate});

  final Future<void> Function(CreateCommunityResult result) onCreate;

  @override
  State<CreateCommunitySheet> createState() => _CreateCommunitySheetState();
}

class _CreateCommunitySheetState extends State<CreateCommunitySheet> {
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isPrivate = false;
  bool _isPremium = false;
  bool _submitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await widget.onCreate(
        CreateCommunityResult(
          name: name,
          description: _descriptionController.text.trim(),
          isPrivate: _isPrivate,
          isPremium: _isPremium,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Create community',
              style: TextStyle(
                color: GroupColors.foreground,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _nameController,
              autofocus: true,
              maxLength: 80,
              decoration: const InputDecoration(
                labelText: 'Community name',
                prefixIcon: Icon(Icons.groups_2_outlined),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _descriptionController,
              minLines: 3,
              maxLines: 5,
              maxLength: 300,
              decoration: const InputDecoration(
                labelText: 'Description',
                alignLabelWithHint: true,
              ),
            ),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Private community'),
              subtitle: const Text('New members send a join request.'),
              secondary: const Icon(Icons.lock_outline_rounded),
              value: _isPrivate,
              onChanged: _submitting
                  ? null
                  : (value) => setState(() => _isPrivate = value),
            ),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Premium community'),
              subtitle: const Text('Requires an active premium subscription.'),
              secondary: const Icon(Icons.workspace_premium_outlined),
              value: _isPremium,
              onChanged: _submitting
                  ? null
                  : (value) => setState(() => _isPremium = value),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add_rounded),
                label: Text(_submitting ? 'Creating...' : 'Create community'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
