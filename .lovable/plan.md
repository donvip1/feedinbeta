
# Plan: Fix Photo+ Post Navigation to Stay on Feed

## Problem Summary

After publishing a Photo+ post, users are redirected to their Timeline instead of staying on the Photos+ tab of the feed. This happens because:

1. `PhotoPlusPostCreator.tsx` navigates to `/feed/post/${newPost.id}` after creating a post
2. The `PostDetail.tsx` page fetches **all posts by that user** (Timeline view)
3. This contradicts user expectations - they want to stay on the Photos+ tab with their new post visible

## Current vs Expected Behavior

| Action | Current | Expected |
|--------|---------|----------|
| Create Photo+ post | Navigates to `/feed/post/id` (Timeline) | Returns to `/feed` (Photos+ tab) |
| Post visibility | Shows all user's posts | Shows feed with new post at top |
| Tab state | Loses tab context | Stays on Photos+ tab |

## Root Cause

In `PhotoPlusPostCreator.tsx` (line 287):
```typescript
navigate(`/feed/post/${newPost.id}`);
```

This navigation goes to PostDetail which shows all user posts (Timeline), not just the single post.

## Solution

Align PhotoPlusPostCreator behavior with the Video post creator (PostDetails.tsx):
1. Navigate to `/feed` instead of post detail
2. Switch the active tab to `photosText` (Photos+ tab)
3. Trigger refetch so the new post appears

## Implementation

### File: `src/components/post/PhotoPlusPostCreator.tsx`

**Change 1**: Use navigate with state to indicate which tab should be active

Replace the navigation logic after successful post creation:

```typescript
// Before (line 287):
navigate(`/feed/post/${newPost.id}`);

// After:
navigate('/feed', { 
  state: { activeTab: 'photosText', scrollToTop: true }
});
```

### File: `src/pages/Feed.tsx`

**Change 2**: Read navigation state and set active tab on mount

Add logic to check for the `activeTab` state from navigation:

```typescript
// Add useLocation to read state
const location = useLocation();

// In useEffect or initialization, check for state
useEffect(() => {
  if (location.state?.activeTab) {
    setActiveTab(location.state.activeTab);
    // Clear the state after using it
    window.history.replaceState({}, document.title);
  }
  if (location.state?.scrollToTop && scrollContainerRef.current) {
    scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
  }
}, [location.state]);
```

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/components/post/PhotoPlusPostCreator.tsx` | Navigate to `/feed` with state instead of `/feed/post/:id` |
| `src/pages/Feed.tsx` | Read navigation state to set active tab and scroll position |

### Navigation State Structure

```typescript
interface FeedNavigationState {
  activeTab?: 'videos' | 'photosText' | 'live';
  scrollToTop?: boolean;
}
```

## Why This Works

1. User stays on the Feed page (no context switch)
2. Photos+ tab is automatically selected
3. The `onSuccess` callback already triggers `refetch()` which fetches fresh posts
4. New post appears at top of feed (ordered by created_at DESC)
5. Consistent with how Video post creation works

## Testing

1. Go to Feed → Photos+ tab
2. Create a new Photo+ post
3. Verify you stay on the Feed page
4. Verify the Photos+ tab is still active
5. Verify your new post appears at the top
6. Repeat test from Videos tab - should switch to Photos+ tab after posting
