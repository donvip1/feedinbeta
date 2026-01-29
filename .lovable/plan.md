

# Fix Photo+ Fullscreen Social Buttons Not Working

## Problem Summary

In the Photo+ fullscreen mode, social buttons (Comments, Refeed, Gift, Share) don't work properly:
1. **Comments, Refeed, Gift, Share buttons don't show their modals** - they appear frozen/non-responsive
2. **Buttons hide when tapped** instead of triggering their actions
3. **Modals appear behind the lightbox** due to z-index conflicts

## Root Cause Analysis

### Issue 1: Z-Index Conflict
- `ImageLightbox` uses `z-[200]` for its fullscreen container
- Modal components (`Sheet`, `Dialog`) use `z-50` by default
- When modals open, they render BEHIND the lightbox instead of on top

### Issue 2: UI Toggle Interference  
The social buttons row has condition `{showUI && !commentsOpen && (...)}` - when a modal opens, `showUI` might get toggled, causing buttons to disappear.

## Solution

### Part 1: Fix Modal Z-Index for Photo+ Fullscreen

Update `PhotoPostSlide.tsx` to pass higher z-index classes to the modals so they appear above the lightbox (z-[200]):

**CommentsModal**: Add `className` prop to SheetContent with `z-[250]`
**MobileShareSheet**: Add `className` prop to SheetContent with `z-[250]`
**GiftModal**: Add `className` prop to DialogContent with `z-[250]`
**RefeedModal**: Add `className` prop to SheetContent with `z-[250]`

### Part 2: Prevent Buttons From Hiding When Modals Open

Update the social buttons visibility condition in `PhotoPostSlide.tsx` from:
```typescript
{showUI && !commentsOpen && (
```
to:
```typescript
{showUI && (
```

The buttons should remain visible when modals are open since the modals have their own overlays.

### Part 3: Update Modal Components to Accept z-index Override

Ensure the base UI components (`Sheet`, `Dialog`) can accept custom z-index via className without breaking.

---

## Technical Implementation

### File 1: `src/components/feed/PhotoPostSlide.tsx`

**Change 1** - Remove `!commentsOpen` from social buttons condition (lines ~395):
```typescript
// Before
{showUI && !commentsOpen && (

// After
{showUI && (
```

**Change 2** - Remove `!commentsOpen` from caption condition (lines ~379):
```typescript
// Before
{showUI && caption && !commentsOpen && (

// After
{showUI && caption && (
```

### File 2: `src/components/feed/CommentsModal.tsx`

Add z-index to SheetContent for proper layering inside lightbox:
```typescript
<SheetContent 
  side="bottom" 
  className="h-[85vh] p-0 rounded-t-3xl z-[250]"
>
```

### File 3: `src/components/feed/MobileShareSheet.tsx`

Add z-index to SheetContent:
```typescript
<SheetContent 
  side="bottom" 
  className="... z-[250]"
>
```

### File 4: `src/components/feed/GiftModal.tsx`

Add z-index to DialogContent:
```typescript
<DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl z-[250]">
```

### File 5: `src/components/feed/RefeedModal.tsx`

Add z-index to SheetContent:
```typescript
<SheetContent 
  side="bottom" 
  className="... z-[250]"
>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/PhotoPostSlide.tsx` | Remove `!commentsOpen` conditions from social buttons and caption |
| `src/components/feed/CommentsModal.tsx` | Add `z-[250]` to SheetContent |
| `src/components/feed/MobileShareSheet.tsx` | Add `z-[250]` to SheetContent |
| `src/components/feed/GiftModal.tsx` | Add `z-[250]` to DialogContent |
| `src/components/feed/RefeedModal.tsx` | Add `z-[250]` to SheetContent |

---

## Expected Outcome

After these changes:
- Social buttons will remain visible and accessible in Photo+ fullscreen mode
- Tapping Comment button will open the comments sheet on top of the lightbox
- Tapping Refeed/Quote button will show the refeed options
- Tapping Gift button will open the gift modal properly
- Tapping Share button will show the share sheet
- All modals will appear above the fullscreen lightbox (z-[250] > z-[200])
- Behavior will match the video-based fullscreen experience

