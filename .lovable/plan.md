
# Plan: Carousel Image Display for Photo+ Posts

## Overview
This plan transforms how Photo+ posts with 2 images are displayed. Instead of showing both images side-by-side, we will display one image at a time with slider navigation controls. Additionally, the caption in normal mode will be limited to a configurable number of lines with "more/less" toggle functionality.

---

## Current Behavior
- **Photo+ Post Creator**: Supports up to 2 images selected via two separate picker cards
- **Normal Mode Display**: Shows 2 images in a side-by-side grid (`flex gap-2`)
- **Fullscreen Mode**: Uses `PhotoPostSlide.tsx` with horizontal swipe navigation between images and left/right arrow buttons
- **Caption**: Currently truncates by word count (125 words) in normal mode, but does not limit by lines

---

## Proposed Changes

### 1. Image Display in Normal Mode (ImmersivePostCard.tsx)
**Location**: Lines 972-1020

**Current**: Side-by-side grid with `flex gap-2` showing both images at once
**New**: Single image carousel with:
- Dot indicators at the bottom showing current position (1/2)
- Left/right arrow buttons (hidden on mobile, visible on hover for desktop)
- Horizontal swipe gesture support to navigate between images
- Smooth transition animation when switching images

### 2. Caption Line Limiting in Normal Mode
**Location**: Lines 627-633 and 876-892

**Current**: Truncates by word count (125 words for Photo+ posts)
**New**: 
- Limit caption display to 3 lines maximum initially
- Use CSS `line-clamp-3` for the truncated state
- Add "more" button that expands to show full caption
- "less" button to collapse back to 3 lines

### 3. Fullscreen Mode (PhotoPostSlide.tsx)
**Status**: Already supports swipe navigation and arrow buttons
**Enhancement**: Ensure consistency with normal mode indicators

---

## Technical Implementation

### File 1: `src/components/feed/ImmersivePostCard.tsx`

#### A. Replace Side-by-Side Grid with Carousel (Lines 972-1020)
- Replace the `flex gap-2` grid with a single image container
- Add carousel state management using existing `currentMediaIndex` state
- Add navigation arrows and dot indicators
- Implement swipe gesture handling using existing touch handlers

#### B. Update Caption Truncation Logic (Lines 627-633)
- Change from word-count truncation to line-based truncation
- Use CSS `line-clamp-3` class for visual truncation
- Keep the "more/less" toggle functionality

#### C. Update Caption Display (Lines 876-892)
- Apply `line-clamp-3` when `showFullCaption` is false
- Ensure smooth expansion/collapse animation

### File 2: `src/components/feed/PhotoPostSlide.tsx`
- No major changes needed - already has image navigation
- Ensure consistency with normal mode's dot indicators style

### File 3: `src/components/post/PhotoPlusPostCreator.tsx`
- No changes needed to posting method - already supports 2 images
- The `media_urls` array storage works correctly for carousel display

---

## UI/UX Details

### Carousel Controls (Normal Mode)
```
+----------------------------------+
|                                  |
|         [Single Image]           |
|                                  |
|   <                          >   |  <- Arrow buttons (hover/tap)
|                                  |
|            ● ○                   |  <- Dot indicators
+----------------------------------+
```

### Caption with Line Limit
```
This is a longer caption that spans
multiple lines and needs to be
truncated after three lines...
[more]

--- After clicking "more" ---

This is a longer caption that spans
multiple lines and needs to be
truncated after three lines. But now
you can see the entire caption with
all the hashtags and mentions.
[less]
```

---

## Implementation Sequence

1. **Update ImmersivePostCard.tsx - Image Carousel**
   - Replace side-by-side grid (lines 972-1020) with carousel component
   - Add dot indicators below the image
   - Add navigation arrows with proper touch handling

2. **Update ImmersivePostCard.tsx - Caption Line Limit**
   - Modify truncation logic to use line-clamp
   - Update the caption rendering section

3. **Test End-to-End**
   - Verify carousel works in normal mode
   - Verify swipe navigation in fullscreen mode
   - Verify caption expand/collapse
   - Test on mobile and desktop

---

## Technical Details

### Carousel State Management
```typescript
// Already exists in ImmersivePostCard
const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

// Navigation functions (already exist)
const handleSwipe = () => { /* swipe logic */ };
const handleTouchStart = (e: React.TouchEvent) => { /* ... */ };
const handleTouchEnd = (e: React.TouchEvent) => { /* ... */ };
```

### CSS Line Clamp
```css
/* Already available via Tailwind */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

### Dot Indicators Component
```tsx
{hasMultipleMedia && (
  <div className="flex justify-center gap-2 mt-3">
    {mediaUrls.map((_, idx) => (
      <button
        key={idx}
        onClick={() => setCurrentMediaIndex(idx)}
        className={cn(
          "w-2 h-2 rounded-full transition-all",
          idx === currentMediaIndex 
            ? "bg-primary w-4" 
            : "bg-muted-foreground/40"
        )}
      />
    ))}
  </div>
)}
```

---

## Files to Modify
1. `src/components/feed/ImmersivePostCard.tsx` - Main changes for carousel and caption
2. `src/components/feed/PhotoPostSlide.tsx` - Minor updates for consistency (if needed)

## No Changes Required
- `src/components/post/PhotoPlusPostCreator.tsx` - Posting method already works correctly
- `src/components/feed/ImageLightbox.tsx` - Already supports multi-image navigation
- Database schema - No changes needed
