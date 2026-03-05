

## Problem Analysis

The recording system is broken because it relies entirely on **LiveKit's Egress API**, which is not available on the current LiveKit Cloud plan. Here's what happens:

1. Host enables recording and the app calls the `livekit-recording` edge function
2. The edge function tries to call LiveKit's Egress API (`StartRoomCompositeEgress`)
3. The Egress API **fails** (not available on the plan)
4. The fallback just marks `is_recording_enabled = true` in the database -- no actual recording happens
5. The edge function also tries to write to a `cf_recording_uid` column that **doesn't even exist** in `live_spaces`
6. When the space ends, `recording_url` is always `null`
7. The "Recorded Spaces" section on the Live page filters for `recording_url IS NOT NULL`, so nothing ever shows

**Confirmed by database:** All 5 recent spaces have `recording_url: null` despite recording being toggled on.

---

## Solution: Client-Side Audio Recording

Since server-side LiveKit Egress isn't available, we'll implement **client-side recording** in the host's browser. This captures all audio (local mic + remote participants) using the Web Audio API and MediaRecorder, then uploads to storage when the space ends.

### Step 1 -- Create a `recordings` storage bucket
- Create a public storage bucket called `recordings`
- Add RLS policy allowing authenticated users to upload

### Step 2 -- Build a `useSpaceRecorder` hook
- Uses `AudioContext` to mix all audio sources (local track + all remote tracks from LiveKit room)
- Records via `MediaRecorder` to produce a WebM/Opus blob
- Provides `startRecording()`, `stopRecording()` methods
- On stop, returns the audio `Blob`

### Step 3 -- Integrate into TwitterSpaceRoom
- When host joins a space with `is_recording_enabled = true`, auto-start the client-side recorder
- When recording toggle is pressed, start/stop the recorder (remove the edge function call for start -- it does nothing useful)
- When the space ends (host leaves), stop the recorder, upload the blob to the `recordings` bucket, and save the public URL to `recording_url` on the `live_spaces` row
- Show the `PostRecordingModal` with the actual recording URL

### Step 4 -- Simplify the edge function
- The `livekit-recording` edge function becomes a simple database updater (just marks `is_recording_enabled` flag) or is bypassed entirely since the client handles everything

### Step 5 -- Replay on Live page
- The existing "Recorded Spaces" section in `LiveDashboard` already works correctly -- it queries for spaces with `recording_url IS NOT NULL` and displays them with a replay button
- The `SpaceDetail` page already has replay support for ended spaces with recording URLs
- No changes needed here; once recordings are actually saved, they'll appear automatically

### Technical Details

**Audio mixing approach:**
```text
LocalAudioTrack ──┐
                   ├──► AudioContext (destination) ──► MediaRecorder ──► Blob
RemoteTrack(s) ───┘
```

**Upload path:** `recordings/{spaceId}/{timestamp}.webm` in the `recordings` bucket

**Files to create/modify:**
- `src/hooks/useSpaceRecorder.ts` (new) -- client-side recording hook
- `src/components/live/twitter-space/TwitterSpaceRoom.tsx` -- integrate the hook, upload on end
- Database migration: create `recordings` storage bucket + policies

