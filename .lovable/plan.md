
# Photo+ Feed Rebuild & FAB Menu Restructuring

## Overview
This plan transforms the Photo+ tab into a Threads-style feed experience with a new post creation flow. The changes consolidate multiple post types (Gallery, Text Card, Plain Text) into a single unified "Photo+" creation experience while maintaining video posts separately.

## Changes Summary

### 1. FAB Menu Restructuring

**Current FAB Options:**
- Camera → Take a photo or video
- Gallery → Choose from photos
- Story → Share for 24 hours
- Text Card → Styled text with backgrounds
- Plain Text → Share your thoughts
- Go Live → Start a live stream

**New FAB Options:**
- Video → Take video or choose from gallery
- Photo+ → Share your thoughts
- Story → Share for 24 hours
- Go Live → Start a live stream

### 2. New Photo+ Post Creation Flow

A Threads-inspired creation modal that supports:
- Text content (up to 1000 characters)
- Attach up to 2 images per post
- Image preview with remove functionality
- Dynamic text truncation with "See more/less"
- Responsive image lightbox for viewing

**UI Components:**
- Desktop: Quick post composer at top of Photo+ feed
- Mobile: Full-screen creation modal (triggered from FAB)

### 3. Photo+ Feed Display

Based on the provided Threads code, posts will show:
- User avatar, display name, and timestamp
- Text content with expandable long text
- Image grid (1 or 2 images) with lightbox viewer
- Horizontal social buttons using existing FeedIn button style:
  - Like (Heart)
  - Comment (MessageCircle)
  - Views (Eye)
  - Refeed (Repeat)
  - Gift (Gift)
  - Share (Share2)
- Promote button (existing gradient style)

### 4. Files to Create/Modify

---

## Technical Implementation Details

### Phase 1: Update FAB and Creation Sheet

**File: `src/components/post/NativeCreationSheet.tsx`**
- Change "Camera" to "Video" with description "Take video or choose from gallery"
- Replace Gallery, Text Card, Plain Text with single "Photo+" option
- Description: "Share your thoughts"
- Update icon to use `ImagePlus` or similar

**File: `src/components/post/PostCreationSelector.tsx`**
- Update to match NativeCreationSheet changes

### Phase 2: Create Photo+ Post Creator Component

**New File: `src/components/post/PhotoPlusPostCreator.tsx`**

Features:
- Full-screen modal for mobile
- Text input area (up to 1000 characters)
- Image attachment (max 2 images)
- Image preview grid with remove buttons
- Privacy selector
- Location input (optional)
- Hashtag input
- Post button

```text
┌─────────────────────────────────┐
│  Cancel          New Post  Post │
├─────────────────────────────────┤
│  ┌──────┐                       │
│  │Avatar│  What's on your mind? │
│  └──────┘                       │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Text input area          │   │
│  │ (1000 char limit)        │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌─────┐ ┌─────┐                │
│  │Img 1│ │Img 2│ (if attached)  │
│  │  X  │ │  X  │                │
│  └─────┘ └─────┘                │
│                                 │
│  ┌──────────────────────────┐   │
│  │ # Add hashtags           │   │
│  └──────────────────────────┘   │
│                                 │
│  Privacy: [Everyone ▼]          │
│                                 │
├─────────────────────────────────┤
│  📷 (Image picker, max 2)       │
└─────────────────────────────────┘
```

### Phase 3: Update ImmersivePostCard for Photo+ Layout

**File: `src/components/feed/ImmersivePostCard.tsx`**

Changes for Photo+ posts (when `layoutType === 'photo-text'`):

1. **Post Header** (profile info + timestamp at top)
2. **Text Content** with "See more/less" for long text (threshold: 150 chars)
3. **Image Grid** (if images attached):
   - Single image: Full width
   - Two images: Side-by-side grid
4. **Social Buttons** - Horizontal row using existing button components
5. **Promote Button** - Existing gradient style

### Phase 4: Create Image Lightbox Component

**New File: `src/components/feed/ImageLightbox.tsx`**

Features:
- Fullscreen image viewer
- Navigation arrows for multiple images
- Image counter (1/2)
- Close button
- Swipe navigation support

### Phase 5: Update Feed.tsx Integration

**File: `src/pages/Feed.tsx`**

Changes:
- Add new post step: `'photoplus'`
- Remove `'gallery'`, `'text'`, `'plaintext'` steps for Photo+ context
- Update NativeCreationSheet handlers:
  - `onVideoSelect` → Opens camera/gallery for video only
  - `onPhotoPlusSelect` → Opens PhotoPlusPostCreator
- Keep video creation flow unchanged

### Phase 6: Database Considerations

The existing `posts` table schema already supports the new Photo+ posts:
- `content`: Text content
- `media_urls`: Array for multiple images (up to 2)
- `media_types`: Array for media type classification
- `media_type`: Will be `'image'` for Photo+ posts with images, or `'text_plain'` for text-only

No database migrations required.

### Phase 7: Cleanup

**Files to Potentially Deprecate:**
- `src/components/post/PlainTextPostCreator.tsx` - Replaced by PhotoPlusPostCreator
- `src/components/post/TextPostCreator.tsx` - Replaced by PhotoPlusPostCreator
- `src/components/post/MediaGalleryPicker.tsx` - Integrated into PhotoPlusPostCreator (for Photo+ only; Video may still use separate flow)

**Remove from FAB:**
- Gallery option
- Text Card option
- Plain Text option

---

## Post Type Flow Summary

| FAB Option | Opens | Creates Post Type |
|------------|-------|-------------------|
| Video | Camera/Gallery picker | `media_type: 'video'` |
| Photo+ | PhotoPlusPostCreator | `media_type: 'image'` or `'text_plain'` |
| Story | CreateStoryModal | Story (24h) |
| Go Live | Navigate to /live | Live stream |

---

## Component Structure

```text
Feed.tsx
├── NativeCreationSheet (FAB menu)
│   ├── Video → NativeCameraView / NativeGalleryPicker (video only)
│   ├── Photo+ → PhotoPlusPostCreator (NEW)
│   ├── Story → CreateStoryModal
│   └── Go Live → Navigate /live
│
├── Photo+ Tab Content
│   └── ImmersivePostCard (layoutType="photo-text")
│       ├── Post Header (Avatar, Name, Time)
│       ├── Text Content (expandable)
│       ├── Image Grid (1-2 images)
│       ├── ImageLightbox (on image tap)
│       ├── Social Buttons (horizontal)
│       └── Promote Button
│
└── Videos Tab Content
    └── ImmersivePostCard (layoutType="video")
        └── Existing video layout
```

---

## Implementation Order

1. Create `PhotoPlusPostCreator.tsx` component
2. Create `ImageLightbox.tsx` component
3. Update `NativeCreationSheet.tsx` with new options
4. Update `PostCreationSelector.tsx` to match
5. Update `Feed.tsx` with new post step handling
6. Update `ImmersivePostCard.tsx` for Photo+ display improvements
7. Test integration and fix edge cases
8. Clean up deprecated components

---

## Social Button Consistency

The Photo+ posts will use the same social button styling as video posts:
- Same icons (Heart, MessageCircle, Eye, Repeat, Gift, Share2)
- Same color scheme
- Same animation effects
- Positioned horizontally under the content (matching the Threads code structure)
- Existing real-time synchronization for counts
