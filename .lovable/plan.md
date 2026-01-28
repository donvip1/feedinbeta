
# Plan: Photo+ Feed Layout and Scrolling Improvements

## Current Issues

1. **Two-image posts have blank space**: When a post has 2 images, there's too much vertical space between the images and the social buttons
2. **Card-by-card scrolling in Photo+ normal view**: Currently uses `snap-y snap-mandatory` which forces card-by-card scrolling - user wants free-flowing Facebook-style scroll
3. **Social buttons not close to content**: For multi-image posts, buttons are too far from images

## Solution Overview

### 1. Change Photo+ Normal View to Free-Flowing Scroll (Facebook-style)
- Remove `snap-y snap-mandatory` scrolling for Photo+ tab only
- Keep card-by-card snap scrolling for Videos tab (unchanged)
- Allow users to scroll freely, seeing partial posts if needed
- Multiple posts can be visible on screen at once

### 2. Make Social Buttons Tight to Content
- Remove fixed heights and padding that cause blank space
- Social buttons should render directly below the last image with minimal gap (8-12px)
- Each post takes only as much height as its content requires

### 3. Keep Fullscreen (Lightbox) Behavior Unchanged
- Fullscreen still uses card-by-card vertical navigation (already implemented)

---

## Technical Implementation

### File 1: `src/pages/Feed.tsx`

**Container scrolling changes:**
- For Videos tab: Keep `snap-y snap-mandatory` for TikTok-style
- For Photo+ tab: Use regular overflow-y-scroll without snap (Facebook-style)

```
Line ~782-788: Update container classes to conditionally apply snap
```

**Post wrapper changes:**
- For Videos: Keep `snap-start snap-always` wrapper
- For Photo+: Remove snap classes, let posts flow naturally

```
Line ~874: Conditionally apply snap classes based on activeTab
```

### File 2: `src/components/feed/ImmersivePostCard.tsx`

**Photo+ layout container changes:**
- Remove fixed height constraints for Photo+ posts
- Use `min-h-fit` instead of full viewport height
- Content-driven height: Author + Caption + Images + Buttons + minimal padding

```
Line ~635-650: Main container height logic
```

**Image grid spacing:**
- Reduce gap between images and social buttons to 8px
- Remove extra padding around image container

```
Line ~835-860: Multi-image grid styling
Line ~1427: Footer padding adjustment
```

---

## Visual Layout After Fix

### Single-Image Photo+ Post:
```
┌─────────────────────────────┐
│ [Avatar] DisplayName        │ ← Author header
│ Caption text here...        │
├─────────────────────────────┤
│                             │
│      [Single Image]         │ ← Natural aspect ratio
│                             │
├─────────────────────────────┤
│ ♥ 💬 🔁 👁 🎁 ⤴ [Promote]   │ ← 8px gap from image
└─────────────────────────────┘
       ↑ 16px gap to next post
```

### Two-Image Photo+ Post:
```
┌─────────────────────────────┐
│ [Avatar] DisplayName        │
│ Caption text here...        │
├──────────────┬──────────────┤
│   [Image 1]  │   [Image 2]  │ ← Side-by-side grid
├──────────────┴──────────────┤
│ ♥ 💬 🔁 👁 🎁 ⤴ [Promote]   │ ← 8px gap from images
└─────────────────────────────┘
       ↑ 16px gap to next post
```

### Scroll Behavior Comparison:

**Videos Tab (unchanged):**
- Full-page snap scrolling
- One video visible at a time
- TikTok-style UX

**Photo+ Tab (after fix):**
- Free-flowing scroll like Facebook/Instagram
- Multiple posts visible at once
- No snapping - user can stop at any position
- Posts take only as much height as needed

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Feed.tsx` | Remove snap scrolling for Photo+ tab, conditionally apply snap classes |
| `src/components/feed/ImmersivePostCard.tsx` | Remove fixed heights for Photo+ posts, tighten spacing between content and buttons |

---

## Expected Behavior After Fix

1. **Photo+ Normal View:**
   - Smooth free-flowing scroll (not card-by-card)
   - Social buttons are directly under images with 8px gap
   - No blank space between content and buttons
   - Multiple posts can be visible simultaneously

2. **Photo+ Fullscreen (Lightbox):**
   - Keep existing card-by-card vertical swipe navigation
   - Unchanged from current implementation

3. **Videos Tab:**
   - Keep existing full-screen snap scrolling
   - Unchanged from current implementation
