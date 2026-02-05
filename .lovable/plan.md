
# Live Streaming & Audio Space Fixes

## Issues Identified

1. **Audio option redundant in Create Live Stream modal** - Users can already create audio-only sessions via "Live Spaces"
2. **Host not visible in audio streams** - The UnifiedLiveRoom audio stage only shows host avatar but doesn't render remote participants' video/tracks properly
3. **Host can't hear participants in Live Spaces** - Audio playback from remote participants may not be initializing correctly
4. **Missing Hand-Raise feature in Live Spaces** - The feature exists in `LiveSpaceRoom.tsx` but wasn't ported to `UnifiedLiveRoom.tsx`

---

## Changes Overview

### 1. Remove "Audio" Option from Create Live Stream Modal
**File:** `src/components/live/CreateLiveStreamModal.tsx`

Remove the `audio_space` button from the Stream Type selector (lines 251-263). Users who want audio-only should use the dedicated "Create Space" feature instead.

- Remove the audio_space button block
- Update grid from `grid-cols-3` to `grid-cols-2` for Video and PK Battle only

### 2. Fix Host Visibility for Viewers in Audio Spaces
**File:** `src/components/live/UnifiedLiveRoom.tsx`

The audio stage currently shows the host's avatar and a speaker grid for participants. The issue is that viewers need to see the host in the speaker grid as well.

**Fix:** Ensure the host appears in the speaker grid along with other participants:
- Add the host to the participants display if not already present
- Show all speakers/co-hosts with their mute status and audio visualizers

### 3. Fix Audio Playback - Host Hearing Participants
**File:** `src/context/UnifiedLiveContext.tsx`

The issue is that the `playRemoteAudio()` function is called when tracks are subscribed, but there may be timing issues or the audio element isn't properly attaching.

**Fixes:**
- Add debug logging to track audio element creation
- Ensure audio elements are appended to DOM and set to autoplay
- Add a manual audio element fallback if the LiveKit attach method fails
- Subscribe to ALL remote audio tracks, not just on connection

### 4. Add Hand-Raise Feature to Unified Live Spaces
**Files:** 
- `src/context/UnifiedLiveContext.tsx` - Add hand-raise state and toggle function
- `src/components/live/UnifiedLiveRoom.tsx` - Add hand-raise UI for listeners

**Implementation:**
- Add `hasRaisedHand` state to UnifiedLiveState
- Add `toggleRaiseHand()` function that updates `live_space_speakers.has_raised_hand`
- Add a Hand button to the FooterControlBar for listeners
- Show raised hands indicator on listener avatars
- Add raised hands section for host to see who wants to speak (with promote button)

---

## Technical Details

### Create Modal Changes (Lines 237-278)
```tsx
// Change from grid-cols-3 to grid-cols-2
<div className="grid grid-cols-2 gap-2">
  {/* Video Button - keep */}
  {/* Audio Button - REMOVE */}
  {/* PK Battle Button - keep */}
</div>
```

### Audio Playback Debug (UnifiedLiveContext)
```typescript
const playRemoteAudio = useCallback((track: RemoteTrack, participantId: string) => {
  console.log('[UnifiedLive] Playing audio for:', participantId);
  
  // Clean up existing
  const existingEl = audioElementsRef.current.get(participantId);
  if (existingEl) {
    existingEl.remove();
    audioElementsRef.current.delete(participantId);
  }

  const audioEl = document.createElement('audio');
  audioEl.id = `unified-audio-${participantId}`;
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.volume = 1.0;
  
  // Attach LiveKit track
  track.attach(audioEl);
  document.body.appendChild(audioEl);
  audioElementsRef.current.set(participantId, audioEl);

  // Force play
  audioEl.play().catch((err) => {
    console.warn('[UnifiedLive] Audio autoplay blocked, enabling...');
    audioPlaybackManager.enableAudioPlayback();
  });
}, []);
```

### Hand-Raise State Addition
```typescript
// Add to UnifiedLiveState interface
hasRaisedHand: boolean;

// Add to defaultState
hasRaisedHand: false,

// Add toggleRaiseHand function
const toggleRaiseHand = useCallback(async () => {
  const currentUser = userRef.current;
  const roomInfo = roomInfoRef.current;
  if (!currentUser || !roomInfo || roomInfo.type !== 'audio_space') return;
  if (state.role !== 'listener') return;

  const newState = !state.hasRaisedHand;
  setState(prev => ({ ...prev, hasRaisedHand: newState }));

  await supabase
    .from('live_space_speakers')
    .update({ 
      has_raised_hand: newState,
      hand_raised_at: newState ? new Date().toISOString() : null
    })
    .eq('space_id', roomInfo.id)
    .eq('user_id', currentUser.id);

  toast.success(newState ? '✋ Hand raised!' : 'Hand lowered');
}, [state.role, state.hasRaisedHand]);
```

### Hand-Raise UI in FooterControlBar
```tsx
{/* Raise Hand - for listeners only */}
{role === 'listener' && roomType === 'audio_space' && (
  <motion.button
    whileTap={{ scale: 0.9 }}
    onClick={onRaiseHand}
    className={cn(
      "p-2.5 rounded-full transition-all shrink-0",
      hasRaisedHand 
        ? "bg-amber-500 text-white" 
        : "bg-white/10 text-white/60"
    )}
  >
    <Hand className="w-4 h-4" />
  </motion.button>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/live/CreateLiveStreamModal.tsx` | Remove Audio button, update grid to 2 columns |
| `src/context/UnifiedLiveContext.tsx` | Add hasRaisedHand state, toggleRaiseHand function, improve audio playback |
| `src/components/live/UnifiedLiveRoom.tsx` | Add hand-raise UI button and raised hands section |

## Expected Results
- Create Live Stream modal shows only Video and PK Battle options
- Audio spaces use the dedicated Create Space modal
- Hosts can hear all participants in audio spaces
- Listeners can raise their hand to request speaking permission
- Raised hands visible to host with promote-to-speaker action
