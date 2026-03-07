

# Messaging UI Polish & Media Fixes

## Problems Identified

1. **Media bubbles (images/videos) display incorrectly** — `max-w-[280px] max-h-[320px]` constraints are too small; images appear cropped or don't render properly in the bubble. The `ChatMediaViewer` video player lacks proper controls (progress bar, fullscreen, portrait mode).

2. **Video viewer is basic** — No progress bar, no time display, no fullscreen toggle, no portrait-optimized layout like Telegram/WhatsApp.

3. **Overall UI elements are oversized** — Avatar sizes (w-12, w-14), button sizes (h-9, w-9), font sizes (text-[16px]), padding (p-3.5, p-4), and conversation card rounding (rounded-[24px]) are all too large. Needs Telegram-like compact sizing.

4. **Input bar and feature buttons not compact** — MediaDock icons (w-12 h-12), button gaps, and input padding are oversized.

5. **Search bar styling** — Too large padding, not compact enough.

## Plan

### 1. MediaMessageBubble.tsx — Fix image/video display
- Increase image max-width from `280px` to `min(100%, 320px)` and max-height to `400px` for better rendering
- For videos: show a thumbnail frame with play overlay and duration badge, properly sized for portrait videos
- Remove the oversized download placeholder for own messages (already auto-displayed)

### 2. ChatMediaViewer.tsx — Telegram-style video player
- Add a bottom progress bar with seek capability
- Add current time / duration display
- Add fullscreen toggle button
- For portrait videos: use `object-contain` with dark background filling the full screen
- Swipe-down to dismiss gesture
- Smoother open/close transitions

### 3. TikTokConversationItem.tsx — Compact Telegram-like sizing
- Avatar: `w-12 h-12` → `w-11 h-11`, border-radius from `20px` → `full` (circular like Telegram)
- Card padding: `p-3.5` → `p-2.5`
- Card rounding: `rounded-[24px]` → `rounded-xl`
- Name font: `text-[16px]` → `text-[14px]`
- Message preview: `text-[13px]` → `text-[13px]` (keep)
- Margin between items: `mb-1.5` → `mb-0.5`

### 4. ModernChatInterface.tsx — Compact chat UI
- **Header**: Avatar `w-10` → `w-9`, button size `h-9 w-9` → `h-8 w-8`, icon size `18px` → `16px`, overall header padding `py-3` → `py-2`
- **Input bar**: MediaDock icons `w-12 h-12` → `w-10 h-10`, gap between items reduced, input `text-[15px]` → `text-[14px]`, overall input row padding reduced
- **Message area**: Keep `space-y-1` but reduce `py-4` → `py-3`, `px-3` → `px-2.5`
- **Message bubbles**: `max-w-[75%]` → `max-w-[78%]`, `px-3 py-2` → `px-2.5 py-1.5` in ModernMessageBubble

### 5. Messages.tsx (Inbox) — Compact header and search
- Title: `text-2xl` → `text-xl`
- Search bar: `py-3` → `py-2.5`, `rounded-xl` → `rounded-lg`
- Button sizes in header: `w-9 h-9` → `w-8 h-8`
- Reduce overall header padding

### 6. ModernMessageBubble.tsx — Compact bubbles
- Reduce bubble padding from `px-3 py-2` → `px-2.5 py-1.5`
- Avatar: `w-8 h-8` → `w-7 h-7`

## Files to Edit
1. `src/components/messages/MediaMessageBubble.tsx` — Fix image/video sizing and display
2. `src/components/messages/ChatMediaViewer.tsx` — Full video player with controls
3. `src/components/messages/TikTokConversationItem.tsx` — Compact card sizing
4. `src/components/messages/ModernChatInterface.tsx` — Compact header, input, MediaDock
5. `src/components/messages/ModernMessageBubble.tsx` — Compact bubble padding
6. `src/pages/Messages.tsx` — Compact inbox header

