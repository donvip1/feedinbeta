import 'package:flutter/material.dart';

import '../data/live_models.dart';
import '../data/live_remote_data_source.dart';
import '../live_theme.dart';

/// The "PULSE" panel — a right-anchored glassmorphic drawer where the HOST can
/// add / edit / remove spotlight cards (announcements, promo codes, product
/// highlights) and VIEWERS see the published cards read-only.
///
/// Native counterpart of the web `stream-v2/AICatchUpPanel.tsx` host-cards
/// section. The web panel also renders an AI "last 15 minutes" summary powered
/// by a `stream-ai-summary` edge function; that half is intentionally NOT ported
/// (there is no such function reachable from the native build), so this panel is
/// scoped to the host-editable cards described in plan.md Part 1.
///
/// Cards persist under `live_streams.stream_features.host_cards` via
/// [LiveRemoteDataSource.updateHostCards]. When that column is absent on the
/// deployed schema the host still sees an immediate optimistic update but is
/// warned that publishing did not persist (see the module report).
///
/// Open with [showPulsePanel].
Future<void> showPulsePanel(
  BuildContext context, {
  required String streamId,
  required bool isHost,
  required List<HostCard> initialCards,
  required LiveRemoteDataSource dataSource,
  ValueChanged<List<HostCard>>? onCardsChanged,
}) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'PULSE',
    barrierColor: const Color(0x80000000),
    transitionDuration: const Duration(milliseconds: 260),
    pageBuilder: (_, _, _) => const SizedBox.shrink(),
    transitionBuilder: (context, animation, _, _) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      return Align(
        alignment: Alignment.centerRight,
        child: FractionalTranslation(
          translation: Offset(1 - curved.value, 0),
          child: Opacity(
            opacity: animation.value.clamp(0.0, 1.0),
            child: _PulsePanel(
              streamId: streamId,
              isHost: isHost,
              initialCards: initialCards,
              dataSource: dataSource,
              onCardsChanged: onCardsChanged,
            ),
          ),
        ),
      );
    },
  );
}

class _PulsePanel extends StatefulWidget {
  const _PulsePanel({
    required this.streamId,
    required this.isHost,
    required this.initialCards,
    required this.dataSource,
    this.onCardsChanged,
  });

  final String streamId;
  final bool isHost;
  final List<HostCard> initialCards;
  final LiveRemoteDataSource dataSource;
  final ValueChanged<List<HostCard>>? onCardsChanged;

  @override
  State<_PulsePanel> createState() => _PulsePanelState();
}

class _PulsePanelState extends State<_PulsePanel> {
  late List<HostCard> _cards = List.of(widget.initialCards);
  bool _adding = false;
  HostCard? _editing;

  Future<void> _persist(List<HostCard> next) async {
    // Optimistic: reflect immediately, notify the host screen, then persist.
    setState(() => _cards = next);
    widget.onCardsChanged?.call(next);
    final ok = await widget.dataSource.updateHostCards(widget.streamId, next);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Saved on screen, but publishing to viewers is unavailable right now.',
          ),
        ),
      );
    }
  }

  Future<void> _openEditor({HostCard? existing}) async {
    setState(() {
      _editing = existing;
      _adding = existing == null;
    });
  }

  void _closeEditor() {
    setState(() {
      _adding = false;
      _editing = null;
    });
  }

  Future<void> _submit(HostCard card) async {
    final next = List.of(_cards);
    final index = next.indexWhere((c) => c.id == card.id);
    if (index >= 0) {
      next[index] = card;
    } else {
      next.add(card);
    }
    _closeEditor();
    await _persist(next);
  }

  Future<void> _remove(HostCard card) async {
    final next = [for (final c in _cards) if (c.id != card.id) c];
    await _persist(next);
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    // Web uses a fixed 320px panel; cap to the screen on narrow devices.
    final panelWidth = width < 360 ? width * 0.88 : 320.0;
    final showEditor = widget.isHost && (_adding || _editing != null);

    return Material(
      color: Colors.transparent,
      child: SafeArea(
        left: false,
        child: Container(
          width: panelWidth,
          margin: EdgeInsets.only(top: media.padding.top),
          decoration: const BoxDecoration(
            color: Color(0xF20A0A0C),
            border: Border(left: BorderSide(color: LiveTheme.chipBorder)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _header(context),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text('HOST SPOTLIGHT', style: _pulseAccentLabel),
                        ),
                        if (widget.isHost && !showEditor)
                          _AddButton(onTap: () => _openEditor()),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (showEditor)
                      _CardEditor(
                        key: ValueKey(_editing?.id ?? 'new'),
                        initial: _editing,
                        onCancel: _closeEditor,
                        onSubmit: _submit,
                      ),
                    if (showEditor) const SizedBox(height: 12),
                    for (final card in _cards) ...[
                      _SpotlightCard(
                        card: card,
                        isHost: widget.isHost,
                        onEdit: () => _openEditor(existing: card),
                        onRemove: () => _remove(card),
                      ),
                      const SizedBox(height: 10),
                    ],
                    if (_cards.isEmpty && !showEditor) _emptyState(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 8, 14),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome_rounded, color: _pulseYellow, size: 20),
          const SizedBox(width: 8),
          const Text('PULSE', style: _pulseTitle),
          const Spacer(),
          IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.close_rounded, color: LiveTheme.onSurfaceMuted),
            tooltip: 'Close',
          ),
        ],
      ),
    );
  }

  Widget _emptyState() {
    final message = widget.isHost
        ? 'Add announcements, promo codes, or highlights for your viewers'
        : 'The host has not posted any spotlights yet';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 12),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Color(0x33FFFFFF),
          fontSize: 12,
          fontStyle: FontStyle.italic,
          height: 1.4,
        ),
      ),
    );
  }
}

