
# Plan: Restructure Photo+ Fullscreen Layout

## Overview
This plan restructures the Photo+ fullscreen mode (`PhotoPostSlide.tsx`) to match the normal mode's card-based layout. Instead of overlaying caption text on top of the image, the fullscreen view will use a scrollable layout where:
1. User info appears at the top
2. Caption text appears below the user info (with 3-line limit and More/Less toggle)
3. Image appears at the bottom of the content
4. Social buttons remain at the bottom as a fixed bar

---

## Current Behavior (Problem)

**Fullscreen Mode Structure:**
```
+---------------------------+
|  User Info (overlay)      |   <- Absolute positioned
|                           |
|                           |
|    [FULL SCREEN IMAGE]    |   <- object-contain fills screen
|                           |
|  Caption overlay extends  |   <- Absolute positioned, overlays image
|  over user info when long |   <- Overflows beyond display name
|                           |
|  [Social Buttons bar]     |   <- Fixed at bottom
+---------------------------+
```

**Issue:** Long captions overlay on the image and extend beyond the user info, creating visual clutter.

---

## Proposed Solution

**New Fullscreen Mode Structure:**
```
+---------------------------+
|  [Back Button]            |   <- Fixed top-right
+---------------------------+
|  User Info                |   <- Part of scrollable content
|  ----------------------   |
|  Caption text (3 lines)   |   <- Line-clamped, expandable
|  [More] button            |
|  ----------------------   |
|                           |
|    [IMAGE]                |   <- After caption, in content flow
|                           |
|  (Dot indicators if 2+)   |
+---------------------------+
|  [Social Buttons bar]     |   <- Fixed at bottom
+---------------------------+
```

---

## Technical Implementation

### File: `src/components/feed/PhotoPostSlide.tsx`

#### A. Change from Overlay Layout to Scrollable Layout
- Replace the current fullscreen overlay structure with a scrollable vertical layout
- Move user info from absolute positioning to normal document flow
- Move caption from absolute overlay to normal document flow (after user info)
- Image comes after caption in the flow
- Social buttons remain fixed at the bottom

#### B. Update Caption Handling
- Use the same 3-line truncation logic (`line-clamp-3`) already in place
- Keep the "More/Less" pill-styled button for expansion
- When expanded, the content area becomes scrollable, pushing the image down

#### C. UI Consistency with Normal Mode
- Caption text uses `text-foreground` (theme-aware) instead of hardcoded white
- User info styled similarly to normal mode's header
- Image uses `object-contain` with proper aspect ratio

---

## Detailed Changes

### 1. Main Container Structure
**Current:**
```tsx
<div className="w-full h-full flex flex-col relative">
  {/* Image Container - Full height */}
  <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
    {/* Image */}
    {/* Gradient overlays */}
    {/* User Info - ABSOLUTE overlay at top */}
    {/* Caption - ABSOLUTE overlay at bottom */}
    {/* Social Buttons - ABSOLUTE overlay at very bottom */}
  </div>
</div>
```

**New:**
```tsx
<div className="w-full h-full flex flex-col bg-black">
  {/* Back button - Fixed top-right */}
  <button className="absolute top-4 right-4 z-50">...</button>
  
  {/* Scrollable Content Area */}
  <div className="flex-1 overflow-y-auto">
    {/* User Info Header - Normal flow */}
    <div className="p-4">...</div>
    
    {/* Caption Section - Normal flow, 3-line limit */}
    <div className="px-4 pb-3">
      <p className={cn(!showFullCaption && "line-clamp-3")}>
        {caption}
      </p>
      {/* More/Less button */}
    </div>
    
    {/* Image Section - Normal flow, below caption */}
    <div className="relative">
      <img className="w-full object-contain" />
      {/* Navigation arrows for multi-image */}
      {/* Dot indicators */}
    </div>
  </div>
  
  {/* Social Buttons Bar - Fixed at bottom */}
  <div className="flex-shrink-0 px-4 py-3">...</div>
</div>
```

### 2. Remove Overlay Gradients
- Remove `bg-gradient-to-b from-black/70 to-transparent` top gradient
- Remove `bg-gradient-to-t from-black/80 to-transparent` bottom gradient
- These are no longer needed since content is no longer overlaid

### 3. Update Text Colors for Theme Compatibility
- Change hardcoded `text-white` to `text-foreground` for captions
- User info uses theme-aware colors: `text-foreground` for names, `text-muted-foreground` for metadata

### 4. Image Container Updates
- Move from absolute positioning inside a flex-1 container
- Image gets proper aspect ratio handling with `object-contain`
- Swipe gesture handling for multi-image navigation preserved
- Dot indicators appear below the image

### 5. Social Buttons Bar
- Move from absolute overlay to fixed position at container bottom
- Keep horizontal layout with Promote, Like, Comment, Gift, Views, Refeed, Share
- Use semi-transparent background for visibility

---

## Visual Comparison

**Before (Long Caption):**
```
+---------------------------+
|  @user • 2h • Globe       |   <- Overlaid on image
|                           |
|    [IMAGE PARTIALLY       |
|     VISIBLE BEHIND        |
|     CAPTION TEXT]         |
|                           |
|  This is a very long      |   <- Overlays on image
|  caption that extends     |   <- Extends upward past
|  beyond the user info     |   <- user info
|  covering the image...    |
|  [More]                   |
|  [Promote] [♡] [💬] ...  |
+---------------------------+
```

**After (Long Caption):**
```
+---------------------------+   [X]
|  @user • 2h • Globe       |   <- In content flow
|---------------------------|
|  This is a very long      |   <- Below user info
|  caption that extends     |   <- 3-line limit initially
|  beyond the user...       |
|  [More]                   |
|---------------------------|
|                           |
|    [IMAGE]                |   <- Below caption
|                           |
|    ● ○                    |   <- Dot indicators
+---------------------------+
|  [Promote] [♡] [💬] ...  |   <- Fixed at bottom
+---------------------------+
```

---

## Files to Modify
1. `src/components/feed/PhotoPostSlide.tsx` - Main restructure

## No Changes Required
- `src/components/feed/ImmersivePostCard.tsx` - Already has correct normal mode layout
- `src/components/feed/ImageLightbox.tsx` - Container wrapper, no content changes needed

---

## Implementation Notes

1. **Scroll Behavior**: When caption is expanded, the content area becomes scrollable, allowing users to see the full caption and then scroll down to the image

2. **Gesture Handling**: Horizontal swipe for image navigation is preserved using the same touch handlers

3. **Back Button**: Moved from in-ImageLightbox to inside PhotoPostSlide for consistent positioning

4. **Theme Support**: Using `text-foreground` and `bg-background` ensures proper contrast in both light and dark modes

5. **Image Aspect Ratio**: Using `object-contain` with `max-h-[60vh]` ensures the image fits well without taking excessive space
