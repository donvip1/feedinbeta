
# Plan: Fix Audio Spaces by Migrating to LiveKit

## Problem Analysis

The audio spaces feature is broken - users can't hear each other. After investigating:

1. **Current Architecture**: Audio spaces use a custom Cloudflare SFU implementation (`space-room-manager.ts` + `unified-sfu-client.ts`)
2. **Root Cause**: Cloudflare SFU requires strict signaling order. The 406 error shows:
   ```
   "invalid_session_description": "renegotiation is expected before pulling or pushing tracks. API requests were possibly made out-of-order"
   ```
3. **Working Alternative**: LiveKit is already configured and working perfectly for:
   - Video streaming (LiveKitViewer, LiveKitBroadcaster)
   - Group calls (useGroupCall hook)
   - Has API keys configured (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL)

**Solution**: Replace Cloudflare SFU with LiveKit for audio spaces, matching the proven pattern used by video streaming.

---

## Architecture Change

```text
BEFORE (Cloudflare SFU - broken)              AFTER (LiveKit - proven)
┌─────────────────────────────┐              ┌─────────────────────────┐
│ LiveSpaceRoom.tsx           │              │ LiveSpaceRoom.tsx       │
│         ↓                   │              │         ↓               │
│ SpaceContext.tsx            │              │ SpaceContext.tsx        │
│         ↓                   │              │         ↓               │
│ space-room-manager.ts       │              │ NEW: LiveKit Room       │
│         ↓                   │              │         ↓               │
│ unified-sfu-client.ts       │              │ livekit-token edge fn   │
│         ↓                   │              │ (already working)       │
│ cloudflare-sfu edge fn      │              └─────────────────────────┘
│ (406 signaling errors)      │              
└─────────────────────────────┘              
```

---

## Phase 1: Create LiveKit-Based Space Audio Hook

Create a new hook `useSpaceLiveKit.ts` that mirrors LiveKitViewer's pattern:

```typescript
// src/hooks/useSpaceLiveKit.ts
import { Room, RoomEvent, Track, LocalAudioTrack } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

export const useSpaceLiveKit = ({ spaceId, isMuted, isHost }) => {
  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  
  const connect = useCallback(async () => {
    // Get token from existing livekit-token edge function
    const { data } = await supabase.functions.invoke('livekit-token', {
      body: {
        roomName: `space-${spaceId}`,
        participantName: displayName,
        participantIdentity: user.id,
        isHost,
      },
    });
    
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        audioPreset: AudioPresets.speech,
      },
    });
    
    // Handle remote tracks - auto-play audio
    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === Track.Kind.Audio) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        track.attach(audioEl);
        document.body.appendChild(audioEl);
      }
    });
    
    await room.connect(data.url, data.token);
    
    // Publish local audio if host/speaker
    if (isHost || isSpeaker) {
      const localTrack = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(localTrack);
    }
  }, [spaceId, user, isHost]);
  
  return { connect, disconnect, toggleMute, audioLevels, isConnected };
};
```

---

## Phase 2: Update SpaceContext.tsx

Replace Cloudflare SFU integration with LiveKit:

**Remove**:
- `import { SpaceRoomManager } from '@/lib/space-room-manager'`
- All `getSpaceRoomManager()` calls
- `sfuClient` related code

**Add**:
- LiveKit Room management (same pattern as LiveStreamContext.tsx)
- Use `livekit-token` edge function (already exists)

