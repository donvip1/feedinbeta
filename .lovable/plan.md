

# Fix: Raised Hand Persistence + Move Share to Settings

## Issue 1: Hands Still Showing After Promotion

**Root Cause**: Two problems:

1. **Promoted user's local state**: In `LiveSpaceRoom.tsx` line 441-461, when the promotion broadcast is received, `setMyRole(newRole)` is called but `setHasRaisedHand(false)` is **never called**. So the promoted user's hand state stays `true` locally until `fetchSpeakers()` completes — and there's a race condition where the broadcast can arrive before the DB update is visible.

2. **Other users' view**: The realtime listener (line 292) calls `fetchSpeakers()` on any `UPDATE` to `live_space_speakers`, which should clear the hand for other viewers. But the `promoteToSpeaker` function in `SpeakerQueuePanel.tsx` sends the broadcast channel message **before the DB update is guaranteed to be propagated** to realtime listeners, creating a timing gap where the old `has_raised_hand: true` state is still visible.

**Fix**:
- In `LiveSpaceRoom.tsx` promotion handler (~line 450): add `setHasRaisedHand(false)` immediately when promotion is received
- Add a small delay before `fetchSpeakers()` in the promotion handler to ensure DB consistency
- In `SpeakerQueuePanel.tsx`: ensure `await` on the DB update completes before sending broadcast, and call `fetchSpeakers` from the calling component via `onSpeakerUpdate`

## Issue 2: Move Share Button to Settings

**Current state**: The Share button exists in two places:
- `LiveSpaceRoom.tsx` line 1792-1799: A floating button on the right side stack
- `TwitterSpaceControls.tsx` line 80-85: In the center control bar

**Plan**:
- Remove the Share button from `LiveSpaceRoom.tsx` right-side action stack (lines 1789-1799)
- Remove the Share button from `TwitterSpaceControls.tsx` center icons section
- Add a "Share Space" option to `TwitterSpaceSettingsMenu.tsx` with `Share2` icon, accepting an `onShareClick` callback prop
- Since `LiveSpaceRoom.tsx` doesn't use `TwitterSpaceSettingsMenu`, add a settings menu (or a three-dot dropdown) in the space header/controls that includes the Share option — or add it to the existing `MoreVertical` dropdown that appears on speaker avatars

Looking more closely, `LiveSpaceRoom.tsx` has no dedicated settings menu. The simplest approach:
- Add a Settings button to the right-side floating stack (replacing or alongside Share)
- Create a simple bottom sheet settings menu within `LiveSpaceRoom.tsx` that includes Share, Report, View Rules, and Captions options
- Update `TwitterSpaceSettingsMenu.tsx` to accept `onShareClick` prop for the Twitter-style space view

## Files to Change

1. **`src/components/live/LiveSpaceRoom.tsx`**
   - Add `setHasRaisedHand(false)` in the promotion broadcast handler
   - Replace Share button in right-side stack with Settings button
   - Add settings bottom sheet state and UI with Share as an option

2. **`src/components/live/SpeakerQueuePanel.tsx`**  
   - Ensure promotion flow is sequenced correctly (DB update → wait → broadcast)

3. **`src/components/live/twitter-space/TwitterSpaceControls.tsx`**
   - Remove the Share button from center icons

4. **`src/components/live/twitter-space/TwitterSpaceSettingsMenu.tsx`**
   - Add `onShareClick` prop and "Share Space" option with Share2 icon

