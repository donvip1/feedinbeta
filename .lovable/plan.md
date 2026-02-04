
# Live Streaming System Consolidation and Modernization

## Overview

This plan consolidates 45+ separate live streaming files into a unified, maintainable architecture inspired by your prototype. The new system will maintain real LiveKit/Supabase integrations while dramatically simplifying the codebase.

## Current State Analysis

**Problem: File Sprawl**
- 45+ files in `src/components/live/` 
- 2 separate contexts (`LiveStreamContext`, `SpaceContext`) with overlapping functionality
- Duplicate components: `LiveKitBroadcaster` (843 lines), `LiveKitViewer` (754 lines), `LiveSpaceRoom` (2111 lines)
- Multiple versions of the same components (e.g., `LiveBroadcaster`, `LiveBroadcasterV2`, `SimpleBroadcaster`)

**What Works Well (Preserve)**
- `livekit-token` edge function - solid JWT generation
- Database schema and RLS policies
- Real-time Supabase subscriptions for chat/reactions
- LiveKit track management and room connection logic
- Floating PiP player pattern
- FlyingChat TikTok-style overlay

---

## Architecture: Unified Live System

### Phase 1: Create Unified Context (Replace Two with One)

**New File: `src/context/UnifiedLiveContext.tsx`**

Combines `LiveStreamContext` + `SpaceContext` into a single polymorphic context that handles all room types:

```text
UnifiedLiveContext
├── State
│   ├── isActive: boolean
│   ├── isMinimized: boolean
│   ├── currentRoom: UnifiedRoom | null (video/audio/pk_battle)
│   ├── connectionStatus: ConnectionStatus
│   ├── isMuted: boolean
│   ├── isCameraOn: boolean (video only)
│   ├── isHost: boolean
│   ├── viewerCount: number
│   └── audioLevels: Record<string, number> (spaces only)
│
├── Actions
│   ├── joinRoom(room, role) - Unified entry point
│   ├── leaveRoom() - Cleanup all tracks/channels
│   ├── minimize() / maximize()
│   ├── toggleMic() / toggleCamera()
│   └── switchRoomType() (for PK battles)
│
└── Refs
    ├── roomRef: LiveKit Room
    ├── videoTrackRef / audioTrackRef
    └── realtimeChannelRefs
```

**Key Changes:**
- Single room type enum: `'video_broadcast' | 'audio_space' | 'pk_battle'`
- Polymorphic behavior based on `room.type`
- Camera only initialized for video modes
- Audio levels only monitored for audio spaces

### Phase 2: Create Unified Room Component

**New File: `src/components/live/UnifiedLiveRoom.tsx`**

One component that morphs between all three modes (replacing `LiveKitBroadcaster`, `LiveKitViewer`, `LiveSpaceRoom`, and `UnifiedRoom.tsx`):

```text
UnifiedLiveRoom
├── Mode Detection
│   ├── video_broadcast → Full video with camera preview
│   ├── audio_space → Audio visualizer with speaker grid
│   └── pk_battle → Split-screen with battle bar
│
├── Shared Features
│   ├── FlyingChat (left 55%, TikTok-style)
│   ├── FloatingReactions (right side)
│   ├── Connection status overlay
│   ├── Host header with follow button
│   └── Bottom control bar
│
├── Mode-Specific Rendering
│   ├── VideoStage → Camera/screen share
│   ├── AudioStage → Visualizer + speaker avatars
│   └── PKStage → Split video + battle bar + scores
│
└── Minimized PiP View
    └── Compact draggable player with controls
```

### Phase 3: Consolidate Sub-Components

**Keep These (Move to `src/components/live/shared/`):**
- `FlyingChat.tsx` - Already excellent, minor tweaks
- `FloatingReactions.tsx` - Works well
- `LiveGiftModal.tsx` - Complete gift system
- `AudioVisualizer.tsx` - From unified folder
- `PKBattleBar.tsx` - From unified folder