/// A published spotlight card: dark glassmorphic surface, bold italic title,
/// yellow "Open Link" affordance. Host variant carries edit + remove controls.
class _SpotlightCard extends StatelessWidget {
  const _SpotlightCard({
    required this.card,
    required this.isHost,
    required this.onEdit,
    required this.onRemove,
  });

  final HostCard card;
  final bool isHost;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0x14FFFFFF), Color(0x05FFFFFF)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: LiveTheme.chipBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(card.emoji, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  card.title,
                  style: const TextStyle(
                    color: LiveTheme.onSurface,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    fontStyle: FontStyle.italic,
                    height: 1.2,
                  ),
                ),
                if (card.body.trim().isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    card.body,
                    style: const TextStyle(
                      color: Color(0x80FFFFFF),
                      fontSize: 12,
                      height: 1.45,
                    ),
                  ),
                ],
                if (card.hasLink) ...[
                  const SizedBox(height: 7),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.open_in_new_rounded,
                        color: _pulseYellow,
                        size: 13,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          card.link!.trim(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: _pulseYellow,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (isHost) ...[
            const SizedBox(width: 4),
            _CardControls(onEdit: onEdit, onRemove: onRemove),
          ],
        ],
      ),
    );
  }
}

class _CardControls extends StatelessWidget {
  const _CardControls({required this.onEdit, required this.onRemove});

  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _MiniIconButton(
          icon: Icons.edit_rounded,
          color: LiveTheme.onSurfaceMuted,
          tooltip: 'Edit',
          onTap: onEdit,
        ),
        const SizedBox(height: 4),
        _MiniIconButton(
          icon: Icons.delete_outline_rounded,
          color: const Color(0xFFFF6B6B),
          background: const Color(0x33FF2D55),
          tooltip: 'Remove',
          onTap: onRemove,
        ),
      ],
    );
  }
}

class _MiniIconButton extends StatelessWidget {
  const _MiniIconButton({
    required this.icon,
    required this.color,
    required this.onTap,
    this.background = const Color(0x14FFFFFF),
    this.tooltip,
  });

  final IconData icon;
  final Color color;
  final Color background;
  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = GestureDetector(
      onTap: onTap,
      child: Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: color, size: 15),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

/// The add / edit form: emoji picker + title + body + optional link, matching
/// the web add-card form's yellow-accented glass card.
class _CardEditor extends StatefulWidget {
  const _CardEditor({
    super.key,
    required this.initial,
    required this.onCancel,
    required this.onSubmit,
  });

  final HostCard? initial;
  final VoidCallback onCancel;
  final ValueChanged<HostCard> onSubmit;

