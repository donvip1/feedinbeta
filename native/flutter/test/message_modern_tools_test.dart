import 'dart:io';

import 'package:feedin/src/features/messages/chat/widgets/emoji_sticker_sheet.dart';
import 'package:feedin/src/features/messages/chat/widgets/message_photo_editor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('emoji and sticker drawer returns real selections', (
    tester,
  ) async {
    String? emoji;
    ChatSticker? sticker;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EmojiStickerSheet(
            onEmojiSelected: (value) => emoji = value,
            onStickerSelected: (value) => sticker = value,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Rocket'));
    expect(sticker?.id, 'rocket');
    expect(sticker?.emoji, '🚀');

    await tester.tap(find.text('Emoji'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('😀'));
    expect(emoji, '😀');
  });

  test('photo edit result carries the full editor pipeline metadata', () {
    final result = MessagePhotoEditResult(
      file: File('/tmp/feedin-edited-photo.jpg'),
      caption: 'Conference day',
      ratio: MessageCropRatio.story,
      rotation: 90,
      grayscale: true,
      stamp: '⭐',
    );

    expect(result.file.path, endsWith('feedin-edited-photo.jpg'));
    expect(result.caption, 'Conference day');
    expect(result.ratio, MessageCropRatio.story);
    expect(result.rotation, 90);
    expect(result.grayscale, isTrue);
    expect(result.stamp, '⭐');
  });
}
