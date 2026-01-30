

# Plan: Fullscreen Image with Scrollable Text Overlay

## Understanding the Request

The current implementation makes the fullscreen mode look like the normal card mode (constrained image with `max-h-[60vh]`). Instead, you want:

1. **Image fills the screen** - The image should expand to cover the full viewport, not be constrained
2. **Text is still viewable** - User info and caption should be accessible, but overlaid or scrollable
3. **Scroll to view text** - Users can scroll to reveal the caption, but the image stays fullscreen
4. **True fullscreen experience** - Should feel immersive like TikTok/Instagram stories, not like a card

---

## Proposed Solution

Create a **fullscreen image with a scrollable text section that appears over the image**. The structure:

```
+---------------------------+
|                           |
|                           |
|    [FULLSCREEN IMAGE]     |  <- Image covers entire viewport
|    (object-cover/contain) |
|                           |
|                           |
+---------------------------+
| User Info                 |  <- Scrollable overlay section
| Caption (3 lines + More)  |     that can be scrolled up
| [Expand reveals full text]|     to reveal more content
+---------------------------+
| [Social Buttons Bar]      |  <- Fixed at bottom
+---------------------------+
```

When user scrolls up on the bottom section, the full caption is revealed while the image stays in place behind it.

---

## Technical Implementation

### File: `src/components/feed/PhotoPostSlide.tsx`

#### A. Make Image Fullscreen (Cover the viewport)
- Change from `max-h-[60vh] object-contain` to `h-full object-cover` or `object-contain` filling the container
- Image container takes full available height (minus social bar)
- Remove the constrained sizing

#### B. Overlay Text Section on Image
- Position user info and caption as an overlay at the bottom of the image
- Use semi-transparent gradient background for readability
- Keep the 3-line truncation with More/Less toggle
- When expanded, the overlay section becomes scrollable

#### C. Structure Change
```tsx
<div className="w-full h-full flex flex-col bg-black">
  {/* Full-screen Image Container */}
  <div className="flex-1 relative overflow-hidden">
    {/* Image - fills container */}
    <img className="absolute inset-0 w-full h-full object-contain" />
    
    {/* Overlay section at bottom */}
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
      {/* User Info */}
      <div className="px-4 pt-8 pb-2">...</div>
      
      {/* Caption - scrollable when expanded */}
      <div className="px-4 pb-3 max-h-[40vh] overflow-y-auto">
        <p className={cn(!showFullCaption && "line-clamp-3")}>
          {caption}
        </p>
        {/* More/Less button */}
      </div>
    </div>
    
    {/* Image Navigation Arrows */}
    {images.length > 1 && (
      <>
        <button className="absolute left-2 top-1/2">...</button>
        <button className="absolute right-2 top-1/2">...</button>
      </>
    )}
    
    {/* Dot Indicators - positioned above overlay */}
    {images.length > 1 && (
      <div className="absolute bottom-[calc(overlay-height)] left-0 right-0">...</div>
    )}
  </div>
  
  {/* Fixed Social Buttons Bar */}
  <div className="flex-shrink-0 px-4 py-3 bg-black">...</div>
</div>
```

---

## Key Changes

### 1. Image Sizing (Line 341)
**Current:**
```tsx
className="w-full max-h-[60vh] object-contain"
```

**New:**
```tsx
className="absolute inset-0 w-full h-full object-contain"
// Image fills entire container, centered with object-contain
```

### 2. Container Structure (Lines 228-396)
**Current:** Scrollable vertical flow with image in document flow
**New:** Image as absolute background with overlay text section

### 3. Overlay Text Section
- Semi-transparent gradient background (`from-black/80`)
- User info compact at top of overlay
- Caption with line-clamp-3 and More/Less button
- When "More" is clicked, the overlay section becomes scrollable with `max-h-[40vh] overflow-y-auto`
- Text uses white color for visibility on image

### 4. Navigation Elements
- Arrows remain absolutely positioned on the image
- Dot indicators positioned above the text overlay

---

## Visual Comparison

**Current (Constrained):**
```
+---------------------------+
|  User Info                |  <- Normal flow
|  Caption section          |  <- Normal flow
|---------------------------|
|                           |
|  [Constrained Image]      |  <- max-h-[60vh]
|  [60vh max height]        |
|                           |
|       ● ○                 |
+---------------------------+
|  [Social Bar]             |
+---------------------------+
```

**New (Fullscreen):**
```
+---------------------------+
|                           |
|                           |
|   [FULLSCREEN IMAGE]      |  <- Fills entire area
|   [object-contain]        |
|                           |
|       ● ○                 |  <- Dot indicators
|===========================|  <- Gradient overlay starts
|  User Info                |  <- Over image with gradient bg
|  Caption (3 lines)        |
|  [More]                   |
+---------------------------+
|  [Social Bar]             |  <- Fixed at bottom
+---------------------------+
```

**When "More" clicked:**
```
+---------------------------+
|                           |
|   [FULLSCREEN IMAGE]      |  <- Still visible behind
|   (partially obscured)    |
|===========================|
|  User Info                |  <- Larger overlay, scrollable
|  Full caption text that   |
|  extends many lines and   |
|  can be scrolled within   |  <- max-h-[40vh] scrollable
|  this overlay section...  |
|  [Less]                   |
+---------------------------+
|  [Social Bar]             |
+---------------------------+
```

---

## Files to Modify
1. `src/components/feed/PhotoPostSlide.tsx` - Restructure to fullscreen image with overlay

## Implementation Details

1. **Background**: Change from `bg-background` to `bg-black` for true immersive feel
2. **Text Colors**: Use `text-white` instead of `text-foreground` since text is over image
3. **Gradient**: Apply `bg-gradient-to-t from-black/80 via-black/40 to-transparent` for readability
4. **Scroll Behavior**: Caption section scrollable when expanded, with `max-h-[40vh]` limit
5. **Image Navigation**: Keep horizontal swipe and arrow navigation on the image layer

