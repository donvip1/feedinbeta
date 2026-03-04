

# Display Space Cover Image + Description on Dashboard & Chat

## Problem
The `cover_image_url` is saved when creating spaces but not displayed in two key places:
1. **Live Dashboard cards** — spaces pass `item.thumbnail_url` (which is `null` for spaces; the correct field is `cover_image_url`)
2. **Chat/Comments sidebar** — `TwitterSpaceChat` and `SpaceChat` don't show the cover image at all

Additionally, the discover cards don't show the space description, so users can't learn about a space before joining.

## Changes

### 1. LiveDashboard.tsx — Fix thumbnail mapping for spaces
- Line 303: Change `thumbnailUrl={item.thumbnail_url}` to `thumbnailUrl={item.thumbnail_url || item.cover_image_url}` so spaces use their cover image
- Line 344 (Audio Spaces section): Add `thumbnailUrl={space.cover_image_url}` which is currently missing
- Also pass `description={item.description}` in both sections

### 2. LiveDiscoverCard.tsx — Show cover image + description
- Add `description?: string` to props
- Display the `thumbnailUrl` as a banner image above or behind the card content when present
- Show a truncated description (2 lines) below the title

### 3. TwitterSpaceChat.tsx — Show cover image in chat header
- Add `coverImageUrl?: string` prop
- Display the cover image in the Space Info Header section (replacing the generic emoji icon or as a banner above the info)

### 4. SpaceChat.tsx — Show cover image in chat header  
- Add `coverImageUrl?: string` and `spaceTitle?: string` props
- Display a small cover image banner at the top of the chat panel

### 5. Pass cover_image_url from parent components
- In `TwitterSpaceRoom.tsx` and any parent that renders `TwitterSpaceChat`, pass `coverImageUrl={space?.cover_image_url}`

## Files Modified (5 files)
| File | Change |
|------|--------|
| `LiveDashboard.tsx` | Fix `thumbnailUrl` mapping for spaces, pass description |
| `LiveDiscoverCard.tsx` | Add cover image banner + description display |
| `TwitterSpaceChat.tsx` | Add cover image to chat header |
| `SpaceChat.tsx` | Add cover image banner to chat |
| `TwitterSpaceRoom.tsx` | Pass `coverImageUrl` to chat component |

