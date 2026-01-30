

# Plan: Remove Carousel Dot Indicators from Photo+ Posts

## Summary

Remove the carousel dot indicators (vertical short lines/dots) that appear in the top-right corner and below images in the Photo+ section of normal mode posts. Users will navigate between multiple images using only the swipe arrow buttons.

## Current Indicators to Remove

There are **3 sets of dot indicators** in the codebase:

### 1. Normal Mode - Image Counter Badge (Top Right)
**File**: `src/components/feed/ImmersivePostCard.tsx`  
**Lines 1010-1013**: Shows "1/3" style counter
```tsx
{/* Image counter indicator at top-right */}
<div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded-full text-white text-[10px] font-medium">
  {currentMediaIndex + 1}/{mediaUrls.length}
</div>
```

### 2. Normal Mode - Dot Indicators Below Image
**File**: `src/components/feed/ImmersivePostCard.tsx`  
**Lines 1039-1056**: Horizontal dots below image carousel
```tsx
{/* Dot indicators below image */}
<div className="flex justify-center gap-2 mt-3">
  {mediaUrls.map((_, idx) => (
    <button ... />
  ))}
</div>
```

### 3. Immersive/Video Mode - Multiple Media Indicator (Top Right)
**File**: `src/components/feed/ImmersivePostCard.tsx`  
**Lines 1267-1280**: Dot indicators at top-right in immersive mode
```tsx
{/* Multiple Media Indicator */}
{hasMultipleMedia && (
  <div className="absolute top-4 right-16 flex gap-1.5 z-10">
    {mediaUrls.map((_, idx) => (
      <div ... />
    ))}
  </div>
)}
```

### 4. Fullscreen Mode - Dot Indicators (PhotoPostSlide)
**File**: `src/components/feed/PhotoPostSlide.tsx`  
**Lines 358-378**: Dot indicators in fullscreen photo view
```tsx
{/* Dot Indicators - above caption overlay */}
{images.length > 1 && (
  <div className="absolute bottom-[100px] left-0 right-0 flex justify-center gap-2 z-20">
    ...
  </div>
)}
```

## What Will Remain

The **navigation arrow buttons** will remain intact (lines 1017-1036 in ImmersivePostCard.tsx):
- Left arrow: Previous image
- Right arrow: Next image

Users can still swipe/tap the arrows to navigate between images.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/feed/ImmersivePostCard.tsx` | Remove 3 indicator sections (lines 1010-1013, 1039-1056, 1267-1280) |
| `src/components/feed/PhotoPostSlide.tsx` | Remove dot indicators section (lines 358-378) |

## Visual Before/After

**Before:**
```
┌──────────────────────────────────────┐
│  [Image]                      1/4 ●  │  ← Counter badge & dots at top-right
│  ◄                            ►      │  ← Arrow buttons
│  ● ○ ○ ○                             │  ← Dot indicators below
└──────────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────────┐
│  [Image]                             │  ← Clean - no indicators
│  ◄                            ►      │  ← Arrow buttons remain
│                                      │  ← No dots below
└──────────────────────────────────────┘
```

