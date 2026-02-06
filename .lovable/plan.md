

# Hand Raise & Mute All System - Complete Fix Plan

## Current Issues Analysis

After a thorough code review, I've identified the root causes:

### Issue 1: Missing Toast Notifications for Host When Someone Raises Hand
**Root Cause:** The realtime subscription in `UnifiedLiveRoom.tsx` (lines 161-168) only calls `fetchRaisedHands()` to update the count. It does NOT:
- Detect when a NEW hand is raised (vs just general changes)
- Fetch the user's profile to show who raised their hand
- Display a toast notification to the host

**In LiveSpaceRoom.tsx:** The `raisedHands` array is correctly derived from the speakers list (line 1108), and the count badge shows correctly (line 1351-1355), but there's no notification mechanism when a new hand is raised.

### Issue 2: Hand Raise Count Not Appearing on Host Icon (UnifiedLiveRoom)
**Root Cause:** The realtime subscription at line 145 has a condition that restricts it to ONLY audio spaces:
```tsx
if (!isHost || roomInfo.type !== 'audio_space' || connectionStatus !== 'connected') return;
```
This means video broadcasts never get hand raise count updates, even though listeners can raise their hands.

### Issue 3: Mute All Not Working Properly in UnifiedLiveContext
**Root Cause:** The `muteAll` and `muteParticipant` functions (lines 859-875, 826-841) in `UnifiedLiveContext.tsx` only update LOCAL state - they do NOT:
- Persist to the database (no `supabase.update()` call)
- Broadcast to other clients via realtime
- Actually mute the audio tracks on the participants' devices

**In contrast, LiveSpaceRoom.tsx has proper implementation** (lines 800-858):
- Updates database with `host_muted: true`
- Broadcasts via Supabase channel: `event: 'mute_all'`
- Participants listen and respond by muting themselves

### Issue 4: toggleRaiseHand Restricted to Audio Spaces Only
**Root Cause:** In `UnifiedLiveContext.tsx` line 797:
```tsx
if (!currentUser || !roomInfo || roomInfo.type !== 'audio_space') return;
```
This prevents listeners in video broadcasts from raising their hands.

---

## Implementation Plan

### Phase 1: Fix Toast Notifications for Hand Raises

**File: `src/components/live/UnifiedLiveRoom.tsx`**

Replace the basic realtime subscription with one that detects NEW hand raises and shows notifications:

