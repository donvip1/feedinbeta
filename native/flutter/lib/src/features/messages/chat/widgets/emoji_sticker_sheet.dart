import 'package:flutter/material.dart';

/// Metadata for a sticker that can be sent as a canonical sticker message.
class ChatSticker {
  const ChatSticker({
    required this.id,
    required this.emoji,
    required this.name,
    this.description = '',
  });

  final String id;
  final String emoji;
  final String name;
  final String description;
}

/// Modern, self-contained emoji and sticker picker for the chat composer.
///
/// The parent owns persistence/network work. Emoji taps only return the
/// selected character; sticker taps return [ChatSticker] metadata.
class EmojiStickerSheet extends StatefulWidget {
  const EmojiStickerSheet({
    super.key,
    required this.onEmojiSelected,
    required this.onStickerSelected,
    this.initialTab = EmojiStickerTab.stickers,
    this.stickers = defaultChatStickers,
    this.emojis = defaultChatEmojis,
  });

  final ValueChanged<String> onEmojiSelected;
  final ValueChanged<ChatSticker> onStickerSelected;
  final EmojiStickerTab initialTab;
  final List<ChatSticker> stickers;
  final List<String> emojis;

  /// Presents the picker as a native rounded bottom sheet.
  static Future<void> show(
    BuildContext context, {
    required ValueChanged<String> onEmojiSelected,
    required ValueChanged<ChatSticker> onStickerSelected,
    EmojiStickerTab initialTab = EmojiStickerTab.stickers,
    List<ChatSticker> stickers = defaultChatStickers,
    List<String> emojis = defaultChatEmojis,
  }) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => EmojiStickerSheet(
        onEmojiSelected: onEmojiSelected,
        onStickerSelected: onStickerSelected,
        initialTab: initialTab,
        stickers: stickers,
        emojis: emojis,
      ),
    );
  }

  @override
  State<EmojiStickerSheet> createState() => _EmojiStickerSheetState();
}

enum EmojiStickerTab { stickers, emojis }

class _EmojiStickerSheetState extends State<EmojiStickerSheet> {
  late EmojiStickerTab _tab = widget.initialTab;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: const Color(0xff111827),
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 360,
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 14, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: SegmentedButton<EmojiStickerTab>(
                        segments: const [
                          ButtonSegment(
                            value: EmojiStickerTab.stickers,
                            icon: Icon(Icons.auto_awesome, size: 17),
                            label: Text('Stickers'),
                          ),
                          ButtonSegment(
                            value: EmojiStickerTab.emojis,
                            icon: Icon(Icons.emoji_emotions_outlined, size: 17),
                            label: Text('Emoji'),
                          ),
                        ],
                        selected: {_tab},
                        onSelectionChanged: (value) =>
                            setState(() => _tab = value.first),
                        style: ButtonStyle(
                          visualDensity: VisualDensity.compact,
                          textStyle: WidgetStatePropertyAll(
                            theme.textTheme.labelMedium,
                          ),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Close',
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: _tab == EmojiStickerTab.stickers
                      ? _StickerGrid(
                          key: const ValueKey('stickers'),
                          stickers: widget.stickers,
                          onSelected: widget.onStickerSelected,
                        )
                      : _EmojiGrid(
                          key: const ValueKey('emojis'),
                          emojis: widget.emojis,
                          onSelected: widget.onEmojiSelected,
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StickerGrid extends StatelessWidget {
  const _StickerGrid({
    super.key,
    required this.stickers,
    required this.onSelected,
  });

  final List<ChatSticker> stickers;
  final ValueChanged<ChatSticker> onSelected;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: .86,
      ),
      itemCount: stickers.length,
      itemBuilder: (context, index) {
        final sticker = stickers[index];
        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => onSelected(sticker),
          child: Ink(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .06),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: .08)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(sticker.emoji, style: const TextStyle(fontSize: 36)),
                const SizedBox(height: 5),
                Text(
                  sticker.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EmojiGrid extends StatelessWidget {
  const _EmojiGrid({super.key, required this.emojis, required this.onSelected});

  final List<String> emojis;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 8,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
      ),
      itemCount: emojis.length,
      itemBuilder: (context, index) => InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => onSelected(emojis[index]),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .06),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(emojis[index], style: const TextStyle(fontSize: 25)),
          ),
        ),
      ),
    );
  }
}

const defaultChatStickers = <ChatSticker>[
  ChatSticker(id: 'rocket', emoji: '🚀', name: 'Rocket'),
  ChatSticker(id: 'fire', emoji: '🔥', name: 'Fire'),
  ChatSticker(id: 'cool', emoji: '😎', name: 'Cool'),
  ChatSticker(id: 'party', emoji: '🎉', name: 'Party'),
  ChatSticker(id: 'robot', emoji: '🤖', name: 'Robot'),
  ChatSticker(id: 'idea', emoji: '💡', name: 'Idea'),
  ChatSticker(id: 'star', emoji: '⭐', name: 'Star'),
  ChatSticker(id: 'pizza', emoji: '🍕', name: 'Pizza'),
];

const defaultChatEmojis = <String>[
  '😀',
  '😂',
  '😍',
  '🤔',
  '👍',
  '👎',
  '❤️',
  '🎉',
  '✨',
  '🔥',
  '🚀',
  '💡',
  '👀',
  '🙌',
  '💻',
  '⚡',
  '🥳',
  '😭',
  '🙏',
  '💯',
  '😅',
  '🤝',
  '👏',
  '🌟',
];
