

## Root Cause

The `ChatMediaViewer` is rendered **inline** inside `MediaMessageBubble` (sibling to the image thumbnail). When the back button closes the viewer and it unmounts, the same touch/click event "falls through" to the image thumbnail underneath and **immediately reopens** it. The 400ms guard ref is not reliably preventing this on mobile because React state updates and unmounting can race with native touch events.

## Fix

**Render `ChatMediaViewer` via a React Portal** so it lives at `document.body` level, completely outside the message bubble DOM tree. This makes it physically impossible for close-tap events to propagate to the thumbnail.

### Changes

**`ChatMediaViewer.tsx`** -- Wrap the entire return in `ReactDOM.createPortal(..., document.body)`. This ensures the overlay is in a separate DOM subtree from the chat bubbles.

**`MediaMessageBubble.tsx`** -- Simplify the close guard logic (can reduce timeout or remove entirely since the portal eliminates the propagation issue). Keep `showViewer` state as-is.

This is a 2-file, ~10-line change that eliminates the bug at its architectural root rather than patching timing heuristics.

