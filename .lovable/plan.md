
# Plan: Background Broadcasting & Modern Live UI Overhaul

## Overview

This plan addresses two key requirements:
1. **Background Broadcasting** - Allow hosts to navigate away while streaming continues (like TikTok/Instagram Live)
2. **Modern UI Overhaul** - Match the exact TikTok/Tango-style interface from your reference code

## Current Architecture Analysis

| Component | Current Behavior | Issue |
|-----------|-----------------|-------|
| `UnifiedRoom.tsx` | Closes when navigating away | Stream/space ends on navigation |
| `LiveKitBroadcaster.tsx` | Full-screen only | No background mode |
| `SpaceContext.tsx` | Has minimize support | Works for audio, not video |
| `FloatingSpacePlayer.tsx` | Audio-only PiP | Needs video PiP support |

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                 NEW: LiveStreamContext                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Similar to SpaceContext, but for VIDEO streaming:             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  isActive   │  │ isMinimized │  │  roomRef    │             │
│  │  (boolean)  │  │  (boolean)  │  │  (LiveKit)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  Host clicks Back → Minimize to FloatingStreamPlayer            │
│  Stream continues in background (PiP mode)                      │
│  Host can browse app while face is captured                     │
│  Stream ONLY ends when host explicitly clicks "End Stream"      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Create LiveStreamContext (New Context for Video Streaming)

### 1.1 New Context: `src/context/LiveStreamContext.tsx`

```typescript
interface StreamInfo {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  type: 'video_broadcast' | 'pk_battle';
  startedAt: string;
}

interface LiveStreamState {
  isActive: boolean;
  isMinimized: boolean;
  streamInfo: StreamInfo | null;
  isMuted: boolean;
  isCameraOn: boolean;
  isHost: boolean;
  viewerCount: number;
  connectionStatus: ConnectionStatus;
}

interface LiveStreamContextType {
  streamState: LiveStreamState;
  startStream: (streamInfo: StreamInfo) => Promise<void>;
  endStream: () => Promise<void>;
  minimizeStream: () => void;
  maximizeStream: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  // LiveKit refs
  roomRef: Room | null;
  videoTrackRef: LocalVideoTrack | null;
  audioTrackRef: LocalAudioTrack | null;
}
```

**Key Difference from Current Implementation:**
- LiveKit Room and tracks are stored in Context, not component
- Navigation away triggers `minimizeStream()`, not stream end
- Stream persists across route changes

### 1.2 Add FloatingStreamPlayer: `src/components/live/FloatingStreamPlayer.tsx`

Similar to `FloatingSpacePlayer.tsx` but for video:
- Shows host's camera in a draggable 9:16 PiP window
- Live badge, viewer count, duration timer
- Mute/Camera toggle buttons
- Maximize button to return to full view
- End Stream button (RED - the ONLY way to end)

```text
┌─────────────────────────────┐
│ 🔴 LIVE        24      0:45 │  ← Live badge, viewers, duration
├─────────────────────────────┤
│                             │
│      [Video Preview]        │  ← Host's camera (9:16)
│                             │
├─────────────────────────────┤
│  🎤  📹  [Maximize]  [END]  │  ← Controls
└─────────────────────────────┘
```

## Phase 2: Modernize UnifiedRoom UI (Match Reference Code)

### 2.1 Update Layout Structure

Your reference code has this exact structure that we need to implement:

```typescript
// Header with host info + follow button
<div className="absolute top-0 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Avatar with level badge />
    <div>
      <p>Host Name</p>
      <p>Viewer count</p>
    </div>
    <Button>Follow</Button>
  </div>
  <Button onClick={onClose}>X</Button>
</div>

// PK Battle Bar (when type === 'pk_battle')
<PKBattleBar />

// Main Stage with conditional content
<div className="flex-1">
  {type === 'pk_battle' ? <SplitScreen /> :
   type === 'audio_space' ? <AudioVisualizer /> :
   <VideoStream />}
</div>

// TikTok-style floating interactions (right side)
<div className="absolute right-4 bottom-32">
  <HeartButton />
  <CommentButton />
  <GiftButton />
</div>

// Flying chat overlay (left side, max 55% width)
<FlyingChat />

// Unified Control Bar (bottom)
<UnifiedControlBar />
```

### 2.2 Key UI Changes

