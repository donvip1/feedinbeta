
# Live Streaming & Audio Spaces UI/UX Improvements

## Summary
This plan addresses 7 key issues in the live streaming and audio spaces experience:
1. Send button spacing from mic icon
2. "Return to Stream" showing after host ends
3. Live spaces not ending properly in database
4. End button should show "Leave" for viewers
5. Viewer count position near mute button
6. Mute All toggle functionality
7. Self mute/unmute for all users (unless hard-muted)

---

## Changes Overview

### 1. Send Button Spacing in Footer
**File:** `src/components/live/shared/BroadcastInput.tsx`

Add left margin to the send button to create visual separation from the mic icon:
- Change `gap-2` to `gap-3` in the input container
- Add `ml-2` margin to the send button wrapper

### 2. Fix "Return to Stream" After Host Ends
**File:** `src/components/live/LiveDashboard.tsx`

The "Return to Stream" button shows for hosts who have active streams. The issue is that when a host ends their stream, the `myActiveStream` query still returns data briefly.

**Solution:**
- Add a check that the stream status is still "live" before showing "Return to Stream"
- Query should already filter by `status: 'live'` - verify this is happening

**File:** `src/context/UnifiedLiveContext.tsx`

When host ends, broadcast an event to all participants to force-leave:
- Add Supabase broadcast event `{ event: 'room_ended' }` when host leaves
- All participants subscribe to this event and auto-navigate away

### 3. Fix Live Spaces Not Ending in Database
**File:** `src/context/UnifiedLiveContext.tsx` (Lines 526-540)

**Current Issue:** When a host ends an audio space, only the `live_space_speakers` table is updated - the `live_spaces` table status is NOT updated to "ended".

**Fix:** Add update to `live_spaces` table when host leaves:
```typescript
if (roomInfo.type === 'audio_space' && roleRef.current === 'host') {
  await supabase
    .from('live_spaces')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', roomInfo.id);
}
```

### 4. Change "End" to "Leave" for Non-Hosts
**File:** `src/components/live/UnifiedLiveRoom.tsx` (Lines 529-535)

**Current:** Everyone sees "End" button
**Fix:** Show "Leave" for viewers/listeners, "End" for hosts

```tsx
<button onClick={handleLeave} className="px-4 py-1.5 rounded-full bg-destructive text-white...">
  {isHost ? 'End' : 'Leave'}
</button>
```

### 5. Move Viewer Count Closer to Mute Button
**File:** `src/components/live/UnifiedLiveRoom.tsx` (Audio Space Stage section, Lines 658-680)

Move the viewer count badge to be positioned near the participant avatars/mute controls instead of in the header. This will be done by:
- Adding a viewer count badge near the speaker grid
- Positioning it closer to the mute controls

### 6. Convert "Mute All" to Toggle Button with Mic Icon
**File:** `src/components/live/shared/ParticipantsList.tsx` (Lines 110-131)

**Current:** Static "Mute All" button with MicOff icon
**Fix:** 
- Track muted state with `isMutedAll` state
- Toggle between "Mute All" (Mic icon) and "Unmute All" (MicOff icon)
- Add `onUnmuteAll` callback prop

**File:** `src/context/UnifiedLiveContext.tsx`
- Add `unmuteAll` function to unmute all participants

### 7. Allow Self Mute/Unmute (Unless Hard-Muted)
**File:** `src/components/live/UnifiedLiveRoom.tsx`

**Current:** Only hosts see mic toggle in footer
**Fix:** Show mic toggle for ALL participants who can speak (speaker, co_host, host) - but respect `isHardMuted` state

```tsx
// In FooterControlBar, show mic button for all who can speak
{(isHost || state.role === 'speaker' || state.role === 'co_host') && !state.isHardMuted && (
  <MicToggleButton ... />
)}
```

**File:** `src/context/UnifiedLiveContext.tsx` (toggleMute function, Lines 564-574)
- Add check: if user is hard-muted by host, show toast and prevent unmuting

```typescript
const toggleMute = useCallback(() => {
  if (state.isHardMuted && state.isMuted) {
    toast.error('You have been muted by the host');
    return;
  }
  // ... existing logic
}, [state.isMuted, state.isHardMuted]);
```

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/live/shared/BroadcastInput.tsx` | Add spacing between send and mic buttons |
| `src/components/live/UnifiedLiveRoom.tsx` | End/Leave button text, mic toggle for speakers, viewer count position |
| `src/context/UnifiedLiveContext.tsx` | Fix audio space ending, add room_ended broadcast, hard-mute check, unmuteAll function |
| `src/components/live/shared/ParticipantsList.tsx` | Mute All toggle button with Mic icon |
| `src/components/live/LiveDashboard.tsx` | Listen for room_ended events to clear active stream state |

### Auto-Logout Flow for Participants
When host ends:
1. Host calls `leaveRoom()` which updates database and broadcasts `room_ended` event
2. All participants receive `room_ended` event via Supabase broadcast channel
3. Each participant shows toast "Host ended the stream/space"
4. After 2 second delay, participants are navigated to `/live`

### Database Updates Required
None - using existing tables. The fix is ensuring `live_spaces.status` gets updated to "ended" when host leaves (currently only `live_streams` is being updated).