  @override
  State<_CardEditor> createState() => _CardEditorState();
}

class _CardEditorState extends State<_CardEditor> {
  late String _emoji = widget.initial?.emoji ?? HostCard.emojiPalette.first;
  late final TextEditingController _title = TextEditingController(
    text: widget.initial?.title ?? '',
  );
  late final TextEditingController _body = TextEditingController(
    text: widget.initial?.body ?? '',
  );
  late final TextEditingController _link = TextEditingController(
    text: widget.initial?.link ?? '',
  );

  bool get _canPublish => _title.text.trim().isNotEmpty;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _link.dispose();
    super.dispose();
  }

  void _publish() {
    final title = _title.text.trim();
    if (title.isEmpty) return;
    final link = _link.text.trim();
    final id =
        widget.initial?.id ??
        'card-${DateTime.now().microsecondsSinceEpoch}';
    widget.onSubmit(
      HostCard(
        id: id,
        emoji: _emoji,
        title: title,
        body: _body.text.trim(),
        link: link.isEmpty ? null : link,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0x0DFFFFFF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x33FFD24A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final emoji in HostCard.emojiPalette)
                _EmojiChip(
                  emoji: emoji,
                  selected: emoji == _emoji,
                  onTap: () => setState(() => _emoji = emoji),
                ),
            ],
          ),
          const SizedBox(height: 10),
          _PulseField(
            controller: _title,
            hint: "Title (e.g. 'Blue Hoodie Drop')",
            maxLength: 60,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          _PulseField(
            controller: _body,
            hint: 'Details (optional)',
            maxLength: 200,
            maxLines: 2,
          ),
          const SizedBox(height: 8),
          _PulseField(
            controller: _link,
            hint: 'Link (optional)',
            keyboardType: TextInputType.url,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _EditorButton(
                  label: 'Cancel',
                  onTap: widget.onCancel,
                  filled: false,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _EditorButton(
                  label: widget.initial == null ? 'Publish' : 'Save',
                  onTap: _canPublish ? _publish : null,
                  filled: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmojiChip extends StatelessWidget {
  const _EmojiChip({
    required this.emoji,
    required this.selected,
    required this.onTap,
  });

  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? const Color(0x33FFD24A) : const Color(0x0DFFFFFF),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(
            color: selected ? _pulseYellow : Colors.transparent,
          ),
        ),
        child: Text(emoji, style: const TextStyle(fontSize: 15)),
      ),
    );
  }
}

class _PulseField extends StatelessWidget {
  const _PulseField({
    required this.controller,
    required this.hint,
    this.maxLength,
    this.maxLines = 1,
    this.keyboardType,
    this.onChanged,
  });

  final TextEditingController controller;
  final String hint;
  final int? maxLength;
  final int maxLines;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLength: maxLength,
      maxLines: maxLines,
      keyboardType: keyboardType,
      onChanged: onChanged,
      style: const TextStyle(color: LiveTheme.onSurface, fontSize: 14),
      cursorColor: _pulseYellow,
      decoration: InputDecoration(
        hintText: hint,
        counterText: '',
        hintStyle: const TextStyle(color: Color(0x4DFFFFFF), fontSize: 14),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        filled: true,
        fillColor: const Color(0x0DFFFFFF),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: LiveTheme.chipBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0x66FFD24A)),
        ),
      ),
    );
  }
}

class _EditorButton extends StatelessWidget {
  const _EditorButton({
    required this.label,
    required this.onTap,
    required this.filled,
  });

  final String label;
  final VoidCallback? onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: enabled ? 1 : 0.3,
        child: Container(
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: filled ? _pulseYellow : const Color(0x0DFFFFFF),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: filled ? Colors.black : LiveTheme.onSurfaceMuted,
              fontSize: 12,
              fontWeight: filled ? FontWeight.w900 : FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.add_rounded, color: _pulseYellow, size: 15),
          SizedBox(width: 3),
          Text(
            'Add',
            style: TextStyle(
              color: _pulseYellow,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// PULSE panel accent: the web `text-yellow-400` (`#FACC15`).
const Color _pulseYellow = Color(0xFFFACC15);

const TextStyle _pulseTitle = TextStyle(
  color: LiveTheme.onSurface,
  fontSize: 20,
  fontWeight: FontWeight.w900,
  fontStyle: FontStyle.italic,
  letterSpacing: -0.5,
);

const TextStyle _pulseAccentLabel = TextStyle(
  color: _pulseYellow,
  fontSize: 10,
  fontWeight: FontWeight.w900,
  letterSpacing: 2,
);