| Element | Current | New (Reference) |
|---------|---------|-----------------|
| Header | Arrow + X button | Avatar with level + Follow + X |
| Host Level | Not visible | Yellow/Orange gradient badge |
| Follow Button | External | Inline red button |
| Interactions | Right side vertical | Right side with animated icons |
| Chat | Full FlyingChat | Left 55% width overlay |
| Control Bar | Icons only | Toggle states with labels |
| PiP Player | Basic | Styled with live badge + duration |

### 2.3 Audio Space Visual Update (Green Theme)

Match reference:
- Background: `from-green-900 via-emerald-800 to-teal-900`
- Pulsing circles behind host avatar
- Audio visualizer bars (5 bars, animated)
- "LIVE AUDIO" badge with Radio icon

### 2.4 PK Battle Visual Update

Match reference:
- Blue gradient left (host) / Red gradient right (challenger)
- Center divider with lightning bolt
- HP-style progress bar
- Timer in center circle
- Score labels: "Blue Team" / "Red Team"

## Phase 3: Navigation Logic Updates

### 3.1 Back Button Behavior Change

**Current:** Clicking back calls `onClose()` which ends everything

**New Logic:**
```typescript
const handleBack = () => {
  if (isHost && streamState.isActive) {
    // Host is streaming - minimize instead of close
    minimizeStream();
    navigate(-1); // Go back but keep stream running
  } else {
    // Viewer can just leave
    onClose();
  }
};
```

### 3.2 Route-Aware Stream Persistence

When host navigates to any page:
- Stream continues in background
- FloatingStreamPlayer shows as PiP
- Host can browse Feed, Messages, Wallet, etc.
- Camera continues capturing

When host explicitly ends stream:
- Click "End Stream" button in PiP or full view
- Confirmation dialog
- LiveKit disconnects
- Database updated to `status: 'ended'`

## Phase 4: File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `src/context/LiveStreamContext.tsx` | Global video stream state management |
| `src/components/live/FloatingStreamPlayer.tsx` | PiP video player for background streaming |

### Files to Update

| File | Changes |
|------|---------|
| `src/components/live/unified/UnifiedRoom.tsx` | Match reference UI, integrate with context |
| `src/components/live/unified/AudioVisualizer.tsx` | Green theme matching reference |
| `src/components/live/unified/PKBattleBar.tsx` | Tango-style HP bar with teams |
| `src/components/live/unified/UnifiedControlBar.tsx` | Toggle states + labels |
| `src/pages/Live.tsx` | Use UnifiedRoom via context |
| `src/App.tsx` | Add LiveStreamProvider |

## Phase 5: Detailed Component Updates

### 5.1 UnifiedRoom.tsx - Modern UI Matching Reference

**Header Section:**
```typescript
<div className="flex items-center gap-2">
  {/* Avatar with Level Badge */}
  <div className="relative">
    <Avatar className="w-10 h-10 border-2 border-red-500" />
    <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-500 to-orange-500 
                    text-[10px] font-bold px-1.5 rounded-full text-white">
      {host.level}
    </div>
  </div>
  
  {/* Host Info */}
  <div>
    <p className="font-medium text-white">{host.name}</p>
    <div className="flex items-center gap-1 text-xs text-white/70">
      <Users className="w-3 h-3" />
      <span>{viewers}</span>
    </div>
  </div>
  
  {/* Follow Button */}
  {!isHost && (
    <Button size="sm" className="bg-red-500 hover:bg-red-600 h-7">
      Follow
    </Button>
  )}
</div>
```

**Audio Space Mode (Green Theme):**
```typescript
<div className="bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900">
  {/* Animated background orbs */}
  <motion.div animate={{ scale: [1, 1.2, 1] }} 
              className="absolute w-64 h-64 rounded-full bg-green-500/20 blur-3xl" />
  
  {/* Center host avatar with pulse rings */}
  <motion.div animate={{ scale: [1, 1.05, 1] }}>
    <Avatar className="w-28 h-28 border-4 border-green-400/50" />
    <motion.div className="absolute -inset-2 border-2 border-green-400/40" />
  </motion.div>
  
  {/* Audio Visualizer */}
  <AudioVisualizer active={connected} barCount={5} color="bg-white" />
  
  {/* Live Badge */}
  <div className="flex items-center gap-2 bg-black/30 px-4 py-2 rounded-full">
    <Radio className="w-4 h-4 text-green-400" />
    <span className="text-green-400">LIVE AUDIO</span>
  </div>
</div>
```

