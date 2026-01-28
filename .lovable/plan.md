
# Plan: Fix Photo+ Carousel Swipe Conflict with Tab Navigation

## Problem

When users swipe left/right on images in the Photo+ carousel, the touch events bubble up to the parent `SwipeableTabs` component, which interprets them as tab navigation gestures and switches between Videos/Photo+/Live tabs instead of scrolling the carousel images.

---

## Root Cause

The `SwipeableTabs` component (lines 62-70) wraps the entire feed content and captures all touch events:

```typescript
<div
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  className="w-full h-full"
>
  {children}
</div>
```

The PhotoCarousel has its own horizontal scroll, but touch events bubble up through the DOM and trigger the parent's tab-switching logic.

---

## Solution

Prevent touch events from bubbling out of the PhotoCarousel when the user is interacting with it. This requires stopping event propagation on the carousel's touch handlers.

### File: `src/components/feed/PhotoCarousel.tsx`

**Key Changes:**

1. **Stop propagation on touch start** - Prevent the swipe from reaching SwipeableTabs
2. **Add touch move handler** - Stop propagation during the swipe motion
3. **Keep existing scroll behavior** - The native horizontal scroll will work once parent doesn't intercept

---

## Technical Implementation

### Update PhotoCarousel touch handlers:

**Line 125 - Update handleTouchStart:**
```typescript
const handleTouchStart = useCallback((e: React.TouchEvent) => {
  // CRITICAL: Stop propagation to prevent SwipeableTabs from capturing the swipe
  e.stopPropagation();
  
  handleActivity();
  touchStartRef.current = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY,
    time: Date.now()
  };
}, [handleActivity]);
```

**Add new handleTouchMove handler:**
```typescript
const handleTouchMove = useCallback((e: React.TouchEvent) => {
  // Stop propagation during horizontal swipe to prevent tab switching
  if (touchStartRef.current) {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    
    // If horizontal movement is dominant, this is a carousel swipe
    if (deltaX > deltaY && deltaX > 10) {
      e.stopPropagation();
    }
  }
}, []);
```

**Line 189 - Add onTouchMove to scroll container:**
```typescript
<div
  ref={scrollContainerRef}
  onScroll={handleScroll}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}  // NEW: Stop horizontal swipes from bubbling
  onMouseDown={handleActivity}
  className="w-full overflow-x-scroll snap-x snap-mandatory..."
>
```

---

## Event Flow After Fix

```
Before Fix:
+------------------+
| SwipeableTabs    | ← Captures swipe, switches to Videos tab
|  +------------+  |
|  | Carousel   |  | ← User swipes here
|  +------------+  |
+------------------+

After Fix:
+------------------+
| SwipeableTabs    | ← Never receives the swipe (stopped)
|  +------------+  |
|  | Carousel   |  | ← User swipes, carousel scrolls images
|  +------------+  |
+------------------+
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/PhotoCarousel.tsx` | Add `e.stopPropagation()` to handleTouchStart, add handleTouchMove handler |

---

## Expected Behavior After Fix

1. **Photo+ Carousel:**
   - Swiping left/right on images scrolls through the carousel
   - Tab navigation does NOT trigger when swiping on images
   - Auto-slide continues to work when idle

2. **Tab Navigation (outside carousel):**
   - Swiping on caption, social buttons, or empty areas still switches tabs
   - Videos ↔ Photo+ ↔ Live navigation works normally

3. **Single Image Posts:**
   - No horizontal swipe needed, so no change in behavior
   - Tab navigation still works when swiping on single-image posts

---

## Summary

- Add `e.stopPropagation()` to carousel touch handlers
- Add `onTouchMove` handler to catch swipe gestures
- Only block propagation for horizontal swipes (carousel), allow vertical (scrolling)