**Key changes**:
```typescript
// SpaceContext.tsx
import { Room, RoomEvent, createLocalAudioTrack, AudioPresets } from 'livekit-client';

const roomRef = useRef<Room | null>(null);

const connectAudio = useCallback(async (overrideRole?: string) => {
  // Get LiveKit token (reuse existing edge function)
  const { data } = await supabase.functions.invoke('livekit-token', {
    body: {
      roomName: `space-${spaceInfoRef.current.id}`,
      participantName: displayName,
      participantIdentity: currentUser.id,
      isHost: effectiveRole === 'host',
    },
  });
  
  const room = new Room({
    adaptiveStream: true,
    publishDefaults: { audioPreset: AudioPresets.speech },
  });
  
  // Handle incoming audio tracks (everyone receives)
  room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
    if (track.kind === Track.Kind.Audio) {
      playRemoteAudio(track, participant.identity);
    }
  });
  
  await room.connect(data.url, data.token);
  roomRef.current = room;
  
  // Publish if host/speaker
  if (canBroadcast) {
    const localTrack = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
    });
    await room.localParticipant.publishTrack(localTrack);
  }
  
  setSpaceState(prev => ({ ...prev, connectionStatus: 'connected' }));
}, []);
```

---

## Phase 3: Update LiveSpaceRoom.tsx Integration

Simplify to use LiveKit through SpaceContext:

1. Remove references to `cloudflare_session_id` and `cloudflare_track_id`
2. Audio connection now works through standard LiveKit room events
3. Speaking indicators come from LiveKit's built-in audio level detection

---

## Phase 4: Add Audio Level Monitoring

LiveKit provides built-in audio levels via `participant.audioLevel`. Update the speaking indicators:

```typescript
// Monitor audio levels
room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
  const levels: Record<string, number> = {};
  room.remoteParticipants.forEach((p, id) => {
    levels[id] = (p.audioLevel || 0) * 100; // 0-100 scale
  });
  // Local participant
  if (room.localParticipant) {
    levels[room.localParticipant.identity] = 
      (room.localParticipant.audioLevel || 0) * 100;
  }
  setAudioLevels(levels);
});

// Or use ActiveSpeakersChanged for simpler implementation
room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
  // speakers array contains active speakers
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/context/SpaceContext.tsx` | Replace Cloudflare SFU with LiveKit Room |
| `src/components/live/LiveSpaceRoom.tsx` | Simplify - remove SFU track management |
| `src/hooks/useSpaceAudio.tsx` | Update to use LiveKit (or deprecate) |

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useSpaceLiveKit.ts` | LiveKit-based audio for spaces |

## Files Potentially Deprecated

| File | Reason |
|------|--------|
| `src/lib/space-room-manager.ts` | Replaced by LiveKit |
| `src/lib/unified-sfu-client.ts` | Replaced by LiveKit |
| `supabase/functions/cloudflare-sfu/` | No longer needed for spaces |

---

## Technical Details

### Why LiveKit Solves This Problem

1. **Automatic Signaling**: LiveKit handles all WebRTC signaling internally - no 406 errors
2. **Proven in This Project**: Already works for video streaming and group calls
3. **Better Track Management**: Automatic subscription to all room participants
4. **Built-in Audio Levels**: `participant.audioLevel` for speaking indicators
5. **Reconnection Handling**: Automatic reconnection with exponential backoff

### Room Naming Convention

```typescript
// Consistent room naming
const roomName = `space-${spaceId}`;  // For audio spaces
const roomName = `stream-${streamId}`; // For video streams (existing)
const roomName = `call-${callId}`;     // For calls (existing)
```

### Audio Settings for Speech

```typescript
const localTrack = await createLocalAudioTrack({
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
});
```

---

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Host creates and joins space | Audio publishes, shows as connected |
| Listener joins space | Hears host audio immediately |
| Second host/speaker joins | All participants hear each other |
| Listener unmutes to speak | Audio publishes, others hear them |
| Network disconnect/reconnect | Auto-reconnects without user action |
| Host ends space | All participants disconnect cleanly |
| Speaking indicator | Shows who is currently talking |
| Mute/unmute toggle | Works for self, host can mute others |

---

## Migration Safety

The Cloudflare SFU code can remain in the codebase initially as a fallback. The migration:
1. Updates SpaceContext to use LiveKit
2. Existing SFU code stays but is no longer called
3. Once verified working, SFU code can be removed in a future cleanup

This approach ensures zero disruption to other features (calls, video streaming) while fixing audio spaces.