**Remove/Merge These:**
| Remove | Merged Into |
|--------|------------|
| `LiveKitBroadcaster.tsx` (843 lines) | `UnifiedLiveRoom.tsx` |
| `LiveKitViewer.tsx` (754 lines) | `UnifiedLiveRoom.tsx` |
| `LiveSpaceRoom.tsx` (2111 lines) | `UnifiedLiveRoom.tsx` |
| `LiveBroadcaster.tsx` | Delete (legacy) |
| `LiveBroadcasterV2.tsx` | Delete (legacy) |
| `SimpleBroadcaster.tsx` | Delete (legacy) |
| `SimpleViewer.tsx` | Delete (legacy) |
| `LiveStreamViewer.tsx` | Delete (legacy) |
| `LiveStreamViewerWebRTC.tsx` | Delete (legacy) |
| `LiveStreamPlayerV2.tsx` | Delete (legacy) |
| `FloatingStreamPlayer.tsx` | Unified PiP in context |
| `FloatingSpacePlayer.tsx` | Unified PiP in context |

**Estimated Reduction:** ~6000 lines of duplicate code removed

### Phase 4: Unified Floating Player

**New File: `src/components/live/FloatingLivePlayer.tsx`**

Single PiP component for all room types:

```text
FloatingLivePlayer
├── Draggable container (framer-motion)
├── Content based on room type
│   ├── Video → Live video preview
│   ├── Audio → Visualizer + host avatar
│   └── PK → Mini battle indicator
├── Controls
│   ├── Mic toggle
│   ├── Camera toggle (video only)
│   ├── Maximize button
│   └── End/Leave button
└── Status indicators
    ├── LIVE badge
    ├── Duration
    └── Viewer count
```

### Phase 5: Simplified Live Page

**Update: `src/pages/Live.tsx`**

Simplified to ~150 lines:

```text
Live Page
├── Queries (unchanged)
│   ├── liveStreams, liveSpaces
│   ├── scheduledStreams, scheduledSpaces
│   └── myStreams, mySpaces
│
├── State
│   └── selectedRoom: { id, type } | null
│
├── Render Logic
│   ├── If selectedRoom → <UnifiedLiveRoom room={...} />
│   ├── Else → <LiveDashboard ... />
│
└── Modals
    ├── CreateLiveStreamModal (keep)
    ├── CreateSpaceModal (keep)
    └── GoLiveModal (keep)
```

---

## File Structure After Consolidation

```text
src/
├── context/
│   └── UnifiedLiveContext.tsx (NEW - replaces 2 files)
│
├── components/live/
│   ├── UnifiedLiveRoom.tsx (NEW - main component ~800 lines)
│   ├── FloatingLivePlayer.tsx (NEW - unified PiP)
│   ├── LiveDashboard.tsx (KEEP - minimal changes)
│   │
│   ├── shared/
│   │   ├── FlyingChat.tsx (MOVE)
│   │   ├── FloatingReactions.tsx (MOVE)
│   │   ├── AudioVisualizer.tsx (MOVE)
│   │   ├── PKBattleBar.tsx (MOVE)
│   │   ├── ConnectionOverlay.tsx (NEW)
│   │   └── LiveControlBar.tsx (NEW)
│   │
│   ├── modals/
│   │   ├── CreateLiveStreamModal.tsx (KEEP)
│   │   ├── CreateSpaceModal.tsx (KEEP)
│   │   ├── LiveGiftModal.tsx (KEEP)
│   │   └── GoLiveModal.tsx (KEEP)
│   │
│   └── cards/
│       ├── LiveDiscoverCard.tsx (KEEP)
│       └── SpaceCard.tsx (KEEP)
│
└── pages/
    └── Live.tsx (SIMPLIFIED)
```

**Files to Delete (25+):**
- `LiveStreamContext.tsx`, `SpaceContext.tsx`
- All legacy broadcasters and viewers
- Duplicate floating players
- Unused V2 components

---

## Technical Implementation Details

### UnifiedLiveContext Core Logic

```typescript
// Polymorphic room joining
const joinRoom = async (room: LiveRoom, role: string) => {
  setState(prev => ({ ...prev, connectionStatus: 'connecting' }));
  
  // Get LiveKit token
  const { data } = await supabase.functions.invoke('livekit-token', {
    body: {
      roomName: room.type === 'audio_space' ? `space-${room.id}` : `stream-${room.id}`,
      participantIdentity: user.id,
      isHost: role === 'host',
    },
  });
  
  // Create room with type-specific settings
  const lkRoom = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: room.type !== 'audio_space' ? { resolution: VideoPresets.h720 } : undefined,
  });
  
  // Connect and publish tracks based on room type
  await lkRoom.connect(data.url, data.token);
  
  if (role === 'host' || role === 'speaker') {
    const audioTrack = await createLocalAudioTrack({ ... });
    await lkRoom.localParticipant.publishTrack(audioTrack);
    
    if (room.type !== 'audio_space') {
      const videoTrack = await createLocalVideoTrack({ ... });
      await lkRoom.localParticipant.publishTrack(videoTrack);
    }
  }
  
  setState({ isActive: true, currentRoom: room, connectionStatus: 'connected' });
};
```

