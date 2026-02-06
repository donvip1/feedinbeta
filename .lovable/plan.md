
# Hand Raise System Enhancement Plan

## Current System Analysis

The hand raise feature partially exists but has gaps that make it feel incomplete:

**What Already Works:**
- Listeners can raise their hand via the action stack button
- Database (`live_space_speakers` table) stores `has_raised_hand` and `hand_raised_at`
- `SpeakerQueuePanel` component displays queue and allows host to promote/decline
- Header shows hand icon with count badge for hosts (in audio spaces)
- Realtime subscription updates the raised hands count for hosts

**What's Missing/Broken:**
1. **No Toast Notification for Hosts** - When someone raises their hand, the host doesn't receive an immediate toast notification
2. **Audio Space Only** - Hand raise in header only shows for `audio_space` type, not `video_broadcast`
3. **Missing realtime listener for new hand raises** - Only count is updated, no notification when a specific user raises hand

---

## Implementation Plan

### Phase 1: Add Toast Notifications for Hand Raises

**File: `src/components/live/UnifiedLiveRoom.tsx`**

Modify the existing realtime subscription (lines 161-174) to:
1. Subscribe to individual record changes, not just count
2. When a new hand is raised (event: UPDATE, `has_raised_hand` changes to `true`):
   - Fetch the user's profile
   - Show a toast notification: "[User Name] raised their hand!"
   - Include a quick action button to open speaker queue

**Changes:**
```tsx
// Replace count-only fetch with detailed subscription
const channel = supabase
  .channel(`raised-hands-${roomInfo.id}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'live_space_speakers',
    filter: `space_id=eq.${roomInfo.id}`,
  }, async (payload) => {
    // Check if hand was just raised (old = false, new = true)
    if (payload.new.has_raised_hand && !payload.old?.has_raised_hand) {
      // Fetch profile and show notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', payload.new.user_id)
        .single();
      
      toast(
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">...</Avatar>
          <span><strong>{profile?.display_name}</strong> raised their hand!</span>
        </div>,
        {
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
  })
  .subscribe();
```

### Phase 2: Enable Hand Raise for Video Broadcasts

**File: `src/components/live/UnifiedLiveRoom.tsx`**

1. **Remove `audio_space` restriction** from the header hand icon (line 648):
   ```tsx
   // Before: {isHost && roomInfo.type === 'audio_space' && (
   // After:
   {isHost && (
   ```

2. **Update the realtime subscription** (line 145) to work for all room types:
   ```tsx
   // Before: if (!isHost || roomInfo.type !== 'audio_space' || ...) return;
   // After:
   if (!isHost || connectionStatus !== 'connected') return;
   ```

3. **Listener hand raise button** (lines 987-1001) - Already shown for all listeners, works correctly

**File: `src/context/UnifiedLiveContext.tsx`**

4. **Update `toggleRaiseHand`** function (line 797) to support video broadcasts:
   ```tsx
   // Before: if (!currentUser || !roomInfo || roomInfo.type !== 'audio_space') return;
   // After:
   if (!currentUser || !roomInfo) return;
   ```

   Also update the database table used:
   ```tsx
   // For video broadcasts, use live_stream_viewers table
   // For audio spaces, use live_space_speakers table
   const tableName = roomInfo.type === 'audio_space' 
     ? 'live_space_speakers' 
     : 'live_stream_viewers';
   ```

### Phase 3: Add Hand Raise Table Support for Video Streams (if needed)

**Database Check:** Verify if `live_stream_viewers` table has `has_raised_hand` column

If not, add migration:
```sql
ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS has_raised_hand boolean DEFAULT false;

ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS hand_raised_at timestamptz;
```

### Phase 4: Apply Same Fixes to LiveSpaceRoom (Legacy Component)

**File: `src/components/live/LiveSpaceRoom.tsx`**

1. **Add toast notification** when hand is raised (similar to UnifiedLiveRoom)
2. The component already has hand icon with badge in header (lines 1344-1356)
3. Already subscribes to speaker updates via realtime (line 263)

Add specific handler for hand raise events:
```tsx
// In the UPDATE handler for live_space_speakers
if (payload.new.has_raised_hand && !payload.old?.has_raised_hand && isHost) {
  // Show toast notification for new hand raise
}
```

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/live/UnifiedLiveRoom.tsx` | Add toast notifications, remove audio_space restriction |
| `src/context/UnifiedLiveContext.tsx` | Support video broadcasts in toggleRaiseHand |
| `src/components/live/LiveSpaceRoom.tsx` | Add toast notifications for hand raises |
| Database (if needed) | Add hand raise columns to live_stream_viewers |

### Realtime Channel Structure

The system will use dedicated channels for hand raise events:
- Channel: `raised-hands-{roomId}`
- Events: postgres_changes on live_space_speakers/live_stream_viewers
- Filter: `space_id=eq.{roomId}` or `stream_id=eq.{roomId}`

### Notification Toast Design

```
┌─────────────────────────────────────────┐
│ 🖐️ [Avatar] John Doe raised their hand! │
│                              [View Queue]│
└─────────────────────────────────────────┘
```

- Duration: 5 seconds
- Dismissible
- Action button opens Speaker Queue panel
- Only shown to hosts/co-hosts

---

## Expected Behavior After Implementation

1. **Listener raises hand** → Database updated → Realtime event fired
2. **Host receives toast notification** with user name and avatar
3. **Host can tap "View Queue"** or tap hand icon in header
4. **Speaker Queue Panel** shows all raised hands in order
5. **Host promotes/declines** → Hand is lowered, user notified of result
6. Works in both **Audio Spaces** and **Video Broadcasts**
