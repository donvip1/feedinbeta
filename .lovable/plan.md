# Plan: Fix Live Streaming Connection, Chat Layout & Mocked Data

## ✅ COMPLETED

All issues have been fixed:

### Issue 1: Seamless Auto-Reconnection ✅
- Added network status listeners (`online`/`offline` events) to both `LiveKitViewer.tsx` and `LiveKitBroadcaster.tsx`
- Connection state now stays in "reconnecting" instead of immediately going to "error"
- Auto-reconnect triggers 1.5 seconds after network is restored

### Issue 2: Chat/UI Layout Fixes ✅
- **LiveKitBroadcaster.tsx**: Chat overlay now uses `bottom: 280px` and `maxWidth: 60%` to avoid control buttons
- **LiveKitViewer.tsx**: FlyingChat bottomOffset increased to 160px
- **FlyingChat.tsx**: Default bottomOffset changed from 112px to 200px
- **Connection popups**: Z-index increased from `z-10` to `z-40` so they appear above chat

### Issue 3: Remove Mocked Data ✅
- **LiveDashboard.tsx**: 
  - Search button now navigates to `/search?context=live`
  - Filter tabs now actually filter content by category/tags
  - "Recommended For You" section now fetches real creators who streamed recently
  - Removed hardcoded fake user avatars

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/live/LiveKitViewer.tsx` | Auto-reconnect, z-40 popups, bottomOffset 160 |
| `src/components/live/LiveKitBroadcaster.tsx` | Auto-reconnect, chat position fixed |
| `src/components/live/FlyingChat.tsx` | Default bottomOffset to 200px |
| `src/components/live/LiveDashboard.tsx` | Real data, filters, search navigation |

---

## Technical Summary

### Auto-Reconnect Flow
```
Network drops → Stay in "reconnecting" state → Network restored → 1.5s delay → Auto-reconnect
```

### Z-Index Hierarchy (Fixed)
```
z-50: Gift modals, invite modals
z-40: Connection popups (connecting/reconnecting/error) ← FIXED
z-30: Top header
z-20: Control buttons, bottom input
z-10: Chat overlay, flying chat
z-0:  Video feed
```

### Chat Layout (Fixed)
```
Host Broadcaster:
- Chat maxWidth: 60% (left side only)
- Chat bottom: 280px (above controls)
- FlyingChat bottomOffset: 280px

Viewer:
- FlyingChat bottomOffset: 160px
```
