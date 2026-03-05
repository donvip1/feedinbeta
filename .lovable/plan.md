

## Plan: Fix Live Space Recording Flow

### Root Causes Identified

**1. Room name mismatch (primary bug)**: The `livekit-recording` edge function constructs the room name as `room-${roomId}` (line 142), but the actual LiveKit room is created with `space-${roomId}` (confirmed in `useSpaceLiveKit.ts` and `SpaceContext.tsx`). This causes the Egress API to return `"requested room does not exist"`, meaning recording never starts.

**2. No PostRecordingModal shown**: `PostRecordingModal` is never imported in `TwitterSpaceRoom.tsx`. After `handleLeave`, the code just calls `onClose()` regardless of recording state. The host never sees the recording/sharing modal.

**3. No fallback when Egress unavailable**: If the LiveKit plan doesn't include Egress, recording silently fails with no client-side alternative.

### Fixes

**A. Fix room name in edge function** (`supabase/functions/livekit-recording/index.ts`)
- Change `room-${roomId}` to use the correct prefix based on `roomType`:
  - `live_spaces` → `space-${roomId}`
  - `live_streams` → `stream-${roomId}`

**B. Add PostRecordingModal to TwitterSpaceRoom** (`TwitterSpaceRoom.tsx`)
- Import `PostRecordingModal`
- Add state: `showPostRecordingModal`, `finalRecordingUrl`
- In `handleLeave`: instead of calling `onClose()` immediately after ending, if `isRecording` was true (host had recording on), show the `PostRecordingModal` with the recording URL (or a fallback message)
- The modal already has "Post to Feed", "Download", and share functionality
- Only call `onClose()` after the modal is dismissed

**C. Handle missing recording URL gracefully**
- If the edge function returns no `recordingUrl` (egress unavailable), still show the modal but with a message that the recording is processing or unavailable
- Keep the auto-post logic but only trigger it when a real URL exists

### Files to modify
1. `supabase/functions/livekit-recording/index.ts` — Fix room name prefix
2. `src/components/live/twitter-space/TwitterSpaceRoom.tsx` — Import and show PostRecordingModal, restructure handleLeave flow

