

# Rebuild Video Livestream: "Lean-Forward" Interactive Experience

This is a major rebuild of the `TwitterStreamRoom` (2,463 lines) into a modular, feature-rich interactive video platform. The existing LiveKit WebRTC infrastructure already provides sub-500ms latency, so we keep that foundation and layer new features on top.

## Architecture Overview

```text
┌─────────────────────────────────────────────────┐
│  StreamRoomV2 (orchestrator)                     │
│  ┌─────────────────────────────────────────────┐│
│  │ Z-1: VideoEngine (WebRTC via LiveKit)       ││
│  │  - POV Switcher (multi-cam thumbnails)      ││
│  │  - PK Grid layouts (Solo/2-Way/4-Way)       ││
│  ├─────────────────────────────────────────────┤│
│  │ Z-10: InteractiveCanvas                     ││
│  │  - Click-to-Buy hotzones                    ││
│  │  - Co-Pilot voting buttons                  ││
│  ├─────────────────────────────────────────────┤│
│  │ Z-20: OverlayLayer                          ││
│  │  - AI Catch-Me-Up panel (Sparkle icon)      ││
│  │  - Co-Pilot Joystick FAB (polls/betting)    ││
│  │  - Flying chat + reactions                  ││
│  │  - Gift animations                          ││
│  │  - Live Streak badges                       ││
│  └─────────────────────────────────────────────┘│
│  StreamStateStore (Zustand) — persists polls,   │
│  AI summaries, active angles across refresh     │
└─────────────────────────────────────────────────┘
```

## What Changes vs What Stays

**Keeps (from current TwitterStreamRoom):**
- LiveKit WebRTC connection (already sub-500ms, no protocol switch needed)
- PK Battle system, gifting, co-broadcaster logic
- Supabase Presence for viewer sync
- Realtime chat via broadcast channels
- All existing DB tables (live_streams, live_stream_viewers, live_stream_gifts, etc.)

**Replaces:**
- The monolithic 2,463-line `TwitterStreamRoom.tsx` gets split into ~12 focused components
- Flat UI gets glassmorphism treatment (backdrop-blur, semi-transparent overlays)
- Static layout gets Framer Motion transitions throughout

**New Features:**
- POV Switcher (multi-cam angle selection)
- AI Catch-Me-Up summary panel
- Interactive Canvas with hotzone overlays
- Co-Pilot Joystick (polls, light/sound triggers, predictive betting)
- Live Streak flame badges
- Zustand store for state persistence across refresh

## Detailed Plan

### Phase 1: State Management + Core Shell

**1. Create Zustand store** — `src/stores/useStreamStore.ts`
- Persists: active polls, AI summary, selected camera angle, viewer streak data
- Uses `zustand/middleware` persist with localStorage
- Replaces scattered useState calls for cross-cutting concerns

**2. Create StreamRoomV2** — `src/components/live/stream-v2/StreamRoomV2.tsx`
- Orchestrator component, replaces `TwitterStreamRoom`
- Manages LiveKit connection (extracted from current code)
- Composes child components via z-index layers

### Phase 2: Video Engine + POV Switcher

**3. VideoEngine** — `src/components/live/stream-v2/VideoEngine.tsx`
- Extracts video rendering from TwitterStreamRoom (lines 1347-1418)
- Handles Solo, 2-Way PK, 4-Way PK grid layouts
- Receives tracks from LiveKit room

**4. POVSwitcher** — `src/components/live/stream-v2/POVSwitcher.tsx`
- Grid icon in bottom-right of player
- Shows thumbnail rail of available camera angles (host cam, co-broadcaster cams, screen share)
- On select: swaps which RemoteTrack is attached to the main `<video>` element
- Uses LiveKit's existing multi-track subscription (each participant = one "angle")
- Framer Motion slide-up animation for the thumbnail rail
- Mobile: thumb-accessible bottom positioning

### Phase 3: AI Catch-Me-Up

**5. AI Summary Panel** — `src/components/live/stream-v2/AICatchUpPanel.tsx`
- Sparkle icon in top-right header triggers a slide-in side panel
- Calls a new edge function `stream-ai-summary` that uses Lovable AI
- Displays: 3-bullet summary of "Last 15 Minutes", list of pinned links/products mentioned
- Data source: aggregates recent `live_stream_messages` from DB, sends to AI for summarization
- Persisted in Zustand store so it survives refresh

**6. Edge Function** — `supabase/functions/stream-ai-summary/index.ts`
- Fetches last 15 min of chat messages for the stream
- Sends to Lovable AI (google/gemini-3-flash-preview) with structured tool-calling for bullet points
- Returns JSON: `{ bullets: string[], pinnedLinks: string[] }`