### 5.2 FloatingStreamPlayer.tsx (New - Video PiP)

```typescript
export const FloatingStreamPlayer: React.FC = () => {
  const { streamState, minimizeStream, maximizeStream, endStream, toggleMute, toggleCamera } = useLiveStreamContext();
  
  if (!streamState.isActive || !streamState.isMinimized) return null;
  
  return (
    <motion.div 
      drag
      className="fixed bottom-24 right-4 z-50 w-32 aspect-[9/16] rounded-xl overflow-hidden shadow-2xl"
    >
      {/* Video Preview */}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      
      {/* Live indicator + viewer count */}
      <div className="absolute top-2 left-2 flex items-center gap-1">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-[10px] text-white font-medium">LIVE</span>
        <span className="text-[10px] text-white">{viewerCount}</span>
      </div>
      
      {/* Duration */}
      <div className="absolute top-2 right-2 text-[10px] text-white">{duration}</div>
      
      {/* Controls */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={toggleMute}>{isMuted ? <MicOff /> : <Mic />}</button>
          <button onClick={toggleCamera}>{isCameraOn ? <Video /> : <VideoOff />}</button>
        </div>
        <button onClick={maximizeStream}><Maximize2 /></button>
        <button onClick={endStream} className="bg-red-600"><PhoneOff /></button>
      </div>
    </motion.div>
  );
};
```

### 5.3 LiveStreamContext.tsx (New - Core State Management)

```typescript
export const LiveStreamProvider = ({ children }) => {
  const [streamState, setStreamState] = useState<LiveStreamState>(defaultState);
  
  // LiveKit refs - persist across navigation
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);
  
  const startStream = async (streamInfo: StreamInfo) => {
    // Initialize LiveKit, create tracks, connect to room
    // Store in refs (not component state)
    // Set streamState.isActive = true
  };
  
  const minimizeStream = () => {
    // Just hide the UI, stream continues
    setStreamState(prev => ({ ...prev, isMinimized: true }));
  };
  
  const maximizeStream = () => {
    // Show full UI again
    setStreamState(prev => ({ ...prev, isMinimized: false }));
    // Navigate to stream page
  };
  
  const endStream = async () => {
    // Disconnect LiveKit
    // Stop tracks
    // Update database
    // Reset state
  };
  
  return (
    <LiveStreamContext.Provider value={{
      streamState,
      startStream,
      endStream,
      minimizeStream,
      maximizeStream,
      roomRef: roomRef.current,
      videoTrackRef: videoTrackRef.current,
      audioTrackRef: audioTrackRef.current,
    }}>
      {children}
    </LiveStreamContext.Provider>
  );
};
```

## Phase 6: Integration with App.tsx

Add the new provider and floating player:

```typescript
// App.tsx
<SpaceProvider>
  <LiveStreamProvider>  {/* NEW */}
    <CallProvider>
      {/* ... routes ... */}
      <FloatingSpacePlayer />
      <FloatingStreamPlayer />  {/* NEW */}
      <FloatingCallWidget />
    </CallProvider>
  </LiveStreamProvider>
</SpaceProvider>
```

## Testing Checklist

| Test Case | Expected Behavior |
|-----------|-------------------|
| Host starts video stream | Camera captures, LiveKit connects |
| Host clicks back button | Stream minimizes to PiP, continues broadcasting |
| Host navigates to Feed | PiP shows, stream still live |
| Host maximizes from PiP | Returns to full stream view |
| Host clicks End Stream | Confirmation → Stream ends properly |
| Viewer watches stream | Normal viewing experience unchanged |
| Audio space host minimizes | Audio continues in background |
| PK Battle display | Split screen with HP bar and timer |

## Summary

This implementation provides:
1. **Background Broadcasting** - Hosts can browse the app while streaming
2. **Modern UI** - Exact match to your TikTok/Tango reference code
3. **Proper Navigation** - Back button minimizes, doesn't end
4. **Stream Persistence** - Only explicit "End Stream" stops broadcasting
5. **PiP Player** - Draggable floating video preview for hosts
6. **Unified Experience** - Works for video streams, audio spaces, and PK battles
