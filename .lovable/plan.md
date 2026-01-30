
# Plan: Increase Photo+ Max Images from 2 to 4

## Overview

Increase the maximum number of images allowed in Photo+ posts from 2 to 4 while preserving all existing preview and display functionality.

## Current State

- `MAX_IMAGES = 2` constant in `src/components/post/PhotoPlusPostCreator.tsx` (line 19)
- Two hardcoded image picker cards with dedicated file input refs
- Footer text says "Tap the cards above to add up to 2 photos"
- **Good news:** The feed display components (ImmersivePostCard, PhotoPostSlide, ImageLightbox) already handle multiple images dynamically via `media_urls` arrays with dot indicators and navigation arrows

## Changes Required

### File: `src/components/post/PhotoPlusPostCreator.tsx`

**1. Update Constant**
- Change `MAX_IMAGES = 2` to `MAX_IMAGES = 4`

**2. Update File Input Refs**
- Add `fileInputRef3` and `fileInputRef4` refs

**3. Update Image Picker Cards Layout**
- Expand from 2 to 4 image picker cards
- Adjust width from `w-[calc(37.5%-6px)]` to `w-[calc(25%-6px)]` or use a 2x2 grid layout
- Recommended: Use a 2-column grid with `grid grid-cols-2 gap-3` for better mobile UX

**4. Update Hidden File Inputs**
- Add two more hidden file inputs for the additional image slots

**5. Update Footer Text**
- Change "Tap the cards above to add up to 2 photos" to "Tap the cards above to add up to 4 photos"

## Visual Layout Change

Current (2 images):
```
┌──────────┐  ┌──────────┐
│    +     │  │    +     │
│ Add Photo│  │ Add Photo│
└──────────┘  └──────────┘
```

New (4 images - 2x2 grid):
```
┌──────────┐  ┌──────────┐
│    +     │  │    +     │
│ Add Photo│  │ Add Photo│
└──────────┘  └──────────┘
┌──────────┐  ┌──────────┐
│    +     │  │    +     │
│ Add Photo│  │ Add Photo│
└──────────┘  └──────────┘
```

## Components That Already Handle Multiple Images (No Changes Needed)

- **ImmersivePostCard** - Uses `mediaUrls.map()` for dot indicators and navigation
- **PhotoPostSlide** - Dynamically handles `images.length` for carousel
- **ImageLightbox** - Passes images array to PhotoPostSlide
- **Database** - `media_urls` column is already a text array (`text[]`)

## Technical Details

The key changes are:

```typescript
// Before
const MAX_IMAGES = 2;
const fileInputRef1 = useRef<HTMLInputElement>(null);
const fileInputRef2 = useRef<HTMLInputElement>(null);

// After
const MAX_IMAGES = 4;
const fileInputRefs = [
  useRef<HTMLInputElement>(null),
  useRef<HTMLInputElement>(null),
  useRef<HTMLInputElement>(null),
  useRef<HTMLInputElement>(null)
];
```

The image picker cards will be refactored from hardcoded elements to a mapped array for cleaner code.

## Summary

| Aspect | Change |
|--------|--------|
| Max images | 2 → 4 |
| File input refs | 2 hardcoded → 4 (array) |
| Card layout | Flex row → 2x2 grid |
| Footer text | Updated to reflect 4 photos |
| Feed display | No changes needed |
| Database | No changes needed |
