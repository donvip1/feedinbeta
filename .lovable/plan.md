
# Plan: Add Refeed/Gift Status Indicators & Fix Gift Count Display

## Overview

Add visual feedback for Refeed and Gift buttons (similar to how Likes shows a filled heart) and ensure gift counts display properly across all post types.

## Current Behavior vs. Desired Behavior

| Action | Current | Desired |
|--------|---------|---------|
| Like | Heart fills red when liked, tap to unlike | ✓ Working correctly |
| Refeed | No indication, cannot undo | Show green filled icon when refeeded, tap to un-refeed |
| Gift | No indication after gifting | Show colored icon when user has gifted this post |
| Gift Count | Shows in video/text posts, missing in Photo+ footer | Show count in all layouts |

## Database Queries for Status Checks

The user interaction status will be checked on component mount:

```sql
-- Check if user has refeeded this post
SELECT id FROM post_shares 
WHERE post_id = :postId 
  AND user_id = :userId 
  AND share_type IN ('refeed', 'quote');

-- Check if user has gifted this post  
SELECT id FROM gift_analytics 
WHERE source_id = :postId 
  AND sender_id = :userId 
  AND source_type = 'post';
```

## Changes Required

### 1. ImmersivePostCard.tsx

**Add new state variables:**
```typescript
const [hasRefeeded, setHasRefeeded] = useState(false);
const [hasGifted, setHasGifted] = useState(false);
```

**Extend the status check useEffect:**
- Check `post_shares` for refeed/quote by current user
- Check `gift_analytics` for any gift sent by current user to this post

**Update Refeed button styling:**
- When `hasRefeeded=true`: Show filled/colored Repeat icon (green)
- Clicking when already refeeded: Show un-refeed option or perform un-refeed

**Update Gift button styling:**
- When `hasGifted=true`: Show filled/colored Gift icon (pink/purple gradient)
- Maintains existing behavior (modal opens), just visual indicator

**Fix Photo+ footer gift count:**
- Currently shows `<Gift className="..." />` without count
- Add `<span>{formatCount(giftsCount)}</span>` like other buttons

### 2. PostCard.tsx

**Add same state variables and checks as ImmersivePostCard:**
- `hasRefeeded` and `hasGifted` states
- Status check in useEffect
- Updated button styling

### 3. RefeedModal.tsx

**Add un-refeed functionality:**
When user has already refeeded:
- Delete from `post_shares` table
- Delete the refeed post from `posts` table (where `original_post_id = postId` and `user_id = currentUser`)
- Decrement `refeeds_count` (handled by existing trigger)

### 4. FullscreenMediaViewer.tsx

Add same status tracking for consistency in fullscreen view.

## Visual Design

### Refeed Button States

**Default (not refeeded):**
```jsx
<Repeat className="w-5 h-5 text-muted-foreground" />
```

**Active (has refeeded):**
```jsx
<Repeat className="w-5 h-5 text-green-500 fill-green-500" />
// Note: Repeat icon may need custom styling since Lucide icons don't have fill variant
// Alternative: Use background highlight or color change
```

### Gift Button States

**Default (not gifted):**
```jsx
<Gift className="w-5 h-5 text-muted-foreground" />
```

**Active (has gifted):**
```jsx
<Gift className="w-5 h-5 text-pink-500" />
// Or with gradient background indicator
```

## Un-Refeed Logic

```typescript
const handleUnrefeed = async () => {
  // 1. Delete share record
  await supabase
    .from('post_shares')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .in('share_type', ['refeed', 'quote']);

  // 2. Delete the refeed post itself
  await supabase
    .from('posts')
    .delete()
    .eq('original_post_id', postId)
    .eq('user_id', user.id)
    .in('post_type', ['refeed', 'quote']);

  // 3. Update local state
  setHasRefeeded(false);
  setRefeedsCount(prev => Math.max(0, prev - 1));
};
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/ImmersivePostCard.tsx` | Add hasRefeeded/hasGifted states, status checks, button styling, fix Photo+ gift count |
| `src/components/feed/PostCard.tsx` | Add hasRefeeded/hasGifted states, status checks, button styling |
| `src/components/feed/RefeedModal.tsx` | Add un-refeed option when already refeeded |
| `src/components/feed/FullscreenMediaViewer.tsx` | Add hasRefeeded/hasGifted states for consistency |

## Technical Details

### Status Check Implementation

```typescript
// In ImmersivePostCard.tsx useEffect
useEffect(() => {
  const checkStatus = async () => {
    if (!user) return;

    try {
      const [likeCheck, saveCheck, followCheck, refeedCheck, giftCheck] = await Promise.all([
        supabase.from('post_likes').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('saved_posts').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle(),
        supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', post.user_id).maybeSingle(),
        supabase.from('post_shares').select('id').eq('post_id', post.id).eq('user_id', user.id).in('share_type', ['refeed', 'quote']).maybeSingle(),
        supabase.from('gift_analytics').select('id').eq('source_id', post.id).eq('sender_id', user.id).eq('source_type', 'post').maybeSingle()
      ]);

      setLiked(!!likeCheck.data);
      setSaved(!!saveCheck.data);
      setIsFollowing(!!followCheck.data);
      setHasRefeeded(!!refeedCheck.data);
      setHasGifted(!!giftCheck.data);
    } catch (error) {
      // Handle silently
    }
  };

  checkStatus();
}, [user, post.id, post.user_id]);
```

### Button Styling Updates

**Refeed Button (Video sidebar):**
```jsx
<button onClick={handleRefeedClick} className="flex flex-col items-center gap-0.5 group">
  <div className={cn(
    "p-1.5 rounded-full transition-all active:scale-90",
    hasRefeeded ? "bg-green-500/90" : "bg-black/40 backdrop-blur-sm"
  )}>
    <Repeat className={cn("w-5 h-5 transition-transform", hasRefeeded ? "text-white" : "text-white")} />
  </div>
  <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(refeedsCount)}</span>
</button>
```

**Gift Button (Video sidebar):**
```jsx
<button onClick={() => { setGiftOpen(true); }} className="flex flex-col items-center gap-0.5 group">
  <div className={cn(
    "p-1.5 rounded-full transition-all active:scale-90",
    hasGifted ? "bg-pink-500/90" : "bg-black/40 backdrop-blur-sm"
  )}>
    <Gift className={cn("w-5 h-5 transition-transform", hasGifted ? "text-white" : "text-white")} />
  </div>
  <span className="text-white text-[10px] font-semibold drop-shadow-lg">{formatCount(giftsCount)}</span>
</button>
```

**Photo+ Footer Gift Button (currently missing count):**
```jsx
{/* Gift - ADD COUNT */}
<button onClick={() => { setGiftOpen(true); }} className="flex items-center gap-1.5 group">
  <Gift className={cn("w-5 h-5 transition-transform group-active:scale-90", hasGifted ? "text-pink-500" : "text-muted-foreground")} />
  <span className="text-muted-foreground text-xs font-medium">{formatCount(giftsCount)}</span>
</button>
```

## Summary

1. **Add status tracking** for refeed and gift actions in all post card components
2. **Update button styling** to show filled/colored icons when user has interacted
3. **Add un-refeed functionality** in RefeedModal when user already refeeded
4. **Fix Photo+ footer** to show gift count alongside the icon
5. **Parallel status checks** added to existing useEffect for efficiency
