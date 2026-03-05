

## Issues Identified

### 1. Share Link Bug
`shareUrls.liveSpace()` in `url-utils.ts` generates edge function URLs like `https://spsguldyimamulhigloc.supabase.co/functions/v1/og-space?id=...`. While this was designed for OG previews on social platforms, it creates a poor user experience — the URL looks suspicious and if the edge function has any issue, users can't join.

**Fix**: Change `shareUrls.liveSpace` and `shareUrls.liveStream` to use the direct `feedinn.com` URLs. The SpaceDetail page already sets OG meta tags client-side (lines 96-121), so social previews still get metadata. The edge function approach is unnecessary and harmful.

**File**: `src/lib/url-utils.ts` (line 69-70)
- Change `liveStream` to `createShareableUrl('/live/stream/${streamId}')`
- Change `liveSpace` to `createShareableUrl('/live/space/${spaceId}')`

### 2. Recorded Spaces — Better Discovery Section
Currently recorded spaces exist as a small section in LiveDashboard. The user wants a dedicated navigable tab with richer features.

**Approach**: Add a "Replays" tab to the LiveDashboard header filters (alongside Discover). When selected, show a dedicated feed-like view of all recorded spaces with:
- Cover image, title, host info, duration, listener count
- Share button
- Click to navigate to SpaceDetail replay

**File**: `src/components/live/LiveDashboard.tsx`
- Add "Replays" as a navigation tab in the header (next to "Discover")
- When "Replays" is active, render a dedicated recorded spaces feed instead of the live content
- Remove the existing inline "Recorded Spaces" section (it moves to the tab)

### 3. Recorded Space Comments & Reactions (Phase 2 — Larger Feature)
The user wants recorded spaces to have feed-like features: comments, reactions, tagging, notifications, and promotion with credits. This is a significant feature requiring new database tables and UI components. I recommend implementing this as a follow-up after fixing the immediate share link and discovery issues.

## Plan Summary

**Immediate changes (this implementation):**
1. Fix `shareUrls.liveSpace` and `shareUrls.liveStream` in `url-utils.ts` to use direct URLs
2. Add "Replays" navigation tab to LiveDashboard header, showing a dedicated recorded spaces section with improved cards
3. Expand the recorded spaces query to fetch more results and support pagination

**Files to modify:**
- `src/lib/url-utils.ts` — Fix share URL generation
- `src/components/live/LiveDashboard.tsx` — Add Replays tab, move recorded spaces to dedicated view

**Deferred (follow-up):**
- Comments/reactions system on recorded spaces (requires new DB tables)
- User tagging with notifications
- Credit-based promotion for recorded spaces