### Phase 4: Interactive Canvas + Co-Pilot

**7. InteractiveCanvas** — `src/components/live/stream-v2/InteractiveCanvas.tsx`
- Z-10 transparent overlay on top of video
- Renders "Click-to-Buy" hotzones (positioned divs the host can place)
- Renders active poll voting buttons
- All elements use glassmorphism styling

**8. CoPilotJoystick** — `src/components/live/stream-v2/CoPilotJoystick.tsx`
- Floating Action Button (FAB) in bottom-left
- On tap: expands radial menu with: Create Poll, Light Trigger, Sound Trigger, Predictive Bet
- Each action opens a glassmorphic bottom sheet
- Poll results stored in Zustand + broadcast via Supabase channel

**9. PollSystem** — `src/components/live/stream-v2/PollSystem.tsx`
- Host creates poll (question + 2-4 options)
- Viewers vote via InteractiveCanvas overlay
- Results animate with Framer Motion progress bars
- Broadcast via Supabase channel for real-time sync

### Phase 5: Visual Polish + Streak System

**10. GlassmorphicOverlays** — Applied across all overlay components
- `bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl`
- Video always visible underneath

**11. StreamHeader** — `src/components/live/stream-v2/StreamHeader.tsx`
- Extracts header from TwitterStreamRoom (lines 1420-1502)
- Adds AI Sparkle icon button
- Glassmorphic treatment

**12. StreamChat** — `src/components/live/stream-v2/StreamChat.tsx`
- Extracts chat area (lines 1657-1683) + chat sidebar (lines 2095-2160)
- Flying chat messages with Framer Motion
- Live Streak flame badge next to usernames (based on consecutive days watched)

**13. LiveStreakBadge** — `src/components/live/stream-v2/LiveStreakBadge.tsx`
- Flame icon with day count
- Color intensity scales with streak length (1-3 days: orange, 4-7: red, 8+: purple)
- Data tracked client-side in localStorage per stream host

**14. StreamControls** — `src/components/live/stream-v2/StreamControls.tsx`
- Bottom bar: chat input, reaction button, refill button, POV switcher toggle
- PK target selector when in battle mode

### Phase 6: Database + Edge Functions

**15. New DB table: `stream_polls`**
```sql
CREATE TABLE stream_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  votes jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stream_polls ENABLE ROW LEVEL SECURITY;
```

**16. RLS policies** for stream_polls — authenticated users can read, stream host can insert/update.

### File Structure

```text
src/components/live/stream-v2/
├── StreamRoomV2.tsx          (orchestrator — replaces TwitterStreamRoom)
├── VideoEngine.tsx           (video player + PK grids)
├── POVSwitcher.tsx           (multi-cam angle selector)
├── AICatchUpPanel.tsx        (AI summary side panel)
├── InteractiveCanvas.tsx     (transparent overlay for hotzones + polls)
├── CoPilotJoystick.tsx       (FAB with radial menu)
├── PollSystem.tsx            (poll creation + voting)
├── StreamHeader.tsx          (glassmorphic header)
├── StreamChat.tsx            (flying chat + sidebar)
├── StreamControls.tsx        (bottom control bar)
├── LiveStreakBadge.tsx        (flame streak indicator)
├── GiftOverlay.tsx           (gift animations — extracted)
├── StreamSettings.tsx        (settings/share/reactions sheets)
├── StreamGuests.tsx          (guest management view)
└── index.ts                  (barrel exports)

src/stores/
└── useStreamStore.ts         (Zustand persistent store)

supabase/functions/
└── stream-ai-summary/
    └── index.ts              (AI summarization endpoint)
```

### Integration Points

- `LiveStreamDetail.tsx` updated to render `StreamRoomV2` instead of `TwitterStreamRoom`
- `LiveStreamContext.tsx` unchanged — still manages background persistence
- Existing `LiveKitBroadcaster` and `LiveKitViewer` remain as legacy fallbacks but are no longer primary
- All existing gifting RPCs (`send_live_gift`), viewer tables, reaction channels reused as-is

### Dependencies

- **Zustand** — needs to be added (state persistence)
- **Framer Motion** — already installed
- **Lovable AI** — already available (for AI Catch-Me-Up)
- **LiveKit** — already installed and working

### Scope & Constraints

This is a large rebuild (~15 new files, 1 new DB table, 1 new edge function, 1 new npm package). The existing `TwitterStreamRoom.tsx` is preserved during development; the route swap happens last. All existing features (gifting, PK battles, co-broadcasting, chat, reactions, presence) are carried forward into the new modular structure.

