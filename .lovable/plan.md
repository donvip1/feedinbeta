

## Plan: Screen Sharing for Hosts + Space Recording & Post-Space Feed Integration

This plan covers three major features: (1) adding screen share capability to audio spaces for hosts, (2) fixing the recording flow so ended spaces have playable recordings, and (3) auto-posting ended recorded spaces to the home feed and live dashboard.

---

### 1. Screen Share for Hosts in TwitterSpaceRoom

**Current state**: TwitterSpaceRoom (audio spaces) has no screen share button. LiveSpaceRoom and TwitterStreamRoom already have screen share implementations using `spaceRoomManager.startScreenShare()`.

**Changes**:
- **TwitterSpaceRoom.tsx**: Add a `Monitor` icon button in the host's control bar (next to Mute All). When tapped, it calls `spaceRoomManager.startScreenShare()` via the SpaceContext. When screen is being shared, show a screen share preview overlay at the top of the room and a stop button. Listeners/speakers see the shared screen in a video element overlay.
- Import `Monitor`, `MonitorOff` from lucide-react and reuse the screen share broadcast/subscribe pattern already in `LiveSpaceRoom.tsx` (lines 1006-1070) which broadcasts `screen-share-started` and `screen-share-ended` events on the space channel.
- Add a `<video>` element overlay for viewers when a screen share is active, similar to `LiveSpaceRoom`'s screen share display section.

---

### 2. Fix Recording Flow (Auto-Record + Save URL on End)

**Current state**: The `livekit-recording` edge function exists and calls LiveKit Egress API, but:
- Recording is only triggered manually via `handleRecordingToggle` 
- When a host ends a space via `handleLeave`, it stops recording but doesn't wait for the recording URL to be saved
- The edge function's stop action gets a recording URL from LiveKit but the space may already be marked `ended` before the URL is stored

**Changes**:

- **TwitterSpaceRoom.tsx `handleLeave`**: Before setting status to `ended`, if `is_recording_enabled` was set during creation, auto-start recording when the space starts (in useEffect on mount if host and `is_recording_enabled` is true in the space data). On leave, call the `livekit-recording` stop action and **await** the response to capture the `recordingUrl`. Update `live_spaces.recording_url` with the returned URL before marking the space as ended. Show the `PostRecordingModal` if a recording URL is available.

- **livekit-recording edge function**: The function already handles saving `recording_url` on stop. The issue is likely that LiveKit Egress isn't configured or the recording URL isn't being returned. Add a **client-side fallback**: if the edge function doesn't return a recording URL (egress unavailable), use the `audioStreamManager` to do a local MediaRecorder-based recording of the audio output, upload the blob to storage, and save that URL as `recording_url`.

- **Auto-start recording**: In `TwitterSpaceRoom.tsx`, when the host joins and the space has `is_recording_enabled: true`, automatically call `handleRecordingToggle` to start recording.

---

### 3. Ended Recorded Spaces on Live Dashboard

**Current state**: The Live Dashboard only shows live/active spaces and recommended creators. There's no "Recorded Spaces" or "Past Spaces" section on the Live page.

**Changes**:
- **LiveDashboard.tsx**: Add a "Recorded Spaces" section below the live content that queries `live_spaces` with `status = 'ended'` and `recording_url IS NOT NULL`, ordered by `ended_at DESC`, limited to 20. Each card shows cover image, title, host info, duration, viewer count, and a "Replay" badge. Tapping navigates to `/live/space/{id}` which already shows the `SpaceReplayPlayer`.
- Include share link button on each recorded space card.

---

### 4. Auto-Post Ended Spaces to Home Feed

**Current state**: `PostRecordingModal` has a manual "Post to Feed" button. There's no automatic posting.

**Changes**:
- **TwitterSpaceRoom.tsx `handleLeave`** (host path): After saving the recording URL, automatically create a post in the `posts` table with:
  - `content`: "🎙️ {space title} — Listen to the replay"
  - `media_urls`: [recording_url]
  - `media_types`: ['audio']
  - `post_type`: 'audio'
  - `metadata`: `{ source: 'live_space_recording', space_id, duration, viewer_count, share_link }`
- This post appears in the home feed naturally (not prioritized — standard chronological/algorithmic ordering).
- The post card in the feed should detect `metadata.source === 'live_space_recording'` and render a space replay card with a play button and link to the full replay page.

---

### 5. Share Links for Recorded Spaces

**Current state**: `SpaceDetail.tsx` already renders ended spaces with a replay button. No share functionality for ended spaces.

**Changes**:
- **SpaceDetail.tsx**: Add a share button for ended spaces that copies the space URL (`/live/space/{id}`) or uses native share API.
- **SpaceReplayPlayer.tsx**: Add a share button in the replay header.
- **Feed post card**: When rendering a space recording post, include a share icon that shares the space replay link.

---

### Technical Details

**Files to create/modify**:
1. `src/components/live/twitter-space/TwitterSpaceRoom.tsx` — Add screen share (host), auto-record on mount, recording stop + URL capture on leave, auto-post to feed
2. `src/components/live/LiveDashboard.tsx` — Add "Recorded Spaces" section
3. `src/pages/SpaceDetail.tsx` — Add share button for ended spaces
4. `src/components/live/SpaceReplayPlayer.tsx` — Add share button
5. `src/components/feed/PostCard.tsx` (or equivalent) — Detect space recording posts and render replay card

**Database**: No schema changes needed. `live_spaces` already has `recording_url`, `is_recording_enabled`, `share_link` columns. `posts` table already supports `metadata` JSON and `media_urls`.

