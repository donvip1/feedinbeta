import 'package:flutter/material.dart';

import '../groups_theme.dart';

/// Message composer for the group room: a rounded input + a gradient send FAB
/// that enables once the field has text. Purely presentational — the screen
/// owns the controller and the send handler.
class GroupComposer extends StatefulWidget {
  const GroupComposer({
    super.key,
    required this.controller,
    required this.onSend,
    this.enabled = true,
  });

  final TextEditingController controller;
  final Future<void> Function() onSend;
  final bool enabled;

  @override
  State<GroupComposer> createState() => _GroupComposerState();
}

class _GroupComposerState extends State<GroupComposer> {
  bool _hasText = false;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _hasText = widget.controller.text.trim().isNotEmpty;
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    final has = widget.controller.text.trim().isNotEmpty;
    if (has != _hasText && mounted) setState(() => _hasText = has);
  }

  Future<void> _send() async {
    if (!_hasText || _sending) return;
    setState(() => _sending = true);
    await widget.onSend();
    if (!mounted) return;
    setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final canSend = widget.enabled && _hasText && !_sending;
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          GroupSpacing.md,
          GroupSpacing.sm,
          GroupSpacing.md,
          GroupSpacing.sm,
        ),
        decoration: const BoxDecoration(
          color: GroupColors.card,
          border: Border(top: BorderSide(color: GroupColors.border)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 120),
                decoration: BoxDecoration(
                  color: GroupColors.input,
                  borderRadius: BorderRadius.circular(GroupRadii.pill),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: GroupSpacing.md,
                ),
                child: TextField(
                  controller: widget.controller,
                  enabled: widget.enabled,
                  minLines: 1,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  cursorColor: GroupColors.primary,
                  style: const TextStyle(
                    fontSize: 15,
                    color: GroupColors.foreground,
                  ),
                  decoration: const InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: 'Message',
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
            _SendButton(enabled: canSend, sending: _sending, onTap: _send),
          ],
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    required this.enabled,
    required this.sending,
    required this.onTap,
  });

  final bool enabled;
  final bool sending;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled || sending ? 1 : 0.4,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: enabled ? onTap : null,
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
            child: sending
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
                    Icons.arrow_upward_rounded,
                    color: GroupColors.primaryForeground,
                  ),
          ),
        ),
      ),
    );
  }
}
