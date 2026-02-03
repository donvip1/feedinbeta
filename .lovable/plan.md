
# Plan: Rebuild Live Streaming & Spaces with Unified Interface

## Overview

This plan will integrate the new unified TikTok/Tango-style live interface you provided, including:
- **Video Broadcast Mode** - LiveKit-powered video streaming
- **Audio Space Mode** - Cloudflare SFU-powered audio rooms with visualizer
- **PK Battle Mode** - Split-screen competitive battles between hosts

The architecture will maintain your existing LiveKit integration for video, Cloudflare SFU for audio, and add the new unified UI components with PK Battle functionality.

## Current Architecture Analysis

| Feature | Current Tech | Status |
|---------|--------------|--------|
| Video Streams | LiveKit (livekit-token edge function) | Working |
| Audio Spaces | Cloudflare SFU (SpaceContext, spaceRoomManager) | Working |
| Chat | FlyingChat, TikTok-style overlays | Working |
| Gifts | Full-screen animations, credit system | Working |
| Mini Player | FloatingSpacePlayer, draggable PiP | Working |

## New Features to Implement

### 1. Unified Room Types
```text
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED ROOM SYSTEM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  room_type: 'video_broadcast' | 'audio_space' | 'pk_battle'    │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   VIDEO     │  │   AUDIO     │  │      PK BATTLE          │ │
│  │  BROADCAST  │  │   SPACE     │  │   (Split Screen)        │ │
│  │             │  │             │  │                         │ │
│  │  LiveKit    │  │ Cloudflare  │  │  Host    vs  Challenger │
│  │  Video      │  │ SFU Audio   │  │  LiveKit    LiveKit     │ │
│  │  Tracks     │  │ Visualizer  │  │  Score Tracking         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. PK Battle System (New)
- Real-time score tracking via gifts
- Split-screen dual video display
- Animated HP-style progress bar
- Countdown timer
- Host vs Challenger mechanics

## New Components to Create

### Core Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `UnifiedRoom.tsx` | Single room component for all types | `src/components/live/` |
| `PKBattleBar.tsx` | Animated score bar for battles | `src/components/live/` |
| `AudioVisualizer.tsx` | Pulsing visualizer for audio spaces | `src/components/live/` |
| `LiveFeedItem.tsx` | Preview card for feed scrolling | `src/components/live/` |
| `UnifiedControlBar.tsx` | Mic/Video/Chat controls | `src/components/live/` |

### Updated Components

| Component | Changes |
|-----------|---------|
| `CreateLiveStreamModal.tsx` | Add room type selection (video/audio/pk_battle) |
| `Live.tsx` | Integrate unified feed layout |
| `LiveSpaceRoom.tsx` | Merge into UnifiedRoom |
| `LiveKitBroadcaster.tsx` | Merge into UnifiedRoom |

## Database Schema Changes

### New Table: `pk_battles`

```sql
CREATE TABLE public.pk_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES live_streams(id),
  host_id UUID REFERENCES auth.users(id) NOT NULL,
  challenger_id UUID REFERENCES auth.users(id),
  host_score INTEGER DEFAULT 0,
  challenger_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting', -- waiting, active, completed
  duration_seconds INTEGER DEFAULT 300, -- 5 minute default
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pk_battles;
```

### Update `live_streams` Table

```sql
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'video_broadcast';
-- Values: 'video_broadcast', 'audio_space', 'pk_battle'
```

## Implementation Details

### Phase 1: Core Unified Components

#### 1.1 AudioVisualizer Component
Animated bars that pulse based on audio activity:

```typescript
// src/components/live/AudioVisualizer.tsx
interface AudioVisualizerProps {
  active: boolean;
  barCount?: number;
  className?: string;
}

// Creates 5 animated bars with staggered delays
// Uses Framer Motion for smooth spring animations
```

#### 1.2 PKBattleBar Component
Tango-style animated score bar:

```typescript
// src/components/live/PKBattleBar.tsx
interface PKBattleBarProps {
  hostScore: number;
  challengerScore: number;
  timeLeft: number; // seconds
  hostName?: string;
  challengerName?: string;
}

// Features:
// - Gradient HP bar (blue left, red right)
// - Center lightning bolt divider
// - Real-time score updates
// - Countdown timer display
```

#### 1.3 UnifiedRoom Component
Main room component that handles all three modes:

```typescript
// src/components/live/UnifiedRoom.tsx
interface UnifiedRoomProps {
  room: {
    id: string;
    type: 'video_broadcast' | 'audio_space' | 'pk_battle';
    host: User;
    title: string;
    viewers: number;
    pkData?: PKBattleData;
  };
  isMinimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

// Renders different layouts based on room.type:
// - video_broadcast: Full video with LiveKit
// - audio_space: AudioVisualizer with speaker grid
// - pk_battle: Split screen with PKBattleBar
```

### Phase 2: LiveKit Integration

#### 2.1 Video Broadcast Mode
Uses existing LiveKit infrastructure:

```typescript
// Inside UnifiedRoom for video_broadcast type:
const room = new Room({
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720,
  },
});

