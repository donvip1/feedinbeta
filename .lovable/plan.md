
# Plan: Add Vertical Swipe Navigation to Photo+ Fullscreen View

## Problem
In the Photo+ section fullscreen view (ImageLightbox), users can only:
- Swipe left/right to navigate between images within the same post
- Swipe down to close

But they cannot swipe up/down to navigate to the next/previous Photo+ post like they can in the video feed.

## Solution
Transform the ImageLightbox into a fullscreen viewer that supports vertical navigation between posts while maintaining horizontal navigation within multi-image posts.

---

## Technical Changes

### File 1: `src/components/feed/ImageLightbox.tsx`

**Add new props to receive all Photo+ posts:**
```typescript
interface ImageLightboxProps {
  // Existing props...
  // NEW: All Photo+ posts for vertical navigation
  allPhotoPosts?: Post[];
  currentPostIndex?: number;
  onPostChange?: (index: number) => void;
}
```

**Implement vertical scroll-snap container:**
- Wrap the content in a scroll container with `snap-y snap-mandatory`
- Each post gets its own full-height snap section
- Render current post ± 1 for performance (like FullscreenMediaViewer)

**Update gesture handling:**
- Horizontal swipe: Navigate between images within current post
- Vertical swipe: Navigate between posts (up = next post, down = previous post OR close if at first post)
- Keep existing tap-to-toggle-UI behavior

**Key implementation details:**
- Use `scrollContainerRef` with `snap-y snap-mandatory overflow-y-scroll`
- Track `currentPostIndex` for which post is being viewed
- When post changes via scroll, update all social counts, captions, images for new post
- Reset `currentImageIndex` to 0 when changing posts

### File 2: `src/components/feed/ImmersivePostCard.tsx`

**Pass additional props to ImageLightbox:**
- Pass `allPosts` filtered to only Photo+ posts (non-video)
- Calculate `currentPostIndex` based on current post's position in filtered list
- Add `onPostChange` handler to sync state

**Filter Photo+ posts:**
```typescript
const allPhotoPosts = allPosts?.filter(p => 
  p.media_type !== 'video' && 
  (!p.original_post || p.original_post.media_type !== 'video')
);
const currentPhotoPostIndex = allPhotoPosts?.findIndex(p => p.id === post.id) ?? 0;
```

---

## Implementation Details

### Vertical Scroll Structure
```
┌─────────────────────────────────┐
│   Post 1 (current - 1)          │  ← Placeholder if not adjacent
│   [Images array]                │
│   snap-start snap-always        │
├─────────────────────────────────┤
│   Post 2 (current)              │  ← Active post
│   [Image carousel]              │
│   [Caption + Social buttons]    │
│   snap-start snap-always        │
├─────────────────────────────────┤
│   Post 3 (current + 1)          │  ← Pre-rendered for smooth transition
│   [Images array]                │
│   snap-start snap-always        │
└─────────────────────────────────┘
```

### Gesture Logic
```
if (vertical swipe down && at first post) → close lightbox
if (vertical swipe down && not at first post) → go to previous post
if (vertical swipe up) → go to next post
if (horizontal swipe && multiple images) → navigate images within post
```

---

## Files Modified
| File | Change |
|------|--------|
| `src/components/feed/ImageLightbox.tsx` | Add scroll-snap vertical navigation, new props for posts array |
| `src/components/feed/ImmersivePostCard.tsx` | Filter Photo+ posts, pass to lightbox with handlers |

---

## Expected Behavior After Fix
- Swipe left/right: Navigate between images in current post (unchanged)
- Swipe up: Go to next Photo+ post
- Swipe down: Go to previous post (or close if at first post)
- Arrow buttons: Still work for image navigation within post
- UI toggle: Tap to show/hide controls (unchanged)
- Social buttons: Update to reflect current post's data
- Feels native like TikTok/Instagram stories vertical scroll
