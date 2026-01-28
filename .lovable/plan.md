
# Plan: Fix Photo+ Carousel - Show 2 Images at Once with Counter

## Issues to Fix

1. **Carousel shows 1 image instead of 2**: Each image takes full width, user wants to see 2 images side by side
2. **No image counter**: Only dots exist, need text like "1/4", "2/3" etc.
3. **Swiping not working properly**: The scroll snap behavior needs adjustment for multi-image view
4. **Fullscreen not opening on click**: The click handler may not be firing correctly

---

## Solution

### File: `src/components/feed/PhotoCarousel.tsx`

**Key Changes:**

1. **Show 2 images at once (50% width each)**:
   - Change each image from `w-full` to `w-1/2` so 2 images display side by side
   - Keep horizontal scroll-snap for sliding through images
   - Users can swipe to reveal more images

2. **Add image counter (1/4 format)**:
   - Add a text counter below/above the carousel showing "1/4", "2/4" etc.
   - Counter updates as user scrolls

3. **Fix scroll calculation**:
   - Adjust scroll detection to account for 2 images visible at once
   - Auto-slide now advances by 1 image (not full width)

4. **Ensure click-to-fullscreen works**:
   - Add proper touch handling
   - Ensure onClick fires correctly on mobile

---

## Visual Layout After Fix

### Normal View - 2 Images Visible:
```
+----------------------------------+
| [Avatar] DisplayName             |
| Caption text here...             |
+----------------------------------+
|  ┌──────────┬──────────┐        |
|  │ [Img 1]  │ [Img 2]  │ → more | ← 2 visible, swipe for more
|  │          │          │        |
|  └──────────┴──────────┘        |
|         1 / 4                    | ← Text counter
|         ● ○ ○ ○                  | ← Dots (optional)
+----------------------------------+
| ♥ 💬 🔁 👁 🎁 ⤴  [Promote]      |
+----------------------------------+
```

### After swiping left:
```
|  ┌──────────┬──────────┐        |
|  │ [Img 2]  │ [Img 3]  │ → more |
|  │          │          │        |
|  └──────────┴──────────┘        |
|         2 / 4                    | ← Counter updates
```

---

## Technical Implementation

### Update `PhotoCarousel.tsx`:

**Line ~158-178 (Image rendering):**
```typescript
// Change from w-full to w-1/2 for each image
<div className="flex">
  {images.map((url, idx) => (
    <div
      key={idx}
      className="w-1/2 flex-shrink-0 snap-start cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onImageClick?.(idx);
      }}
    >
      <img
        src={url}
        alt={`Image ${idx + 1}`}
        className="w-full aspect-square object-cover px-0.5"
        draggable={false}
      />
    </div>
  ))}
</div>
```

**Add image counter (Line ~180):**
```typescript
{/* Image Counter - Text format like "1/4" */}
<div className="text-center text-xs text-muted-foreground mt-1">
  {currentIndex + 1} / {images.length}
</div>
```

**Fix scroll calculation (Line ~75-86):**
```typescript
// Adjust scroll detection for 50% width items
const handleScroll = useCallback(() => {
  if (!scrollContainerRef.current) return;
  
  const container = scrollContainerRef.current;
  const scrollLeft = container.scrollLeft;
  const itemWidth = container.clientWidth / 2; // Each image is 50% width
  const newIndex = Math.round(scrollLeft / itemWidth);
  
  if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
    setCurrentIndex(newIndex);
  }
}, [currentIndex, images.length]);
```

**Fix auto-slide to scroll by 1 image (Line ~66-72):**
```typescript
// Scroll by one image width (50% of container)
useEffect(() => {
  if (!scrollContainerRef.current) return;
  
  const container = scrollContainerRef.current;
  const itemWidth = container.clientWidth / 2;
  const targetScroll = currentIndex * itemWidth;
  container.scrollTo({ left: targetScroll, behavior: 'smooth' });
}, [currentIndex]);
```

**Handle single image (keep full width):**
```typescript
if (images.length === 1) {
  // Single image still shows full width
  return (
    <div 
      className="w-full rounded-xl overflow-hidden..."
      onClick={() => onImageClick?.(0)}
    >
      <img src={images[0]} ... />
    </div>
  );
}
```

---

## Expected Behavior After Fix

1. **Normal View (Photo+ tab):**
   - 2 images visible side-by-side
   - Swipe left/right to see more images
   - Counter shows "1/4", "2/4" etc.
   - Auto-slides every 4 seconds when idle
   - Tapping any image opens fullscreen lightbox at that index

2. **Fullscreen View:**
   - Shows single image at a time (unchanged)
   - Swipe between images with 1/4 counter
   - Swipe up/down between posts

3. **Single Image Posts:**
   - Still display full width (unchanged)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/PhotoCarousel.tsx` | Change image width to 50%, add text counter, fix scroll calculation |

---

## Summary

- Each image = 50% width (shows 2 at once)
- Add text counter: "1/4", "2/3" etc.
- Fix scroll snap to work with half-width items
- Auto-slide advances by 1 image
- Click any image → opens fullscreen at that index