```typescript
// New approach: Track previous state to detect new hand raises
const prevRaisedHandsRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!isHost || connectionStatus !== 'connected') return;

  const fetchRaisedHands = async () => {
    const { data, count } = await supabase
      .from('live_space_speakers')
      .select('user_id, has_raised_hand')
      .eq('space_id', roomInfo.id)
      .eq('has_raised_hand', true)
      .is('left_at', null);
    
    setRaisedHandsCount(count || 0);
    return data || [];
  };

  const handleNewHandRaise = async (payload: any) => {
    // Check if hand was just raised (new.has_raised_hand = true, old was false)
    if (payload.new.has_raised_hand && !payload.old?.has_raised_hand) {
      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', payload.new.user_id)
        .single();
      
      // Show toast notification
      toast(
        `${profile?.display_name || 'Someone'} raised their hand!`,
        {
          icon: '✋',
          duration: 5000,
          action: {
            label: 'View Queue',
            onClick: () => setShowRaisedHands(true)
          }
        }
      );
    }
    // Always update count
    fetchRaisedHands();
  };

  fetchRaisedHands();

  const channel = supabase
    .channel(`raised-hands-${roomInfo.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'live_space_speakers',
      filter: `space_id=eq.${roomInfo.id}`,
    }, handleNewHandRaise)
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [isHost, roomInfo.id, connectionStatus]);
```

**File: `src/components/live/LiveSpaceRoom.tsx`**

Add similar notification logic to the existing realtime subscription (around line 260-273):

```typescript
// In the UPDATE handler for live_space_speakers
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'live_space_speakers',
  filter: `space_id=eq.${spaceId}`,
}, async (payload: any) => {
  // Existing logic...
  
  // NEW: Notify host of new hand raises
  if (isHost && payload.new.has_raised_hand && !payload.old?.has_raised_hand) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', payload.new.user_id)
      .single();
    
    toast(`${profile?.display_name || 'Someone'} raised their hand!`, {
      icon: '✋',
      duration: 5000,
      action: {
        label: 'View Queue',
        onClick: () => setShowSpeakerQueue(true)
      }
    });
  }
  
  fetchSpeakers();
})
```

### Phase 2: Enable Hand Raise for All Room Types

**File: `src/components/live/UnifiedLiveRoom.tsx`**

1. Remove `audio_space` restriction from subscription (line 145):
```typescript
// Before: if (!isHost || roomInfo.type !== 'audio_space' || ...) return;
// After:
if (!isHost || connectionStatus !== 'connected') return;
```

2. Remove `audio_space` restriction from header icon (line 648):
```typescript
// Before: {isHost && roomInfo.type === 'audio_space' && (
// After:
{isHost && (
```

**File: `src/context/UnifiedLiveContext.tsx`**

3. Update `toggleRaiseHand` (line 797):
```typescript
// Before: if (!currentUser || !roomInfo || roomInfo.type !== 'audio_space') return;
// After:
if (!currentUser || !roomInfo) return;
```

### Phase 3: Fix Mute All to Persist and Broadcast

**File: `src/context/UnifiedLiveContext.tsx`**

Replace the local-only `muteAll` function with proper database + broadcast logic:

```typescript
const muteAll = useCallback(async () => {
  if (roleRef.current !== 'host' && roleRef.current !== 'co_host') {
    toast.error('Only hosts can mute all participants');
    return;
  }

  const roomInfo = roomInfoRef.current;
  const currentUser = userRef.current;
  if (!roomInfo || !currentUser) return;

  // Update local state immediately for responsiveness
  setState(prev => ({
    ...prev,
    participants: prev.participants.map(p => 
      p.role !== 'host' && p.role !== 'co_host' 
        ? { ...p, is_muted: true, is_hard_muted: true } 
        : p
    ),
  }));

  try {
    // Persist to database
    const tableName = roomInfo.type === 'audio_space' 
      ? 'live_space_speakers' 
      : 'live_stream_viewers';
    const filterField = roomInfo.type === 'audio_space' ? 'space_id' : 'stream_id';

    await supabase
      .from(tableName)
      .update({ is_muted: true, host_muted: true })
      .eq(filterField, roomInfo.id)
      .neq('user_id', currentUser.id);

    // Broadcast to all participants for immediate effect
    const controlChannel = supabase.channel(`space-control-${roomInfo.id}`);
    await controlChannel.send({
      type: 'broadcast',
      event: 'mute_all',
      payload: { by: currentUser.id },
    });
    supabase.removeChannel(controlChannel);

    toast.success('All participants muted');
  } catch (error) {
    console.error('[UnifiedLive] Failed to mute all:', error);
    toast.error('Failed to mute all');
  }
}, []);
```

Similarly update `unmuteAll`, `muteParticipant`, and `unmuteParticipant` to include database updates and broadcasts.

### Phase 4: Add Broadcast Listener for Mute Events

**File: `src/components/live/UnifiedLiveRoom.tsx`**

Add a subscription to handle mute broadcasts for non-host participants:

```typescript
// Subscribe to host control broadcasts (mute all, etc.)
useEffect(() => {
  if (isHost || connectionStatus !== 'connected') return;

  const controlChannel = supabase
    .channel(`space-control-${roomInfo.id}`)
    .on('broadcast', { event: 'mute_all' }, (payload) => {
      if (payload.payload?.by !== user?.id) {
        // Mute local audio
        if (audioTrack) {
          audioTrack.mute();
        }
        setState(prev => ({ ...prev, isMuted: true, isHardMuted: true }));
        toast.info('You have been muted by the host');
      }
    })
    .on('broadcast', { event: 'allow_unmute' }, (payload) => {
      if (payload.payload?.by !== user?.id) {
        setState(prev => ({ ...prev, isHardMuted: false }));
        toast.info('You can now unmute');
      }
    })
    .subscribe();

  return () => supabase.removeChannel(controlChannel);
}, [isHost, roomInfo.id, connectionStatus, user?.id]);
```

### Phase 5: Add host_muted Column to live_stream_viewers (if missing)

**Database Migration:**
```sql
ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS host_muted boolean DEFAULT false;

ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS has_raised_hand boolean DEFAULT false;

ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS hand_raised_at timestamptz;
```

---

## Technical Summary

| File | Changes |
|------|---------|
| `src/components/live/UnifiedLiveRoom.tsx` | Add hand raise notifications, remove audio_space restrictions, add mute broadcast listener |
| `src/context/UnifiedLiveContext.tsx` | Fix muteAll/unmuteAll to persist to DB and broadcast, enable toggleRaiseHand for all room types |
| `src/components/live/LiveSpaceRoom.tsx` | Add hand raise notification toasts in realtime handler |
| Database | Add missing columns to live_stream_viewers for video broadcast hand raise support |

---

## Expected Behavior After Implementation

### Hand Raise Flow:
1. Listener taps "Raise Hand" button
2. Database updated (`has_raised_hand: true`, `hand_raised_at: timestamp`)
3. Realtime event fires to host
4. Host sees toast: "[User Name] raised their hand!" with "View Queue" action
5. Host's hand icon badge updates with count
6. Host opens Speaker Queue Panel to promote/decline
7. Promoted user receives broadcast notification and becomes speaker

### Mute All Flow:
1. Host taps "Mute All"
2. Database updated (`host_muted: true` for all non-hosts)
3. Broadcast event sent to all participants
4. Participants receive event, mute their local audio, see toast
5. Participants cannot unmute until host clicks "Allow Unmute"
6. Host promotes individual users via Speaker Queue to allow them to speak

