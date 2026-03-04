

## Plan: Live Spaces UI/UX & Functional Improvements

This is a large set of changes across 5 areas. Given the scope, I recommend tackling them in phases. Here is the full plan:

---

### 1. Fix Volume Control Positioning (Bottom Bar Overflow)

**Problem**: The volume slider popup opens upward from the last button in the control bar, but on mobile the bar can overflow horizontally, pushing the volume button off-screen to the right. The popup also uses `left-1/2 -translate-x-1/2` which can clip off the right edge.

**Changes in `TwitterSpaceRoom.tsx`**:
- Restructure the bottom control bar layout: move the Volume button from the far-right cluster into a more accessible position
- Change the volume popup positioning from `left-1/2 -translate-x-1/2` to `right-0` so it anchors to the right edge and doesn't overflow
- Make the bottom bar horizontally scrollable or wrap buttons responsively so nothing is hidden on small screens
- Reduce gap sizes on mobile (`gap-4` instead of `gap-6`) to fit all controls

---

### 2. Fix React Button Visibility for Listeners

**Problem**: The "React" (Heart) button is currently only shown when `canSpeak` is true (line 1438: `{canSpeak && (...)}`)  meaning listeners cannot see or use it.

**Changes in `TwitterSpaceRoom.tsx`**:
- Remove the `canSpeak` guard around the React button so ALL participants (listeners included) can trigger reactions
- Keep the mic button behavior unchanged (listeners get "Request to Speak")

---

### 3. Gift Notification Routing to Host

**Problem**: The gift realtime channel already exists (lines 332-403) and shows banner animations + chat messages. However, the host doesn't get a prominent toast notification, and the sender doesn't get visual confirmation beyond a generic "sent!" toast.

**Changes in `TwitterSpaceRoom.tsx`**:
- In the gift channel handler, add a toast notification specifically for the host/receiver: `"🎁 {senderName} sent you a {giftType}! (+{credits} credits)"`
- Add a visual "Gift Sent!" confirmation animation for the sender after `LiveGiftModal` closes (brief checkmark overlay)
- The backend routing (credit deduction, `live_space_gifts` insert, notification insert) already works correctly in `LiveGiftModal.tsx`

---

### 4. Persistent Chat Likes

**Problem**: `handleLikeMessage` (line 862) only updates local state — likes reset when users leave and rejoin because there's no database persistence.

**Changes**:
- **Database migration**: Create a `live_space_message_likes` table with columns: `id`, `message_id` (FK to `live_space_messages`), `user_id`, `created_at`, with a unique constraint on `(message_id, user_id)` and RLS policies
- **Add a `likes_count` column** to `live_space_messages` table (default 0)
- **Update `TwitterSpaceRoom.tsx`**:
  - On fetch replies, also fetch like counts and whether current user liked each message
  - `handleLikeMessage`: insert/delete from `live_space_message_likes` and update the `likes_count` on `live_space_messages` (optimistic UI + DB write)

---

### 5. Recording & Playback Archive

**Problem**: The recording edge function (`livekit-recording`) exists and the UI toggle exists, but the actual LiveKit Egress integration may not be fully wired. The "Past Spaces" archive section doesn't exist on profiles.

**Changes**:
- **Verify/fix `livekit-recording` edge function**: Ensure it correctly calls LiveKit's Egress API to start/stop composite recording and stores the resulting URL in `live_spaces.recording_url`
- **Add "Past Spaces" section to user profile page**: Query `live_spaces` where `status = 'ended'` and `recording_url IS NOT NULL` for that user, display as a list of replayable cards
- **`SpaceReplayPlayer`** already exists and handles playback — just needs to be linked from the profile archive cards

---

### Summary of Files to Change

| File | Changes |
|------|---------|
| `TwitterSpaceRoom.tsx` | Fix volume popup position, show React button to listeners, add host gift toast, persist likes to DB |
| `LiveGiftModal.tsx` | Minor — add sender confirmation animation |
| `livekit-recording/index.ts` | Verify Egress API calls work correctly |
| Profile page (e.g. `UserProfile.tsx`) | Add "Past Spaces" archive section |
| **DB Migration** | Create `live_space_message_likes` table, add `likes_count` to `live_space_messages` |

### Recommended Phasing

Given the scope, I suggest implementing in this order:
1. **Phase 1** (quick wins): Items 1, 2, 3 — UI fixes and gift notifications
2. **Phase 2** (moderate): Item 4 — persistent likes (requires DB migration)
3. **Phase 3** (complex): Item 5 — recording verification and profile archive

Shall I proceed with all phases or start with Phase 1?

