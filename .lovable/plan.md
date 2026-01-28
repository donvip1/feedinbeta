
# Plan: Fix Photo+ Carousel - Stop TouchEnd from Triggering Tab Navigation

## Root Cause Found

The `SwipeableTabs` component triggers tab navigation in **`onTouchEnd`** (line 37-60), NOT in `onTouchStart` or `onTouchMove`. 

Currently, the PhotoCarousel stops propagation on:
- `onTouchStart` (line 205) 
- `onTouchMove` (line 206) 

But it does **NOT** stop propagation on `onTouchEnd`, which is exactly where SwipeableTabs makes the decision to switch tabs!

```
SwipeableTabs.tsx (line 37-60):
const handleTouchEnd = useCallback((e: React.TouchEvent) => {
  // This calculates the swipe and triggers tab change
  if (velocity > VELOCITY_THRESHOLD || Math.abs(deltaX) > SWIPE_THRESHOLD) {
    onTabChange(activeIndex + 1);  // <-- This still fires!
  }
}, ...);
```

---

## Solution

Add `onTouchEnd` handler to the PhotoCarousel that stops propagation when the user is swiping horizontally on the carousel.

### File: `src/components/feed/PhotoCarousel.tsx`

**Add new handleTouchEnd handler:**
```typescript
// Stop propagation on touch end to prevent SwipeableTabs from navigating
const handleTouchEnd = useCallback((e: React.TouchEvent) => {
  if (touchStartRef.current) {
    const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
    
    // If it was a horizontal swipe on the carousel, stop it from bubbling
    if (deltaX > deltaY && deltaX > 10) {
      e.stopPropagation();
    }
  }
}, []);
```

**Add onTouchEnd to scroll container (line 206):**
```typescript
<div
  ref={scrollContainerRef}
  onScroll={handleScroll}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}  // NEW: Stop horizontal swipes from triggering tab change
  onMouseDown={handleActivity}
  ...
>
```

---

## Event Flow After Fix

| Event | PhotoCarousel | SwipeableTabs |
|-------|--------------|---------------|
| `touchstart` | Captures, stops propagation | Never receives |
| `touchmove` | Captures horizontal, stops propagation | Never receives |
| `touchend` | **Captures horizontal, stops propagation** | **Never receives → No tab switch!** |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/PhotoCarousel.tsx` | Add `handleTouchEnd` function, attach to scroll container |

---

## Expected Behavior After Fix

1. **Swiping on carousel images:** Scrolls through images, tabs stay on Photo+
2. **Swiping on caption/buttons/empty areas:** Still switches between Videos/Photo+/Live tabs
3. **Tapping images:** Opens fullscreen lightbox (unchanged)
4. **Auto-slide:** Continues working when idle (unchanged)
