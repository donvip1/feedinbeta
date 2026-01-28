
# Plan: Fix 8 Feed and Profile Issues - COMPLETED ✅

## Overview
All 8 issues have been fixed.

---

## Issue 1: Feeds Not Appearing Without Refresh ✅
Fixed by ensuring feed query always fetches fresh data with `staleTime: 0` and `gcTime: 0`.

**Root Cause**: The `displayPosts` state is only updated when `posts` changes via useEffect, but there may be a timing issue where `posts` is undefined initially.

**Solution**:
- In `Feed.tsx`, ensure posts are displayed directly from the query result when available
- Add a fallback to show loading state properly while data is being fetched
- Ensure the initial `displayPosts` state is populated immediately when posts are available

**File**: `src/pages/Feed.tsx`

---

## Issue 2: Video Volume Should Be Unmuted by Default

**Problem**: Videos are muted by default; users must manually unmute.

**Root Cause**: Line 75 in `Feed.tsx` sets `const [globalMuted, setGlobalMuted] = useState(true)`

**Solution**:
- Change the default state to `useState(false)` so videos play with sound by default
- Users can mute manually if desired

**File**: `src/pages/Feed.tsx`

---

## Issue 3: Photo Posts Not Appearing on Photo+ Page

**Problem**: Newly created photo posts don't appear in the Photo+ tab until viewed through profile.

**Root Cause**: The Photo+ query filters for non-video posts, but there may be a cache issue or the post's `media_type` may not be set correctly.

**Solution**:
- Ensure the Photo+ query includes all non-video post types: `image`, `text_plain`, `text_styled`, and null media types
- Force fresh data fetch when navigating to feed
- Also ensure that when creating posts, the correct media_type is being saved

**File**: `src/pages/Feed.tsx`

---

## Issue 4: Profile Page Photo Posts Show Vertical Social Buttons

**Problem**: When viewing a photo post from a profile, social buttons appear vertically (sidebar style) instead of horizontally (bottom bar style).

**Root Cause**: `PostDetail.tsx` doesn't pass `layoutType` prop to `ImmersivePostCard`, so it defaults to `'video'` layout which shows vertical sidebar.

**Solution**:
- In `PostDetail.tsx`, detect the post's media type
- Pass `layoutType='photo-text'` when the post is an image, text, or styled text post
- This ensures horizontal social buttons for photo/text content

**File**: `src/pages/PostDetail.tsx`

---

## Issue 5: Carousel Swiping Not Working Smoothly for Multiple Images

**Problem**: Swiping between images in Photo+ posts with 2 images doesn't work smoothly.

**Root Cause**: The CSS carousel implementation uses `overflow-x-auto` with snap points, but the scrollbar-hide class and touch handling may not be optimal.

**Solution**:
- Improve the carousel CSS with better touch-action properties
- Add explicit touch scrolling behavior
- Ensure smooth snap scrolling with proper CSS
- Consider adding swipe gesture detection for better mobile experience

**File**: `src/components/feed/ImmersivePostCard.tsx`

---

## Issue 6: Audio Echo When Commenting on Video

**Problem**: When opening comments on a video, the audio starts echoing as if two videos are playing simultaneously.

**Root Cause**: `CommentsModal.tsx` has a mini video preview that plays with `autoPlay`, while the main video in `ImmersivePostCard` continues playing.

**Solution**:
- In `ImmersivePostCard.tsx`, pause the main video when comments are opened
- Pass a callback or use the existing `onCommentsOpenChange` to pause playback
- Ensure the mini video in CommentsModal respects the mute state properly

**Files**: `src/components/feed/ImmersivePostCard.tsx`, `src/components/feed/CommentsModal.tsx`

---

## Issue 7: Show Accept/Decline Request on Sender's Profile

**Problem**: When viewing the profile of someone who sent you a chat/friend request, the Accept/Decline options don't appear.

**Root Cause**: Profile.tsx only checks for pending friend requests where the current user is the owner of the profile, not when viewing someone else's profile who may have sent a request TO the current user.

**Solution**:
- Add a new state `incomingRequestFromUser` to track if the viewed profile's user has sent a request to the current user
- Add a check in `useEffect` to query friend_requests where `sender_id = resolvedUserId` and `receiver_id = user.id`
- Display Accept/Decline buttons when such a request exists

**File**: `src/pages/Profile.tsx`

---

## Issue 8: Message Icon Should Navigate to User's DM

**Problem**: Clicking the Message icon on a user's profile navigates to the Messages dashboard instead of directly to the conversation with that user.

**Root Cause**: Line 1016 in `Profile.tsx` navigates to `/messages` without specifying the conversation ID.

**Solution**:
- Use the existing `startConversation` function which creates/gets a conversation and navigates with the ID
- Replace the navigation call with `startConversation()` which properly handles this

**File**: `src/pages/Profile.tsx`

---

## Implementation Summary

| Issue | File(s) | Change Type |
|-------|---------|-------------|
| 1 | Feed.tsx | Fix state initialization |
| 2 | Feed.tsx | Change default state value |
| 3 | Feed.tsx | Verify filter logic |
| 4 | PostDetail.tsx | Add layoutType prop |
| 5 | ImmersivePostCard.tsx | Improve carousel CSS |
| 6 | ImmersivePostCard.tsx, CommentsModal.tsx | Pause video on comments open |
| 7 | Profile.tsx | Add incoming request check |
| 8 | Profile.tsx | Use startConversation function |

---

## Technical Details

### Issue 1 - Feed Initialization
```typescript
// Ensure displayPosts updates immediately
useEffect(() => {
  if (posts && posts.length > 0) {
    setDisplayPosts(posts);
  }
}, [posts]);
```

### Issue 2 - Unmute Default
```typescript
// Change from true to false
const [globalMuted, setGlobalMuted] = useState(false);
```

### Issue 4 - PostDetail Layout Detection
```typescript
// Detect layout type based on media
const getLayoutType = (post) => {
  if (post.media_type === 'video') return 'video';
  return 'photo-text';
};
```

### Issue 6 - Pause Video on Comments
```typescript
// In ImmersivePostCard, when commentsOpen changes
useEffect(() => {
  if (commentsOpen && videoRef.current) {
    videoRef.current.pause();
  }
}, [commentsOpen]);
```

### Issue 7 - Incoming Request Check
```typescript
// New state and check
const [incomingRequest, setIncomingRequest] = useState(null);

// In useEffect, check for incoming request
const checkIncomingRequest = async () => {
  const { data } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender_id', resolvedUserId)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  setIncomingRequest(data);
};
```

### Issue 8 - Direct DM Navigation
```typescript
// Replace navigate('/messages') with:
onClick={startConversation}
```
