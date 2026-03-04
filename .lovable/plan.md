

# Phase 2 Messaging Audit: Link Previews, Chat Archive, Conversation Muting

## Important Note
The build output you're seeing is **not an error** — it's a successful build (✓ 6540 modules transformed). The output just gets truncated due to the large number of asset files being listed.

---

## Feature 1: Link Preview Cards

**What it does**: When a message contains a URL, display a rich preview card (title, description, image, domain) below the message text — like WhatsApp/Telegram.

**Implementation**:
- Create a new edge function `extract-link-metadata` that fetches a URL's Open Graph tags (og:title, og:description, og:image) server-side to avoid CORS issues
- Create a `LinkPreviewCard` component that renders the preview (image, title, description, domain favicon)
- Modify `ModernMessageBubble` to detect URLs in message content using regex, call the edge function, and render `LinkPreviewCard` below the text
- Cache link metadata in localStorage keyed by URL to avoid refetching

**Files**:
- `supabase/functions/extract-link-metadata/index.ts` (new)
- `src/components/messages/LinkPreviewCard.tsx` (new)
- `src/components/messages/ModernMessageBubble.tsx` (edit — add URL detection + preview rendering)

---

## Feature 2: Chat Archive

**What it does**: Users can archive conversations to hide them from the main chat list. Archived chats appear in a separate "Archived" section accessible from the inbox.

**Implementation**:
- Add `is_archived` boolean column (default false) to `conversation_participants` table via migration
- Add swipe-to-archive gesture on `TikTokConversationItem` (swipe left reveals Archive button)
- Filter archived conversations out of the main list in `Messages.tsx`
- Add an "Archived Chats" row at the top of the conversation list (shows count)
- Tapping it expands/navigates to show archived conversations
- Receiving a new message in an archived chat automatically unarchives it

**Files**:
- DB migration: add `is_archived` to `conversation_participants`
- `src/components/messages/TikTokConversationItem.tsx` (edit — add swipe-to-archive)
- `src/pages/Messages.tsx` (edit — filter archived, add archived section, auto-unarchive on new message)

---

## Feature 3: Individual Conversation Muting

**What it does**: Mute notifications for specific conversations (not the whole user, just one chat). Options: mute for 1 hour, 8 hours, 1 week, or forever.

**Implementation**:
- Add `is_muted` boolean and `muted_until` timestamp columns to `conversation_participants` table (same migration as archive)
- Add "Mute" option to the chat header's MoreVertical dropdown in `ModernChatInterface.tsx`
- Create a `MuteConversationSheet` component with duration options
- Show a muted icon (BellOff) on muted conversations in the conversation list
- Check mute status before showing notifications

**Files**:
- DB migration: add `is_muted`, `muted_until` to `conversation_participants` (combined with archive migration)
- `src/components/messages/MuteConversationSheet.tsx` (new)
- `src/components/messages/ModernChatInterface.tsx` (edit — add mute option to dropdown)
- `src/components/messages/TikTokConversationItem.tsx` (edit — show muted indicator)
- `src/pages/Messages.tsx` (edit — pass mute state, respect mute for notifications)

---

## Combined Database Migration

A single migration adds three columns to `conversation_participants`:
```sql
ALTER TABLE conversation_participants 
  ADD COLUMN is_archived boolean DEFAULT false,
  ADD COLUMN is_muted boolean DEFAULT false,
  ADD COLUMN muted_until timestamptz DEFAULT null;
```

## Execution Order
1. Run the DB migration (archive + mute columns)
2. Create link preview edge function + component
3. Add link preview to message bubbles
4. Implement archive functionality (filter, swipe, UI)
5. Implement mute functionality (sheet, dropdown, indicator)

