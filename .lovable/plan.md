
# Plan: Fix Photo+ Multi-Image Layout & Video Gallery Filter

## Issues to Address

### Issue 1: Photo+ Multi-Image Posts Show Truncated Images with Blank Space
When uploading 2+ images in Photo+, the images appear small/truncated with blank space between them and the social buttons. Single images display correctly.

**Root Cause**: The multi-image carousel uses `aspect-[4/5]` which forces a fixed aspect ratio regardless of actual image dimensions. Combined with the container width constraints (`calc(50% - 4px)` for 2 images), this creates visual gaps.

**Solution**:
- Remove the fixed `aspect-[4/5]` constraint for multi-image carousels
- Use `aspect-auto` or a more natural aspect ratio that allows images to display at their natural height
- Adjust container sizing so images extend closer to social buttons
- Reduce vertical padding/margins in the image container

### Issue 2: Video Creation Shows Photos Instead of Videos in Gallery
When creating a video post from the FAB, the gallery picker shows both photos and videos. It should only show videos for video posts.

**Root Cause**: The `NativeGalleryPicker` component uses `accept="image/*,video/*"` which allows both file types. There's no prop to filter to video-only mode.

**Solution**:
- Add an `acceptType` prop to `NativeGalleryPicker` to specify 'video' | 'image' | 'all'
- In `Feed.tsx`, pass `acceptType="video"` when opening gallery for video posts
- Update the file input `accept` attribute dynamically based on this prop

---

## Technical Changes

### File 1: `src/components/feed/ImmersivePostCard.tsx`

**Lines 835-894** - Multi-image carousel section:
- Change `aspect-[4/5]` to `aspect-square` or remove aspect constraint entirely for multi-image displays
- Use `max-h-[60vh]` with `object-contain` to allow natural proportions
- Reduce `pb-1` padding in the container
- Adjust image wrapper heights to fill available space better

**Specific changes:**
- Line 861: Change `aspect-[4/5]` to allow natural image sizing
- Line 836: Reduce padding in outer container
- Line 851: Adjust width calculation for 2-image layouts to be larger

### File 2: `src/components/post/NativeGalleryPicker.tsx`

**Add new prop** to control accepted file types:
```typescript
interface NativeGalleryPickerProps {
  // ... existing props
  acceptType?: 'video' | 'image' | 'all'; // New prop
}
```

**Line 140** - Update file input:
- Change from `accept="image/*,video/*"` to dynamic based on `acceptType` prop
- Default to 'all' for backward compatibility

### File 3: `src/pages/Feed.tsx`

**Lines 981-990** - Video gallery picker:
- Add `acceptType="video"` prop when opening gallery for video creation
- This ensures only videos appear in the gallery picker for video posts

---

## Expected Results

1. **Photo+ Multi-Image**: Images will display at their natural proportions, extending closer to social buttons without blank space. Users can still tap to view fullscreen.

2. **Video Creation**: Gallery will only show video files, making it clear this is for video content. Photos will be filtered out.

---

## Files Modified
| File | Change |
|------|--------|
| `src/components/feed/ImmersivePostCard.tsx` | Adjust aspect ratios and spacing for multi-image carousel |
| `src/components/post/NativeGalleryPicker.tsx` | Add `acceptType` prop to filter media types |
| `src/pages/Feed.tsx` | Pass `acceptType="video"` to gallery picker for video posts |