### UnifiedLiveRoom Rendering Logic

```tsx
const UnifiedLiveRoom = () => {
  const { state, actions } = useUnifiedLive();
  const { currentRoom, isMinimized } = state;
  
  if (isMinimized) return <FloatingLivePlayer />;
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header - same for all types */}
      <RoomHeader room={currentRoom} onClose={actions.leaveRoom} />
      
      {/* Stage - polymorphic based on room type */}
      {currentRoom.type === 'pk_battle' && currentRoom.pkData ? (
        <PKBattleStage pkData={currentRoom.pkData} />
      ) : currentRoom.type === 'audio_space' ? (
        <AudioSpaceStage speakers={speakers} audioLevels={state.audioLevels} />
      ) : (
        <VideoStage videoRef={videoRef} hasVideo={hasVideo} />
      )}
      
      {/* Overlays - same for all types */}
      <FlyingChat messages={comments} gifts={flyingGifts} />
      <FloatingReactions reactions={reactions} />
      
      {/* Controls - adapts to room type */}
      <LiveControlBar 
        roomType={currentRoom.type}
        isMuted={state.isMuted}
        isCameraOn={state.isCameraOn}
        onToggleMic={actions.toggleMic}
        onToggleCamera={actions.toggleCamera}
      />
    </div>
  );
};
```

---

## Implementation Order

### Step 1: Create UnifiedLiveContext (~400 lines)
- Merge state from both existing contexts
- Implement polymorphic `joinRoom`, `leaveRoom`
- Keep existing LiveKit connection logic
- Add network auto-reconnection
- Provide at App.tsx level (replacing both providers)

### Step 2: Create UnifiedLiveRoom (~800 lines)
- Port host/viewer logic from LiveKitBroadcaster/LiveKitViewer
- Port audio space logic from LiveSpaceRoom
- Implement mode-switching rendering
- Add PK Battle mode support
- Integrate existing FlyingChat and FloatingReactions

### Step 3: Create FloatingLivePlayer (~200 lines)
- Merge FloatingStreamPlayer + FloatingSpacePlayer
- Polymorphic display based on room type
- Draggable with edge snapping
- Controls adapt to room type

### Step 4: Update Live.tsx (~150 lines)
- Remove direct component imports for broadcasters/viewers
- Use UnifiedLiveRoom for all room types
- Keep dashboard and modal logic

### Step 5: Move shared components to organized folders
- Create `shared/`, `modals/`, `cards/` directories
- Move and clean up imports

### Step 6: Delete legacy files
- Remove all replaced files
- Update imports across the app

---

## Benefits After Implementation

| Metric | Before | After |
|--------|--------|-------|
| Live component files | 45+ | ~15 |
| Context files | 2 | 1 |
| Total lines of code | ~8000+ | ~2500 |
| Room-specific components | 6+ | 1 |
| Floating players | 2 | 1 |
| Duplicate LiveKit logic | 4 places | 1 place |

**Additional Benefits:**
- Single source of truth for live state
- Easier to add new room types (e.g., watch parties)
- Consistent UI/UX across all modes
- Simpler debugging - one component to trace
- Better performance - shared connection logic
- Easier testing - one context to mock

---

## Risk Mitigation

1. **Preserve Working Features:** Keep existing database queries, RLS policies, and realtime subscriptions unchanged

2. **Incremental Migration:** Create new files alongside old ones, switch over gradually

3. **Feature Parity Checklist:**
   - Video broadcasting with camera/screen share
   - Audio spaces with speaker management
   - PK Battles with score tracking
   - Flying chat with @mentions
   - Gift animations
   - Floating reactions
   - Minimizable PiP
   - Auto-reconnection
   - Host end detection

4. **Rollback Plan:** Old files remain until new system is verified working

