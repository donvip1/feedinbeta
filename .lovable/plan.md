
# Plan: Fix Navigation After Clicking Promote and Back Arrow

## Problem Summary

When users click the "Promote" button on a video or Photo+ post and then use the back arrow to return, they are redirected to a different post or wrong feed section instead of returning to the original content.

**Current Flow (Broken):**
```
Feed (viewing post) → Promote page → Back arrow → PostDetail (different view) → Lost context
```

**Expected Flow (Fixed):**
```
Feed (viewing post) → Promote page → Back arrow → Feed (same post at same position)
```

## Root Cause

The Promote page (`src/pages/Promote.tsx`) back arrow handler currently does:
```javascript
navigate(`/feed/post/${postId}`, { replace: true });
```

This always redirects to PostDetail regardless of where the user came from, which:
1. Replaces history making browser back unpredictable
2. PostDetail loads ALL posts from that user, not just the one they were viewing
3. Loses the feed scroll position and tab context (Video vs Photo+)

## Solution

Implement **referrer-aware back navigation** in the Promote page:

### Strategy 1: Use `navigate(-1)` with Intelligent Fallback

Instead of always going to PostDetail, check if there's valid history to go back to:

```javascript
const handleBack = () => {
  // If we have history, go back to the exact previous page (Feed, PostDetail, etc.)
  if (window.history.length > 2) {
    navigate(-1);
  } else {
    // No history - fallback to post detail
    navigate(`/feed/post/${postId}`, { replace: true });
  }
};
```

### Strategy 2: Store Referrer in Navigation State

Pass the source URL when navigating to Promote:

```javascript
// In ImmersivePostCard, PostCard, PhotoPostSlide:
navigate(`/promote/${post.id}`, { 
  state: { returnTo: location.pathname + location.search } 
});

// In Promote.tsx back handler:
const location = useLocation();
const returnTo = location.state?.returnTo || `/feed/post/${postId}`;
navigate(returnTo);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Promote.tsx` | Update back arrow handler to use `navigate(-1)` with fallback |
| `src/components/feed/ImmersivePostCard.tsx` | Pass state with returnTo path when navigating to Promote |
| `src/components/feed/PostCard.tsx` | Pass state with returnTo path when navigating to Promote |
| `src/components/feed/PhotoPostSlide.tsx` | Pass state with returnTo path when navigating to Promote |

## Implementation Details

### 1. Update Promote.tsx Back Handler (lines 326-329)

**Before:**
```tsx
<Button
  onClick={() => {
    navigate(`/feed/post/${postId}`, { replace: true });
  }}
  ...
>
```

**After:**
```tsx
const location = useLocation();

// In the onClick handler:
<Button
  onClick={() => {
    // Check for passed return path or use navigate(-1)
    const returnTo = location.state?.returnTo;
    if (returnTo) {
      navigate(returnTo);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(`/feed/post/${postId}`, { replace: true });
    }
  }}
  ...
>
```

### 2. Update Promote Button in ImmersivePostCard.tsx

There are 4 Promote buttons in this file. Each needs to pass state:

**Before:**
```tsx
navigate(`/promote/${post.id}`);
```

**After:**
```tsx
navigate(`/promote/${post.id}`, { state: { returnTo: window.location.pathname } });
```

### 3. Update Promote Button in PostCard.tsx

**Before:**
```tsx
navigate(`/promote/${post.id}`);
```

**After:**
```tsx
navigate(`/promote/${post.id}`, { state: { returnTo: window.location.pathname } });
```

### 4. Update Promote Button in PhotoPostSlide.tsx

**Before:**
```tsx
navigate(`/promote/${post.id}`);
```

**After:**
```tsx
navigate(`/promote/${post.id}`, { state: { returnTo: window.location.pathname } });
```

## Visual Flow After Fix

```
┌─────────────────────────────────────────────────────────────────┐
│                    NAVIGATION FLOW (FIXED)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Feed Page (/feed)                                             │
│   ┌──────────────────────────────────────────────┐              │
│   │  Video Tab    │    Photo+ Tab               │              │
│   │  ┌─────────┐  │    ┌─────────┐              │              │
│   │  │ Video 1 │  │    │ Photo 1 │              │              │
│   │  │[Promote]│──┼────│[Promote]│──────┐       │              │
│   │  └─────────┘  │    └─────────┘      │       │              │
│   └───────────────┴─────────────────────┼───────┘              │
│                                         │                       │
│                                         ▼                       │
│                            ┌────────────────────┐               │
│                            │   Promote Page     │               │
│                            │   /promote/:id     │               │
│                            │                    │               │
│                            │   state: {         │               │
│                            │     returnTo: '/feed'              │
│                            │   }                │               │
│                            │                    │               │
│                            │   [← Back Arrow]   │               │
│                            └────────┬───────────┘               │
│                                     │                           │
│                                     ▼                           │
│                            Returns to /feed                     │
│                            (same scroll position,               │
│                             same tab, same post)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Edge Cases Handled

1. **Direct link to Promote page** (no history): Falls back to PostDetail
2. **From PostDetail page**: Returns to PostDetail correctly
3. **From Feed Video tab**: Returns to Feed at same position
4. **From Feed Photo+ tab**: Returns to Feed at same position
5. **From Fullscreen Photo viewer**: Returns to Feed/viewer correctly

## Summary

This fix ensures users are returned to their exact previous location after visiting the Promote page, maintaining scroll position, tab selection, and post context. The solution is backward compatible with existing direct navigation patterns.
