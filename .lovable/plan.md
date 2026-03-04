
# Messaging System Audit: WhatsApp/Telegram Feature Parity

## What You Already Have (Solid Foundation)

Your messaging system is well-built with most core WhatsApp/Telegram features already implemented:

| Feature | DM Chat | Group Chat | Status |
|---------|---------|------------|--------|
| Text messages with optimistic UI | ✅ | ✅ | Working |
| Image/video/file attachments | ✅ | ✅ | Working |
| Voice messages with waveform | ✅ | ✅ | Working |
| Reply to messages (swipe) | ✅ | ✅ | Working |
| Emoji reactions (tap context menu) | ✅ | ✅ | Working |
| Message forwarding | ✅ | ✅ | Working |
| Read receipts (double ticks) | ✅ | — | Working |
| Typing/activity indicators | ✅ | ✅ | Working |
| Online/last seen presence | ✅ | ✅ | Working |
| Message editing | ✅ | ✅ | Working |
| Delete for me / for everyone | ✅ | ✅ | Working |
| Pinned messages | ✅ | ✅ | Working |
| Starred messages | ✅ | — | Working |
| Message search | ✅ | ✅ | Working |
| Shared media gallery | ✅ | ✅ | Working |
| Secret mode / view-once | ✅ | ✅ | Working |
| Disappearing messages (groups) | — | ✅ | Working |
| Scheduled messages | ✅ | — | Working |
| Voice/video calls (1:1) | ✅ | — | Working |
| Group calls (LiveKit) | — | ✅ | Working |
| Message report | ✅ | ✅ | Working |
| AI smart replies | ✅ | — | Working |
| In-chat gifts | ✅ | — | Working |
| Group admin/roles | — | ✅ | Working |
| Group invite links | — | ✅ | Working |
| Group polls | — | ✅ | Working |
| Blocked/muted users | ✅ | — | Working |
| E2E encryption (ECDH/AES) | ✅ | — | Working |
| Unified realtime (single channel) | ✅ | ✅ | Working |
| Message caching (instant load) | ✅ | — | Working |
| Chat sounds | ✅ | ✅ | Working |
| Date separators (Today/Yesterday) | ✅ | ✅ | Working |
| Message grouping by sender/time | ✅ | ✅ | Working |

---

## What's Missing (Compared to WhatsApp/Telegram)

### Priority 1 — High Impact, Users Will Notice

1. **Link previews in messages** — When a user sends a URL, WhatsApp/Telegram show a rich card with title, description, and image (Open Graph metadata). Currently, URLs are just plain text. This requires a backend function to fetch OG metadata and a `LinkPreviewCard` component.

2. **Chat archive** — No way to archive conversations to clean up the inbox without deleting them. WhatsApp has "Archived" section at the top. Needs an `archived` flag on `conversation_participants` and an "Archived" section in the inbox.

3. **Mute individual conversations** — Users can block/mute users globally but can't mute a single conversation's notifications (e.g., mute for 8 hours, 1 week, always). Needs a `muted_until` column on `conversation_participants`.

4. **Contact/user info panel from chat** — Tapping the header shows the profile page, but WhatsApp/Telegram have an in-chat info sheet showing shared media, starred messages, encryption status, mute/block options — all without leaving the chat. Currently missing for DMs (groups have `GroupInfoSheet`).

5. **Message pagination (load older messages)** — DM chat loads up to 1000 messages in one query. For long conversations this is slow and wasteful. The `VirtualizedMessageList` component exists with `onLoadMore` support, but it's not wired into `ModernChatInterface`. Should load 50 messages initially and paginate upward.

6. **Disappearing messages for DMs** — Only groups support disappearing messages. WhatsApp/Telegram support this in 1:1 chats too. Needs a `disappearing_duration` on conversations.

### Priority 2 — Nice to Have, Polish

7. **Chat wallpaper/background** — WhatsApp lets you customize chat backgrounds. Low effort, high personalization feel.

8. **Clear chat history** — Option to clear all messages in a conversation without deleting the conversation itself.

9. **Export chat** — WhatsApp allows exporting chat as a text file. Could be a simple text download.

10. **Unread message counter on scroll-to-bottom button** — The button exists and `newMessagesCount` is tracked, but confirm the count badge is visually shown on the FAB.

11. **Group read receipts** — DMs have read receipts (blue ticks) but groups don't show who has read each message (WhatsApp has this via long-press on sent messages).

12. **Broadcast lists** — Send a message to multiple users at once (like WhatsApp broadcast). Not present.

13. **Location sharing** — Send current location or live location. Not present.

14. **Contact sharing** — Share a user's profile card in chat. Not present.

---

## Bugs/Issues Found During Audit

1. **DM messages load ALL (limit 1000)** — `ModernChatInterface.tsx` line 445 loads up to 1000 messages in a single query. This will be slow for active conversations and hits the Supabase default limit. Should paginate.

2. **Group messages load 500** — `GroupChatInterface.tsx` line 325 limits to 500. Same pagination concern.

3. **Avatar click uses `window.location.href`** — `ModernMessageBubble.tsx` line 247 does `window.location.href = /profile/...` instead of `navigate()`. This causes a full page reload instead of a SPA navigation.

4. **No group message caching** — DMs use `useMessageCache` for instant loading, but `GroupChatInterface` doesn't cache messages, so groups always show a loading spinner.

5. **Scheduled messages only for DMs** — The scheduling feature exists in `ModernChatInterface` but not in `GroupChatInterface`.

6. **Starred messages only for DMs** — The star functionality isn't available in group chats.

---

## Recommended Implementation Order

```text
Phase 1 (Critical fixes):
  ├─ Fix avatar SPA navigation (1 line fix)
  ├─ Add message pagination for DMs and groups
  └─ Add group message caching

Phase 2 (Feature parity):
  ├─ Link preview cards (edge function + component)
  ├─ Chat archive functionality
  ├─ Mute individual conversations
  └─ DM contact info sheet

Phase 3 (Polish):
  ├─ Disappearing messages for DMs
  ├─ Chat wallpaper customization
  ├─ Clear/export chat
  └─ Group read receipts
```

## Technical Details

### Link Previews
- Edge function: Fetch URL → parse `<meta property="og:*">` tags → return `{ title, description, image, domain }`
- Store preview data in a `link_previews` table or embed in message metadata
- `LinkPreviewCard` component renders below the message text

### Message Pagination
- Change `loadMessages()` to fetch latest 50, ordered descending, then reverse
- Track `oldestMessageDate` cursor for loading older batches
- Wire `VirtualizedMessageList.onLoadMore` to fetch next 50 before cursor
- Preserve scroll position when prepending older messages

### Chat Archive
- Add `is_archived boolean default false` to `conversation_participants`
- Filter archived conversations out of main list
- Add "Archived" accordion section at top of inbox
- Swipe-left gesture or long-press menu option to archive

### Avatar Fix
```tsx
// Line 247 of ModernMessageBubble.tsx
// Change from:
onClick={() => window.location.href = `/profile/${message.sender_id}`}
// To:
onClick={() => navigate(`/profile/${message.sender_id}`)}
```
(Requires adding `useNavigate` to the component)

This audit confirms your messaging system covers ~85% of WhatsApp/Telegram core features. The gaps are mostly around conversation management (archive, mute, clear) and rich content (link previews). The architecture is solid — unified realtime, optimistic UI, caching — so adding these features is incremental work, not a rewrite.
