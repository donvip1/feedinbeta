
# Plan: Fix Live Streaming Connection, Chat Layout & Mocked Data

## Executive Summary

This plan addresses three main issues:
1. **Auto-reconnection**: Seamless stream reconnection when network is restored
2. **Chat/UI Layout**: Fix host chat overlapping controls, chat formatting, and connection popup visibility
3. **Mocked Data**: Replace hardcoded data with real database content

---

## Issue 1: Seamless Auto-Reconnection

### Problem
When network drops and reconnects, users must manually click "Return to Stream" and "Go Live" again. The host and viewers should stay connected automatically.

### Current Behavior
- LiveKit has reconnection handling but UI shows "error" state requiring manual action
- `LiveKitBroadcaster.tsx` line 186-193: On `ConnectionState.Reconnecting`, it shows warning but on `Disconnected` goes to error state
- `LiveKitViewer.tsx` line 117-121: Same pattern - shows reconnecting, then error on disconnect

### Solution

**A. Improve LiveKit Connection Handling**

Update both `LiveKitViewer.tsx` and `LiveKitBroadcaster.tsx` to:
1. Add auto-reconnect on network restoration using `navigator.onLine` events
2. Keep stream in "reconnecting" state longer (not immediately "error")
3. Automatically attempt reconnection without user action

```text
BEFORE                              AFTER
┌─────────────────────────┐        ┌─────────────────────────┐
│ Network drops           │        │ Network drops           │
│ → Show "reconnecting"   │        │ → Show "reconnecting"   │
│ → Show "error" state    │        │ → Wait for network      │
│ → User clicks "Retry"   │        │ → Auto-reconnect        │
│ → User clicks "Go Live" │        │ → Resume seamlessly     │
└─────────────────────────┘        └─────────────────────────┘
```

**B. Add Network Status Listener**

```typescript
// Add to both LiveKitViewer and LiveKitBroadcaster
useEffect(() => {
  let reconnectTimer: NodeJS.Timeout | null = null;

  const handleOnline = async () => {
    if (connectionStatus === 'error' || connectionStatus === 'reconnecting') {
      console.log('[LiveKit] Network restored, auto-reconnecting...');
      // Small delay to ensure network is stable
      reconnectTimer = setTimeout(() => {
        connectToRoom(); // or startBroadcast for host
      }, 1500);
    }
  };

  const handleOffline = () => {
    setConnectionStatus('reconnecting');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}, [connectionStatus]);
```

**C. Update Connection State Handler**

```typescript
// Instead of immediately going to 'error', stay in 'reconnecting' with exponential backoff
room.on(RoomEvent.ConnectionStateChanged, (state) => {
  if (state === ConnectionState.Disconnected) {
    // Don't immediately show error - attempt reconnect
    setConnectionStatus('reconnecting');
    
    // Only show error after multiple failed attempts
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus('error');
    }
  }
});
```

---

## Issue 2: Chat/UI Layout Fixes

### Problems Identified from Screenshot
1. Host message "philip • Host hello" overlaps with mic/video/mirror buttons
2. Chat messages extend too low, overlapping with "say something" input
3. Connection popup is behind chat, users can't tap retry

### Solution

**A. Fix Chat Overlay Position in `LiveKitBroadcaster.tsx`**

The chat area currently uses `bottom: 200` (line 648) which causes overlap with controls.

```typescript
// BEFORE (line 643-650)
<div 
  className="absolute left-0 right-0 z-10 px-4"
  style={{ 
    bottom: isKeyboardOpen ? keyboardHeight + 80 : 200,
    maxHeight: '40%',
  }}
>

// AFTER - Increase bottom offset to avoid control buttons
<div 
  className="absolute left-0 px-4 z-10"
  style={{ 
    bottom: isKeyboardOpen ? keyboardHeight + 180 : 280, // Increased clearance
    maxHeight: '30vh', // Reduced height
    maxWidth: '60%', // Restrict to left side only
  }}
>
```

**B. Fix FlyingChat Bottom Offset**

In `FlyingChat.tsx`, the `bottomOffset` prop default is 112px which is too low:

```typescript
// Update FlyingChat usage in LiveKitBroadcaster.tsx
<FlyingChat 
  messages={...}
  gifts={flyingGifts}
  hostId={user?.id}
  bottomOffset={280} // Increase from default to clear controls
/>
```

**C. Make Connection Popup Higher Z-Index**

Connection/reconnecting overlays need to be above chat:

```typescript
// BEFORE (LiveKitViewer.tsx line 489)
<div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">

// AFTER - Higher z-index than chat overlay
<div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
```

