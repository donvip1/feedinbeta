

## Plan: Restructure Emoji Picker & Sticker System

### What's changing

**Current state:** The "Sticker Picker" is actually an emoji picker with categorized emoji packs. The emoji button in the input bar only shows 6 quick emojis in a tiny popover.

**Target state:**
1. **Emoji button (😊)** opens a full Telegram/WhatsApp-style emoji keyboard with all the current categorized packs (Emotions, Gestures, Animals, Love, Food, Activities) plus additional categories (Objects, Travel, Symbols, Flags). Tabbed navigation at bottom, search bar at top, recently used section.
2. **Sticker button** opens a sticker picker for **image/video stickers** (Telegram-style animated/static sticker packs), not emojis. Initially shows placeholder sticker packs with sample sticker images.

### Changes

**1. Rename & repurpose `StickerPicker.tsx` → `EmojiKeyboard.tsx`**
- Move all emoji pack data here and expand significantly (~200+ emojis across 10 categories: Smileys, People, Gestures, Animals, Food, Activities, Travel, Objects, Symbols, Flags)
- Add a "Recently Used" tab that persists to localStorage
- Add a search/filter bar at top
- Grid layout: 8 columns, WhatsApp/Telegram hybrid styling
- Bottom tab bar with category icons
- Opens from the emoji (😊) button instead of the sticker button

**2. Rewrite `StickerPicker.tsx` for image/video stickers**
- New component that displays image-based sticker packs
- Initially ships with a few built-in packs using free sticker images (placeholder URLs)
- Stickers sent as image messages with a `sticker` type flag
- Grid of sticker thumbnails (4 columns, larger cells)
- Pack tabs at bottom with pack preview icons

**3. Update `ModernChatInterface.tsx`**
- Emoji button (Smile icon) → opens `EmojiKeyboard` as a drawer panel (like current sticker picker)
- Sticker button → opens new image-based `StickerPicker`
- Remove the tiny `EMOJI_QUICK` popover
- Both panels are mutually exclusive (opening one closes the other)

### File changes
| File | Action |
|------|--------|
| `src/components/messages/EmojiKeyboard.tsx` | **Create** — full emoji keyboard with 10 categories, search, recents |
| `src/components/messages/StickerPicker.tsx` | **Rewrite** — image/video sticker packs (Telegram-style) |
| `src/components/messages/ModernChatInterface.tsx` | **Update** — wire emoji button to EmojiKeyboard, sticker button to new StickerPicker, remove EMOJI_QUICK popover |

