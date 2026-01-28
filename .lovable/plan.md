
# Plan: Photo+ Section - 4 Images with Auto-Slide Carousel

## Overview

Increase the maximum allowed images from 2 to 4 in the Photo+ section, with a horizontal carousel in normal view that auto-slides every 4 seconds when idle, and fullscreen vertical swipe navigation with horizontal image swiping (1/4, 2/4, etc.).

---

## Changes Summary

| Component | Change |
|-----------|--------|
| `PhotoPlusPostCreator.tsx` | Increase MAX_IMAGES from 2 to 4, update grid layout for previews |
| `ImmersivePostCard.tsx` | Replace grid with horizontal carousel, add auto-slide with activity detection |
| `PhotoPostSlide.tsx` | Support up to 4 images with horizontal swipe in fullscreen |
| `ImageLightbox.tsx` | Update image counter to show 1/4 format |

---

## Technical Implementation

### File 1: `src/components/post/PhotoPlusPostCreator.tsx`

**Changes:**
- Line 18: Change `MAX_IMAGES = 2` to `MAX_IMAGES = 4`
- Line 57-58: Update toast message to reflect "4 images"
- Lines 261-264: Update preview grid to handle 3-4 images:
  - 1 image: single column
  - 2 images: 2 columns
  - 3-4 images: 2x2 grid

```
Preview Grid Layout:
1 image:  [  Full  ]
2 images: [ 1 ][ 2 ]
3 images: [ 1 ][ 2 ]
          [ 3 ]
4 images: [ 1 ][ 2 ]
          [ 3 ][ 4 ]
```

---

### File 2: `src/components/feed/ImmersivePostCard.tsx`

**Replace side-by-side grid with horizontal carousel:**

Lines ~838-883: Create a new `PhotoCarousel` component with:

1. **Horizontal scrollable carousel** using CSS scroll-snap
2. **Auto-slide every 4 seconds** when no activity detected
3. **Activity detection** that pauses auto-slide on:
   - Touch/mouse interaction on the carousel
   - Scroll events on the page
   - Any user interaction
4. **Resume auto-slide** after 4 seconds of inactivity
5. **Manual swipe** support for left/right navigation
6. **Dot indicators** showing current position (1/4)
7. **Tap to fullscreen** - opens ImageLightbox at tapped image

```
Carousel Behavior:
+----------------------------------+
|  [Image 1]  →  [Image 2]  →  ... |  (horizontal scroll)
+----------------------------------+
         ● ○ ○ ○                    (dot indicators)

Auto-slide: Every 4 seconds, advance to next image
           When reaching last image, loop back to first
Activity:   Any touch/scroll pauses auto-slide
            Resume after 4 seconds of no activity
```

**State variables to add:**
- `autoSlideInterval` - ref for interval timer
- `activityTimeout` - ref for activity detection timeout
- `isUserInteracting` - boolean to track user activity

**Key Logic:**
```text
1. On mount: Start 4-second auto-slide timer
2. On any activity (touch, scroll, click):
   - Clear auto-slide interval
   - Set isUserInteracting = true
   - Start 4-second inactivity timeout
3. After 4 seconds of no activity:
   - Set isUserInteracting = false
   - Resume auto-slide timer
4. Auto-slide advances to next image (loops at end)
5. On unmount: Clear all timers
```

---

### File 3: `src/components/feed/PhotoPostSlide.tsx`

**Support up to 4 images in fullscreen:**

- Already handles multiple images via `images` array from `post.media_urls`
- Image dots (lines 229-253) already map all images dynamically
- Horizontal swipe (lines 124-136) already works for any count
- Image counter already shows `currentImageIndex + 1 / images.length`

**Minor updates:**
- Ensure smooth transitions for 4-image navigation
- Update arrow navigation to loop properly

---

### File 4: `src/components/feed/ImageLightbox.tsx`

**Already supports multiple images:**
- Lines 249-254: Counter shows `{currentImageIdx + 1} / {images.length}`
- Single post mode (lines 207-276) passes all images to PhotoPostSlide
- No changes needed - already handles arrays of any size

---

## Visual Layout After Changes

### Normal View - Photo+ Carousel (4 images):
```
+----------------------------------+
| [Avatar] DisplayName             |
| Caption text here...             |
+----------------------------------+
|  ┌──────────────────────────┐   |
|  │       [Image 1]          │   | ← Visible
|  │                          │   |
|  └──────────────────────────┘   |
|         ● ○ ○ ○                  | ← Dots (1/4)
+----------------------------------+
| ♥ 💬 🔁 👁 🎁 ⤴  [Promote]      | ← Social buttons
+----------------------------------+

After 4 seconds of no activity:
→ Auto-slides to Image 2
→ Dots update: ○ ● ○ ○
```

### Fullscreen View (ImageLightbox):
```
+----------------------------------+
| [X]              1 / 4           | ← Close + counter
+----------------------------------+
|                                  |
|         [Current Image]          | ← Swipe left/right
|                                  |
|              ● ○ ○ ○             | ← Image dots
+----------------------------------+
| Caption text                     |
| ♥ 💬 🔁 👁 🎁 ⤴  [Promote]      |
+----------------------------------+
```

### Post Creator Preview (4 images):
```
+----------------------------------+
| [Avatar]                         |
| Caption input...                 |
+----------------------------------+
|  [ 1/4 ]  [ 2/4 ]               |
|  [ 3/4 ]  [ 4/4 ]               | ← 2x2 grid
+----------------------------------+
| # Add hashtags                   |
| [📷]                             | ← Disabled when 4 reached
+----------------------------------+
```

---

## Auto-Slide Behavior Details

| Event | Action |
|-------|--------|
| Component mounts | Start 4-second auto-slide interval |
| Touch on carousel | Pause auto-slide, start 4s inactivity timer |
| Manual swipe | Pause auto-slide, start 4s inactivity timer |
| Page scroll | Pause auto-slide, start 4s inactivity timer |
| Any click/tap | Pause auto-slide, start 4s inactivity timer |
| 4 seconds no activity | Resume auto-slide |
| Reach last image | Loop to first image |
| Component unmounts | Clear all timers |

---

## Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/components/post/PhotoPlusPostCreator.tsx` | 18, 57-58, 261-286 | MAX_IMAGES=4, updated grid layout |
| `src/components/feed/ImmersivePostCard.tsx` | 838-883 | Replace grid with auto-slide carousel |
| `src/components/feed/PhotoPostSlide.tsx` | - | Already supports multiple images (minimal changes) |
| `src/components/feed/ImageLightbox.tsx` | - | Already dynamic (no changes needed) |

---

## Expected Behavior

1. **Post Creation:**
   - Users can upload up to 4 images
   - Preview shows 2x2 grid for 3-4 images
   - "Maximum 4 images reached" message when limit hit

2. **Normal Feed View (Photo+ tab):**
   - Images display as horizontal carousel
   - Auto-slides every 4 seconds when idle
   - Manual swipe left/right works
   - Any activity pauses auto-slide for 4 seconds
   - Tap opens fullscreen at current image

3. **Fullscreen View:**
   - Swipe left/right between images (1/4, 2/4, etc.)
   - Counter shows current position
   - All social interactions work
   - Swipe up/down navigates between posts
