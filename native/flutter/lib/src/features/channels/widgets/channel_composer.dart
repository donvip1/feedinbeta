import 'package:flutter/material.dart';

import '../channels_theme.dart';

/// Broadcast composer for the channel view — visible ONLY to the channel
/// owner/admin. A rounded multiline input + a gradient "broadcast" FAB that
/// enables once the field has text. Purely presentational: the screen owns the
/// controller and the publish handler.
class ChannelComposer extends StatefulWidget {
  const ChannelComposer({
    super.key,
    required this.controller,
    required this.onPublish,
    this.enabled = true,
  });

  final TextEditingController controller;
  final Future<void> Function() onPublish;
  final bool enabled;

  @override
  State<ChannelComposer> createState() => _ChannelComposerState();
}

class _ChannelComposerState extends State<ChannelComposer> {
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

  Future<void> _publish() async {
    if (!_hasText || _sending) return;
    setState(() => _sending = true);
    await widget.onPublish();
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
          ChannelSpacing.md,
          ChannelSpacing.sm,
          ChannelSpacing.md,
          ChannelSpacing.sm,
        ),
        decoration: const BoxDecoration(
          color: ChannelColors.card,
          border: Border(top: BorderSide(color: ChannelColors.border)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 10, right: ChannelSpacing.sm),
              child: Icon(
                Icons.campaign_rounded,
                size: 20,
                color: ChannelColors.primaryGlow,
              ),
            ),
            Expanded(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 140),
                decoration: BoxDecoration(
                  color: ChannelColors.input,
                  borderRadius: BorderRadius.circular(ChannelRadii.lg),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: ChannelSpacing.md,
                ),
                child: TextField(
                  controller: widget.controller,
                  enabled: widget.enabled,
                  minLines: 1,
                  maxLines: 6,
                  textCapitalization: TextCapitalization.sentences,
                  cursorColor: ChannelColors.primary,
                  style: const TextStyle(
                    fontSize: 15,
                    color: ChannelColors.foreground,
                  ),
                  decoration: const InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: 'Broadcast to subscribers…',
                    hintStyle: TextStyle(
                      fontSize: 15,
                      color: ChannelColors.mutedForeground,
                    ),
                    contentPadding: EdgeInsets.symmetric(
                      vertical: ChannelSpacing.md,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: ChannelSpacing.sm),
            _BroadcastButton(
              enabled: canSend,
              sending: _sending,
              onTap: _publish,
            ),
          ],
        ),
      ),
    );
  }
}

class _BroadcastButton extends StatelessWidget {
  const _BroadcastButton({
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
            width: ChannelSpacing.tapTarget,
            height: ChannelSpacing.tapTarget,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              gradient: ChannelGradients.sendAction,
              shape: BoxShape.circle,
              boxShadow: ChannelShadows.pink,
            ),
            child: sending
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        ChannelColors.primaryForeground,
                      ),
                    ),
                  )
                : const Icon(
                    Icons.send_rounded,
                    size: 20,
                    color: ChannelColors.primaryForeground,
                  ),
          ),
        ),
      ),
    );
  }
}