// Token from livekit-token edge function
const { data } = await supabase.functions.invoke('livekit-token', {
  body: {
    roomName: `stream-${streamId}`,
    participantName: user.name,
    participantIdentity: user.id,
    isHost: true,
  },
});
```

#### 2.2 PK Battle Mode
Dual LiveKit rooms for split screen:

```typescript
// Host connects to: `pk-${battleId}-host`
// Challenger connects to: `pk-${battleId}-challenger`
// Both are displayed in split-screen layout
```

### Phase 3: Audio Space Integration

Uses existing Cloudflare SFU via SpaceContext:

```typescript
// Inside UnifiedRoom for audio_space type:
const spaceContext = useOptionalSpaceContext();

// Connect to audio
await spaceContext.connectAudio(myRole);

// Display AudioVisualizer with audio levels
<AudioVisualizer 
  active={spaceContext.spaceState.connectionStatus === 'connected'}
/>
```

### Phase 4: PK Battle Logic

#### 4.1 Create PK Battle Edge Function

```typescript
// supabase/functions/pk-battle-manager/index.ts
// Handles:
// - Creating new battles
// - Sending challenges
// - Accepting/declining
// - Score updates from gifts
// - Timer management
// - Winner determination
```

#### 4.2 Gift-to-Score Conversion

```typescript
// When a gift is sent during PK battle:
// 1. Record gift in live_stream_gifts
// 2. Update pk_battles score based on recipient
// 3. Broadcast score update via realtime
```

### Phase 5: UI/UX Updates

#### 5.1 Room Header
- Host avatar with level badge
- Viewer count with pulsing indicator
- Follow button
- Close/minimize controls

#### 5.2 Floating Interactions (TikTok-style)
- Right-side vertical button stack
- Heart, comment, gift buttons
- Animated reaction counts

#### 5.3 Unified Control Bar
- Mic toggle (mute/unmute)
- Camera toggle (for video modes)
- Screen share button
- Chat toggle
- End stream button

### Phase 6: Feed Integration

#### 6.1 LiveFeedItem Component
Preview cards for scrolling feed:

```typescript
// src/components/live/LiveFeedItem.tsx
interface LiveFeedItemProps {
  room: Room;
  onClick: () => void;
}

// Shows:
// - Thumbnail/preview
// - Status badges (LIVE, PK BATTLE, AUDIO SPACE)
// - Host info
// - Viewer count
```

#### 6.2 Updated Live.tsx
- Vertical scroll feed of live rooms
- Auto-play preview on scroll
- Tap to enter full room view

## File Structure

```text
src/components/live/
├── unified/
│   ├── UnifiedRoom.tsx           (NEW - Main room component)
│   ├── UnifiedControlBar.tsx     (NEW - Bottom controls)
│   ├── AudioVisualizer.tsx       (NEW - Audio space visualizer)
│   ├── PKBattleBar.tsx          (NEW - Battle score bar)
│   ├── PKBattleChallenge.tsx    (NEW - Challenge modal)
│   └── LiveFeedItem.tsx         (NEW - Feed preview card)
├── FloatingSpacePlayer.tsx       (UPDATE - Add PK support)
├── CreateLiveStreamModal.tsx     (UPDATE - Room type selection)
└── ... (existing components)

supabase/functions/
├── livekit-token/                (EXISTING - Token generation)
├── cloudflare-sfu/               (EXISTING - Audio SFU)
└── pk-battle-manager/           (NEW - Battle logic)
```

## Migration Strategy

1. **Phase 1**: Create new unified components alongside existing ones
2. **Phase 2**: Add database migrations for PK battles
3. **Phase 3**: Integrate UnifiedRoom into Live.tsx with feature flag
4. **Phase 4**: Gradually migrate from old components
5. **Phase 5**: Remove deprecated components

## Technical Considerations

### Performance
- Lazy load UnifiedRoom component
- Use virtualized list for feed items
- Preload video thumbnails
- Debounce score updates

### Compatibility
- Maintain backwards compatibility with existing streams/spaces
- Support both old and new room formats during migration

### Realtime
- Use Supabase broadcast for instant score updates
- PostgreSQL changes for persistent data
- WebSocket for LiveKit/Cloudflare SFU

## Testing Checklist

| Test | Description |
|------|-------------|
| Video broadcast | Start, view, end video stream |
| Audio space | Join as host, speaker, listener |
| PK battle | Challenge, accept, gift-to-score, timer |
| Minimize/maximize | PiP player functionality |
| Cross-device | Mobile and desktop layouts |
| Reconnection | Handle network interruptions |

## Estimated Components

| Component | Lines of Code (Est.) |
|-----------|---------------------|
| UnifiedRoom.tsx | ~600 |
| PKBattleBar.tsx | ~120 |
| AudioVisualizer.tsx | ~80 |
| UnifiedControlBar.tsx | ~150 |
| LiveFeedItem.tsx | ~100 |
| PKBattleChallenge.tsx | ~200 |
| pk-battle-manager edge function | ~300 |
| Database migrations | ~50 |

**Total: ~1,600 lines of new/modified code**

## Summary

This rebuild will create a unified, modern live streaming experience that:
1. Combines video, audio, and PK battles in one interface
2. Uses your existing LiveKit and Cloudflare SFU infrastructure
3. Adds the exciting PK Battle feature with real-time scoring
4. Maintains the TikTok-style UI with flying chat and gifts
5. Supports minimization to floating player for background listening
6. Is fully integrated with your existing gift/credit economy
