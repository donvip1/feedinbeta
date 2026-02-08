
# Fix Video Livestream UI to Use Twitter-Style Interface

## Problem Analysis

The video livestream feature has **two different UI components** causing an inconsistent experience:

1. **Hosts** see the old `UnifiedLiveRoom` component when starting a stream from the `/live` dashboard - this has:
   - Circular outlined buttons (`border-2 border-white rounded-full`)
   - Duplicate screen share button
   - Missing PK Battle button
   - Old layout not matching Twitter/X Spaces style

2. **Viewers** see the new `TwitterStreamRoom` when joining via `/live/stream/:id` - this has the correct Twitter-style interface

## Solution

Route ALL video streams through the new `TwitterStreamRoom` component, regardless of whether the user is a host or viewer.

## Implementation Plan

### Step 1: Update Live.tsx Routing

Change the `handleStreamClick` and `handleStreamCreated` handlers to navigate to the stream detail page instead of opening `UnifiedLiveRoom` inline.

**Current behavior:**
```tsx
const handleStreamClick = (stream: any) => {
  openRoom(stream, 'video_broadcast', isMyStream ? 'host' : 'viewer');
};
// This opens UnifiedLiveRoom (old UI)
```

**New behavior:**
```tsx
const handleStreamClick = (stream: any) => {
  navigate(`/live/stream/${stream.id}`);
};
// This opens LiveStreamDetail which renders TwitterStreamRoom (new UI)
```

### Step 2: Update Stream Creation Flow

When a host creates a stream, redirect to `/live/stream/:streamId` so they enter through `TwitterStreamRoom`.

### Step 3: Clean Up Action Stack in TwitterStreamRoom

Verify the right-side action stack has:
- Heart/Reactions (no circle outline)
- Gift (green highlight, no outline)
- Share (no circle outline)
- Record (red, host only, no outline)
- Screen Share (host only, no outline)
- PK Battle/Swords (orange, visible to all)

Remove any duplicate buttons from the footer/bottom controls.

### Step 4: Remove Duplicate Screen Share Button

The screenshot shows a screen share button next to the send button in the footer. This needs to be removed - screen share should only appear in the right-side action stack.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Live.tsx` | Update `handleStreamClick` and `handleStreamCreated` to navigate to stream detail page |
| `src/components/live/twitter-space/TwitterStreamRoom.tsx` | Remove any duplicate buttons from footer, ensure action stack icons have no circular outlines |

## Technical Details

### Live.tsx Changes
- Remove inline `UnifiedLiveRoom` rendering for video broadcasts
- Use `navigate('/live/stream/${id}')` pattern (already used for audio spaces)
- Keep `UnifiedLiveRoom` only for PK battles if needed

### TwitterStreamRoom.tsx Cleanup
- Bottom footer should only have: Users button, Mic toggle, Chat input, Send button
- Remove any Screen Share button from footer area
- Right-side action stack: icons only, no `border`, `rounded-full`, or background styles on Heart/Share/Recording/ScreenShare/Battle buttons

## Expected Result

After these changes:
- Both hosts and viewers will see the same Twitter-style UI for video streams
- No duplicate buttons
- PK Battle icon visible on mobile
- Clean icon-only action stack without circular outlines
