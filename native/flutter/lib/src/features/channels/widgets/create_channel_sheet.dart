import 'package:flutter/material.dart';

import '../channels_theme.dart';
import '../data/channels_remote_data_source.dart';
import 'channel_avatar.dart';

/// Result of the create-channel flow: name, description, avatar URL, slug.
class CreateChannelResult {
  const CreateChannelResult({
    required this.name,
    this.description,
    this.avatarUrl,
    this.slug,
  });

  final String name;
  final String? description;
  final String? avatarUrl;
  final String? slug;
}

/// Bottom sheet for creating a Telegram-style channel. Captures a name, an
/// optional description, and an optional avatar URL, with a live `@handle`
/// preview derived from the name. Returns a [CreateChannelResult] via
/// [onCreate]; the screen performs the actual creation so it can navigate into
/// the new channel.
class CreateChannelSheet extends StatefulWidget {
  const CreateChannelSheet({super.key, required this.onCreate});

  final void Function(CreateChannelResult result) onCreate;

  @override
  State<CreateChannelSheet> createState() => _CreateChannelSheetState();
}

class _CreateChannelSheetState extends State<CreateChannelSheet> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final _avatarController = TextEditingController();

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _nameController.addListener(_onChanged);
    _avatarController.addListener(_onChanged);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    _avatarController.dispose();
    super.dispose();
  }

  void _onChanged() => setState(() {});

  bool get _canCreate =>
      !_submitting && _nameController.text.trim().isNotEmpty;

  String get _handlePreview {
    final name = _nameController.text.trim();
    if (name.isEmpty) return '@your_channel';
    return '@${ChannelsRemoteDataSource.suggestSlug(name)}';
  }

  void _submit() {
    if (!_canCreate) return;
    setState(() => _submitting = true);
    final name = _nameController.text.trim();
    widget.onCreate(
      CreateChannelResult(
        name: name,
        description: _descController.text.trim().isEmpty
            ? null
            : _descController.text.trim(),
        avatarUrl: _avatarController.text.trim().isEmpty
            ? null
            : _avatarController.text.trim(),
        slug: ChannelsRemoteDataSource.suggestSlug(name),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final avatarUrl = _avatarController.text.trim();
    final initial = _nameController.text.trim().isEmpty
        ? 'C'
        : _nameController.text.trim().substring(0, 1).toUpperCase();

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: ChannelColors.card,
          borderRadius: ChannelRadii.sheetTop,
          boxShadow: ChannelShadows.sheet,
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              ChannelSpacing.lg,
              ChannelSpacing.md,
              ChannelSpacing.lg,
              ChannelSpacing.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: ChannelColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: ChannelSpacing.lg),
                const Text(
                  'New channel',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: ChannelColors.foreground,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Broadcast to subscribers. You post, they read.',
                  style: ChannelTextStyles.previewMuted,
                ),
                const SizedBox(height: ChannelSpacing.lg),
                Row(
                  children: [
                    ChannelAvatar(
                      initial: initial,
                      avatarUrl: avatarUrl.isEmpty ? null : avatarUrl,
                      size: ChannelSpacing.avatarLg,
                    ),
                    const SizedBox(width: ChannelSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _nameController.text.trim().isEmpty
                                ? 'Channel name'
                                : _nameController.text.trim(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: ChannelTextStyles.channelName,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _handlePreview,
                            style: ChannelTextStyles.subtitle,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: ChannelSpacing.lg),
                _Field(
                  controller: _nameController,
                  label: 'Name',
                  hint: 'e.g. feedIn News',
                  maxLength: 60,
                ),
                const SizedBox(height: ChannelSpacing.md),
                _Field(
                  controller: _descController,
                  label: 'Description (optional)',
                  hint: 'What is this channel about?',
                  maxLines: 3,
                  maxLength: 200,
                ),
                const SizedBox(height: ChannelSpacing.md),
                _Field(
                  controller: _avatarController,
                  label: 'Avatar URL (optional)',
                  hint: 'https://…',
                  keyboardType: TextInputType.url,
                ),
                const SizedBox(height: ChannelSpacing.lg),
                _CreateButton(enabled: _canCreate, onTap: _submit),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    this.maxLines = 1,
    this.maxLength,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final int maxLines;
  final int? maxLength;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: ChannelTextStyles.sectionLabel),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: ChannelColors.input,
            borderRadius: BorderRadius.circular(ChannelRadii.md),
            border: Border.all(color: ChannelColors.border),
          ),
          padding: const EdgeInsets.symmetric(horizontal: ChannelSpacing.md),
          child: TextField(
            controller: controller,
            minLines: 1,
            maxLines: maxLines,
            maxLength: maxLength,
            keyboardType: keyboardType,
            textCapitalization: TextCapitalization.sentences,
            cursorColor: ChannelColors.primary,
            style: const TextStyle(
              fontSize: 15,
              color: ChannelColors.foreground,
            ),
            decoration: InputDecoration(
              isDense: true,
              border: InputBorder.none,
              counterText: '',
              hintText: hint,
              hintStyle: const TextStyle(
                fontSize: 15,
                color: ChannelColors.mutedForeground,
              ),
              contentPadding: const EdgeInsets.symmetric(
                vertical: ChannelSpacing.md,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _CreateButton extends StatelessWidget {
  const _CreateButton({required this.enabled, required this.onTap});

  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(ChannelRadii.md),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(ChannelRadii.md),
          child: Container(
            height: ChannelSpacing.tapTarget + 4,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: ChannelGradients.sendAction,
              borderRadius: BorderRadius.circular(ChannelRadii.md),
              boxShadow: ChannelShadows.pink,
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.add_rounded,
                  size: 20,
                  color: ChannelColors.primaryForeground,
                ),
                SizedBox(width: ChannelSpacing.sm),
                Text(
                  'Create channel',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: ChannelColors.primaryForeground,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
