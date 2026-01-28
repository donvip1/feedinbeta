
# Plan: Fix Swipe Navigation in Photo+ Fullscreen Lightbox

## Problem
When viewing multiple images in fullscreen (ImageLightbox), finger swipe gestures to navigate between images don't work. Users can only navigate using the arrow buttons, but swiping left/right navigates away from the lightbox instead of between images.

## Root Cause
In `ImageLightbox.tsx`, the drag configuration has conflicting settings:
- Line 283-286: `drag="x"` with `dragConstraints={{ left: 0, right: 0 }}` - the zero constraints prevent proper offset detection
- The nested drag elements (horizontal on container, vertical on image) interfere with each other
- Touch events may be bubbling up and triggering browser back navigation

## Solution
Refactor the drag/swipe handling to properly detect and respond to horizontal swipe gestures:

1. **Remove conflicting constraints** - Allow the draggable element to actually move during the swipe gesture
2. **Consolidate drag handling** - Handle both horizontal and vertical gestures on a single element to avoid conflicts
3. **Add touch-action CSS** - Prevent browser from intercepting swipe gestures
4. **Improve gesture detection** - Lower thresholds and add better velocity detection for more responsive swiping

## Technical Changes

### File: `src/components/feed/ImageLightbox.tsx`

1. **Update drag constraints** (lines 282-288):
   - Change `dragConstraints={{ left: 0, right: 0 }}` to allow actual movement during drag
   - Use elastic constraints that snap back after gesture completes

2. **Consolidate gesture handling**:
   - Handle both X and Y drag on a single motion element
   - Determine gesture direction (horizontal vs vertical) based on initial movement
   - Horizontal swipe = navigate between images
   - Vertical swipe down = close lightbox

3. **Add touch-action CSS**:
   - Add `touchAction: 'none'` to prevent browser handling of touch events
   - This stops the browser from interpreting swipes as back/forward navigation

4. **Improve handleDragEnd logic**:
   - Lower the threshold from 50px to 30px for more responsive swiping
   - Add direction lock to prevent accidental diagonal gestures
   - Ensure velocity detection is working properly

## Expected Behavior After Fix
- Swipe left with finger → shows next image
- Swipe right with finger → shows previous image  
- Swipe down → closes lightbox
- Arrow buttons continue to work as before
- Gestures feel native and responsive like other mobile apps
