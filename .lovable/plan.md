

# Fix Missing Verified Badge in Photo+ Normal Mode

## Problem
The Photo+ feed uses a separate "Facebook-style card layout" header (line 802-856 in ImmersivePostCard.tsx) that does NOT include the VerifiedBadge component. The badge only appears in the video layout header (line 689-691) and in immersive/fullscreen mode, but is completely absent from the Photo+ card-style normal view.

## Root Cause
In `src/components/feed/ImmersivePostCard.tsx`, there are two header sections:
1. **Video layout header** (line 673) -- has VerifiedBadge
2. **Photo+ card layout header** (line 802) -- missing VerifiedBadge

The Photo+ card header at line 818-826 renders the display name without the badge:
```text
<span className="font-semibold text-foreground text-sm cursor-pointer hover:underline">
  {displayName}
</span>
```

## Fix
Add `VerifiedBadge` next to the display name in the Photo+ card layout header, matching the pattern used in the video header.

### Changes to `src/components/feed/ImmersivePostCard.tsx`:

**Line 818-826**: Wrap the display name span in a flex container and add the VerifiedBadge:

```text
<span 
  className="font-semibold text-foreground text-sm cursor-pointer hover:underline flex items-center gap-1"
  onClick={...}
>
  {displayName}
  <VerifiedBadge userId={post.user_id} size="sm" />
</span>
```

No new imports needed -- VerifiedBadge is already imported at line 11.

This is a single-line change in one file that will make the badge appear consistently in both normal and fullscreen Photo+ views.
