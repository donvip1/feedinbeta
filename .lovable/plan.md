

## Video Stream Room Rebuild Plan

### Goal
Rebuild `TwitterStreamRoom.tsx` with the Tango/TikTok UI from the reference code while keeping all existing backend integrations (LiveKit, Supabase real-time, gifts, reactions, chat, PK battle, share, etc.) fully functional. Also fix screen share (publish to LiveKit) and recording (client-side).

### UI Changes (from reference code)

1. **Video background**: Full-screen video with gradient overlays (`bg-gradient-to-b from-black/40 via-transparent to-black/60`)
2. **Host tag**: Top-left pill with avatar, name, crown icon, viewer count, and Follow button (Tango style)
3. **PK Battle split**: Side-by-side video layout with animated score bar when PK is active
4. **Header controls**: Minimize button (left), "HD Live" badge + close button (right) — replaces current ArrowLeft/End/Settings layout
5. **Right-side action stack**: Vertical TikTok-style buttons (Heart, Share, Flip, Gift lightning bolt) replacing current icon column
6. **Flying chat**: Left-aligned chat bubbles with `bg-black/40 backdrop-blur-md` pills, auto-scrolling, mask gradient — replaces inline chat input
7. **Bottom broadcast bar**: Combined input + send button + gift button + screen share button in one row with `bg-gradient-to-t from-black/80` gradient
8. **Gift overlay**: Full-screen dark overlay with 2-column grid of gift items, balance display at bottom
9. **Floating minimized player**: Landscape aspect-ratio with play button overlay and expand/close controls

### Functional Fixes

1. **Screen share**: Actually publish screen track to LiveKit via `room.localParticipant.publishTrack()` with `Track.Source.ScreenShare`, and handle `TrackUnpublished` for cleanup. Viewers subscribe via existing `TrackSubscribed` handler.
2. **Recording**: Replace broken edge function calls with client-side `useSpaceRecorder` hook (already built for spaces), adapted for video streams. Auto-start if host, upload blob on end, save `recording_url`.
3. **Camera flip**: Add `RotateCcw` button to switch between front/back camera using `videoTrackRef.current.restartTrack({ facingMode })`.

### Files to Modify

1. **`src/components/live/twitter-space/TwitterStreamRoom.tsx`** — Full rebuild of the render output with new Tango/TikTok UI. Keep all existing hooks, state, LiveKit init, Supabase subscriptions, and handler functions. Replace:
   - Header → new HD Live badge + minimize/close layout
   - Host info overlay → Tango-style pill with avatar + Follow
   - Right action stack → TikTok vertical buttons (Heart, Gift lightning, Share, Flip, Screen share, PK)
   - Bottom controls → combined broadcast input bar with gift + screen share buttons
   - Flying chat → left-aligned auto-scroll chat bubbles
   - Fix `handleScreenShare` to publish/unpublish LiveKit screen track
   - Fix `handleRecordingToggle` to use client-side MediaRecorder
   - Add camera flip handler

2. **`src/components/live/FloatingStreamPlayer.tsx`** — Update to landscape `aspect-video` layout matching reference (play button overlay, expand/close on hover)

### What stays the same
- All LiveKit initialization logic
- All Supabase real-time subscriptions (reactions, gifts, chat, stream events)
- Guest list view
- All modals (Gift, Report, Rules, Feedback, Audio Settings, PK Battle)
- Share menu (with OG link)
- Reaction picker bottom sheet
- All data fetching (stream, host, viewers)