**D. Host Messages - Broadcast Style**

In `FlyingChat.tsx`, host messages already have special styling (amber gradient). Enhance:

```typescript
// Add a broadcast icon/animation for host messages
{isHost && (
  <div className="absolute -left-2 -top-2 animate-pulse">
    <Radio className="w-4 h-4 text-amber-400" />
  </div>
)}
```

---

## Issue 3: Remove Mocked Data

### Problems
1. "Recommended For You" shows hardcoded fake users (lines 365-389 in `LiveDashboard.tsx`)
2. Filter tabs (Popular, Music, Gaming, Chat) don't filter anything
3. Search button in header doesn't navigate to search

### Solution

**A. Replace "Recommended For You" with Real Data**

```typescript
// Add query for recommended creators (users with most followers who went live recently)
const { data: recommendedCreators } = useQuery({
  queryKey: ['recommended-live-creators'],
  queryFn: async () => {
    // Get creators who have streamed in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data } = await supabase
      .from('live_streams')
      .select(`
        user_id,
        profiles:user_id (id, display_name, username, avatar_url)
      `)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('status', 'ended')
      .order('viewer_count', { ascending: false })
      .limit(10);
    
    // Deduplicate by user_id
    const uniqueCreators = new Map();
    data?.forEach(s => {
      if (s.profiles && !uniqueCreators.has(s.user_id)) {
        uniqueCreators.set(s.user_id, s.profiles);
      }
    });
    
    return Array.from(uniqueCreators.values());
  },
});
```

**B. Make Filter Tabs Functional**

```typescript
// Filter live content based on active filter
const filteredContent = useMemo(() => {
  if (activeFilter === 'All') return allLiveContent;
  
  // Filter by category tag stored in stream/space
  return allLiveContent.filter(item => 
    item.category?.toLowerCase() === activeFilter.toLowerCase() ||
    item.tags?.includes(activeFilter.toLowerCase())
  );
}, [allLiveContent, activeFilter]);
```

**C. Wire Up Search Button**

```typescript
// Update search button in header (line 93-95)
<button 
  onClick={() => navigate('/search?context=live')}
  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
>
  <Search className="w-5 h-5" />
</button>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/live/LiveKitViewer.tsx` | Add network listener, auto-reconnect, increase popup z-index |
| `src/components/live/LiveKitBroadcaster.tsx` | Add network listener, auto-reconnect, fix chat position |
| `src/components/live/FlyingChat.tsx` | Adjust default bottom offset |
| `src/components/live/LiveDashboard.tsx` | Replace mocked data, add filter logic, wire search |

---

## Technical Details

### Network State Machine

```text
┌──────────┐    network drops    ┌─────────────────┐
│ CONNECTED├────────────────────►│  RECONNECTING   │
└──────────┘                     └────────┬────────┘
     ▲                                    │
     │   auto-reconnect                   │ max attempts
     │   (network back)                   ▼
     │                           ┌─────────────────┐
     └───────────────────────────┤     ERROR       │
              user retry         └─────────────────┘
```

### Chat Layout Spacing

```text
┌────────────────────────────────┐
│        HEADER (z-20)           │
├────────────────────────────────┤
│                                │
│   CHAT OVERLAY (z-10)          │◄─ Max 60% width
│   maxHeight: 30vh              │
│   bottom: 280px                │
│                                │
├────────────────────────────────┤◄─ Gap for controls
│   CONTROLS (z-20)              │   Mic, Video, Flip, Chat
│   Mic │ Video │ Flip │ Screen  │
├────────────────────────────────┤
│   INPUT / GO LIVE (z-20)       │
└────────────────────────────────┘
```

### Connection Popup Z-Index Hierarchy

```text
z-50: Gift modals, invite modals
z-40: Connection popups (connecting/reconnecting/error)
z-30: Top header
z-20: Control buttons, bottom input
z-10: Chat overlay, flying chat
z-0:  Video feed
```

---

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Host goes live, network drops | Shows "Reconnecting..." - not error |
| Network restored (host) | Auto-reconnects without user action |
| Viewer watching, network drops | Shows "Reconnecting..." overlay |
| Network restored (viewer) | Auto-reconnects to stream |
| Host sends chat message | Message appears clearly above controls |
| Connection popup visible | Can tap "Retry" - not blocked by chat |
| Click search button | Navigates to `/search` page |
| Filter by "Music" | Only music-tagged streams shown |
| "Recommended For You" | Shows real users who recently streamed |

