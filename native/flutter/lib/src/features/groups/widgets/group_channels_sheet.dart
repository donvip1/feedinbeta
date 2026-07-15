import 'package:flutter/material.dart';

import '../groups_theme.dart';
import '../view_models/group_view_models.dart';

/// Bottom sheet listing the broadcast/announcement channels of a group
/// (Telegram-style). Lets the user open an existing channel or create a new one.
///
/// Purely presentational: the screen owns loading state and the create/open
/// handlers. Channels are modelled on the group's `messages` (no dedicated
/// channels table exists — see the data source / module report).
class GroupChannelsSheet extends StatefulWidget {
  const GroupChannelsSheet({
    super.key,
    required this.channels,
    required this.isLoading,
    required this.onOpenChannel,
    required this.onCreateChannel,
  });

  final List<GroupChannelView> channels;
  final bool isLoading;

  /// Open an existing channel.
  final void Function(GroupChannelView channel) onOpenChannel;

  /// Create a new channel with the given (already-validated) name.
  final Future<GroupChannelView?> Function(String channelName) onCreateChannel;

  @override
  State<GroupChannelsSheet> createState() => _GroupChannelsSheetState();
}

class _GroupChannelsSheetState extends State<GroupChannelsSheet> {
  final _nameController = TextEditingController();
  bool _creating = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Set<String> get _existingNames =>
      widget.channels.map((c) => c.name.toLowerCase()).toSet();

  Future<void> _create() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || _creating) return;
    if (_existingNames.contains(name.toLowerCase())) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A channel with that name already exists'),
        ),
      );
      return;
    }
    setState(() => _creating = true);
    await widget.onCreateChannel(name);
    if (!mounted) return;
    _nameController.clear();
    setState(() => _creating = false);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: GroupColors.card,
          borderRadius: GroupRadii.sheetTop,
          boxShadow: GroupShadows.sheet,
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: GroupSpacing.sm),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GroupColors.muted,
                  borderRadius: BorderRadius.circular(GroupRadii.pill),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(
                  GroupSpacing.lg,
                  GroupSpacing.lg,
                  GroupSpacing.lg,
                  GroupSpacing.sm,
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.campaign_rounded,
                      size: 20,
                      color: GroupColors.primary,
                    ),
                    SizedBox(width: GroupSpacing.sm),
                    Text(
                      'Channels',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                        color: GroupColors.foreground,
                      ),
                    ),
                  ],
                ),
              ),
              _CreateChannelField(
                controller: _nameController,
                creating: _creating,
                onCreate: _create,
              ),
              Flexible(child: _buildList()),
              const SizedBox(height: GroupSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildList() {
    if (widget.isLoading) {
      return const Padding(
        padding: EdgeInsets.all(GroupSpacing.xl),
        child: Center(
          child: CircularProgressIndicator(color: GroupColors.primary),
        ),
      );
    }
    if (widget.channels.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(
          horizontal: GroupSpacing.xl,
          vertical: GroupSpacing.lg,
        ),
        child: Text(
          'No channels yet. Create one to broadcast announcements to the group.',
          textAlign: TextAlign.center,
          style: GroupTextStyles.previewMuted,
        ),
      );
    }
    return ListView.builder(
      shrinkWrap: true,
      padding: const EdgeInsets.symmetric(
        horizontal: GroupSpacing.sm,
        vertical: GroupSpacing.xs,
      ),
      itemCount: widget.channels.length,
      itemBuilder: (context, index) {
        final channel = widget.channels[index];
        return _ChannelRow(
          channel: channel,
          onTap: () => widget.onOpenChannel(channel),
        );
      },
    );
  }
}

class _CreateChannelField extends StatelessWidget {
  const _CreateChannelField({
    required this.controller,
    required this.creating,
    required this.onCreate,
  });

  final TextEditingController controller;
  final bool creating;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        GroupSpacing.lg,
        0,
        GroupSpacing.lg,
        GroupSpacing.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: GroupColors.input,
                borderRadius: BorderRadius.circular(GroupRadii.pill),
              ),
              padding: const EdgeInsets.symmetric(horizontal: GroupSpacing.md),
              child: TextField(
                controller: controller,
                enabled: !creating,
                textCapitalization: TextCapitalization.sentences,
                cursorColor: GroupColors.primary,
                onSubmitted: (_) => onCreate(),
                style: const TextStyle(
                  fontSize: 15,
                  color: GroupColors.foreground,
                ),
                decoration: const InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  hintText: 'New channel name',
                  hintStyle: TextStyle(
                    fontSize: 15,
                    color: GroupColors.mutedForeground,
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    vertical: GroupSpacing.md,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: GroupSpacing.sm),
          Material(
            color: Colors.transparent,
            shape: const CircleBorder(),
            child: InkWell(
              onTap: creating ? null : onCreate,
              customBorder: const CircleBorder(),
              child: Container(
                width: GroupSpacing.tapTarget,
                height: GroupSpacing.tapTarget,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  gradient: GroupGradients.sendAction,
                  shape: BoxShape.circle,
                  boxShadow: GroupShadows.pink,
                ),
                child: creating
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            GroupColors.primaryForeground,
                          ),
                        ),
                      )
                    : const Icon(
                        Icons.add_rounded,
                        color: GroupColors.primaryForeground,
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChannelRow extends StatelessWidget {
  const _ChannelRow({required this.channel, required this.onTap});

  final GroupChannelView channel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(GroupRadii.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(GroupRadii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GroupSpacing.sm,
            vertical: GroupSpacing.sm,
          ),
          child: Row(
            children: [
              Container(
                width: GroupSpacing.avatarMd,
                height: GroupSpacing.avatarMd,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: GroupGradients.avatarFallback,
                ),
                child: const Icon(
                  Icons.campaign_rounded,
                  size: 20,
                  color: GroupColors.primaryForeground,
                ),
              ),
              const SizedBox(width: GroupSpacing.md),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      channel.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GroupTextStyles.groupName,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      channel.previewLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GroupTextStyles.previewMuted,
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: GroupColors.mutedForeground,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
