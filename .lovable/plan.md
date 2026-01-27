
# Implementation Plan: Fix Notifications, Photo+ Multi-Image Display, and Post Navigation

## Overview

This plan addresses three key issues:
1. **Notifications consolidation** - Remove badge counts from Home/Feed and Wallet nav icons, consolidate all notifications to the notification bell icon only
2. **Photo+ multi-image display** - Fix the bug where only one image shows in Photo+ posts; add horizontal swipe carousel and fullscreen lightbox
3. **Post creation redirect** - Ensure users are taken directly to the created post after upload with instant visibility

---

## Issue 1: Consolidate Notifications to Bell Icon Only

### Current Behavior
- The bottom navigation shows notification badges on Home (feed), Chats, and Wallet icons
- `useDistributedNotifications` hook categorizes notifications and distributes counts across nav items

### Required Changes

**File: `src/components/navigation/BottomNav.tsx`**
- Remove the `getNavBadgeCount` function logic for 'feed' and 'wallet' (only keep 'chats' for unread messages)
- Remove badge rendering for Home and Wallet icons
- Remove `markCategoryAsRead` calls for 'feed' and 'wallet' on nav clicks

**File: `src/hooks/useDistributedNotifications.tsx`**
- Keep the hook for internal use but the BottomNav will no longer use distributed counts for nav badges

**File: `src/components/notifications/NotificationsPanel.tsx`**
- Update to include ALL notification types (remove the filtering that excludes wallet/credit notifications)
- Ensure wallet notifications show proper descriptions

**File: `src/components/notifications/NotificationItem.tsx`**
- Verify notification descriptions are properly displayed for all types including wallet/credit

---

## Issue 2: Photo+ Multi-Image Display with Carousel and Lightbox

### Current Behavior
- `ImmersivePostCard` has `media_urls` array but only renders a single image (`currentMediaUrl`)
- The existing swipe logic changes `currentMediaIndex` but there's no visual indicator of multiple images
- The `ImageLightbox` component exists but is NOT imported or used in `ImmersivePostCard`

### Required Changes

**File: `src/components/feed/ImmersivePostCard.tsx`**

1. **Import ImageLightbox at the top**:
```typescript
import ImageLightbox from './ImageLightbox';
```

2. **Add state for lightbox**:
```typescript
const [showLightbox, setShowLightbox] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState(0);
```

3. **Replace single image display with an image grid/carousel for Photo+ posts**:
   - For Photo+ layout (`isPhotoTextLayout`), display images in a grid (1-2 columns)
   - Add horizontal swipe indicator dots below images
   - On image tap, open `ImageLightbox` in fullscreen

4. **Add ImageLightbox component to the modals section**:
```typescript
{showLightbox && hasImage && (
  <ImageLightbox
    images={mediaUrls}
    activeIndex={lightboxIndex}
    onClose={() => setShowLightbox(false)}
    onNavigate={(idx) => {
      setLightboxIndex(idx);
      setCurrentMediaIndex(idx);
    }}
  />
)}
```

5. **Update image tap handler for Photo+ posts**:
   - Tapping an image should open lightbox instead of immersive mode
   - Lightbox shows caption in fullscreen view

6. **Add swipe indicator dots** when `hasMultipleMedia` is true

### Visual Layout for Photo+ Multi-Image Posts

```text
+---------------------------+
|  User Info / Caption      |
+---------------------------+
| +-------+  +-------+      |
| | Img 1 |  | Img 2 |      |  <- Tappable to open lightbox
| +-------+  +-------+      |
|         [• ○]              |  <- Swipe indicator dots
+---------------------------+
|  Like  Comment  Share...  |
+---------------------------+
```

---

## Issue 3: Instant Post Creation Redirect

### Current Behavior
- `PhotoPlusPostCreator.tsx` navigates to `/feed` after post creation
- There may be a delay before the post appears in the feed

### Required Changes

**File: `src/components/post/PhotoPlusPostCreator.tsx`**
- Change navigation from `/feed` to `/feed/post/${newPost.id}` to take user directly to their new post
- This ensures instant visibility without waiting for feed refresh

**File: `src/components/camera/CameraCapture.tsx`** (if exists)
- Apply same navigation pattern for video posts

**File: Any other post creator components**
- Update navigation to redirect to the created post's direct URL

---

## Technical Summary

| File | Changes |
|------|---------|
| `BottomNav.tsx` | Remove badge counts from Feed and Wallet icons; keep only Chats badge |
| `useDistributedNotifications.tsx` | No changes needed (hook remains for other uses) |
| `NotificationsPanel.tsx` | Include wallet/credit notifications (remove exclusion filter) |
| `ImmersivePostCard.tsx` | Add ImageLightbox import, multi-image grid for Photo+ layout, swipe dots, tap-to-fullscreen |
| `PhotoPlusPostCreator.tsx` | Navigate to `/feed/post/${newPost.id}` instead of `/feed` |

---

## Implementation Order

1. **Notifications consolidation** (BottomNav + NotificationsPanel updates)
2. **Photo+ multi-image grid and carousel** (ImmersivePostCard + ImageLightbox integration)
3. **Post creation redirect** (PhotoPlusPostCreator navigation change)

---

## Expected Outcome

After implementation:
- All notification badges will only appear on the bell icon in the profile section
- Photo+ posts with 2 images will display in a side-by-side grid with swipe indicators
- Tapping any image opens a fullscreen lightbox with horizontal swipe navigation
- After creating a post, users are immediately taken to view their new post
