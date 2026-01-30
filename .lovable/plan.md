

# Plan: Move User Info Above Image in Photo+ Fullscreen

## Overview
This plan moves the user information (avatar, display name, username, timestamp, etc.) from the bottom overlay to a fixed header at the top of the fullscreen view. The caption will remain at the bottom overlaying the image, while the image continues to fill the screen.

---

## Current Layout

```
+---------------------------+
|                           |
|                           |
|   [FULLSCREEN IMAGE]      |
|                           |
|                           |
|===========================|  <- Gradient overlay at bottom
|  Avatar + Display Name    |  <- User info in bottom overlay
|  @username • 2h • Globe   |
|  Caption (3 lines)        |
|  [More]                   |
+---------------------------+
|  [Social Bar]             |
+---------------------------+
```

---

## Proposed Layout

```
+---------------------------+
|  Avatar | Display Name    |  <- Fixed header at TOP
|         | @user • 2h      |
+---------------------------+
|                           |
|   [FULLSCREEN IMAGE]      |  <- Image fills remaining space
|                           |
|===========================|  <- Gradient overlay at bottom
|  Caption (3 lines)        |  <- Caption stays at bottom
|  [More]                   |
+---------------------------+
|  [Social Bar]             |
+---------------------------+
```

---

## Technical Changes

### File: `src/components/feed/PhotoPostSlide.tsx`

#### 1. Add Fixed User Info Header at Top (NEW)
- Create a new section above the image container
- Contains: Avatar, display name, follow button, @username, timestamp, visibility icon, location
- Uses semi-transparent black background for visibility
- Positioned in normal document flow (not absolute)

#### 2. Update Image Container
- Image container becomes `flex-1` to fill space between header and social bar
- Image remains fullscreen with `object-contain`

#### 3. Update Bottom Overlay
- Remove user info from bottom overlay
- Keep only the caption section with gradient background
- Caption retains 3-line limit with More/Less toggle

---

## Structure Changes

**Current (Lines 228-400):**
```tsx
<div className="w-full h-full flex flex-col bg-black">
  {/* Fullscreen Image Container */}
  <div className="flex-1 relative overflow-hidden">
    {/* Image */}
    {/* Navigation Arrows */}
    {/* Dot Indicators */}
    
    {/* Bottom Overlay - Contains BOTH user info AND caption */}
    <div className="absolute bottom-0 ...">
      {/* User Info */}
      {/* Caption */}
    </div>
  </div>
  
  {/* Social Bar */}
</div>
```

**New:**
```tsx
<div className="w-full h-full flex flex-col bg-black">
  {/* NEW: Fixed User Info Header at TOP */}
  <div className="flex-shrink-0 px-4 py-3 bg-black/80">
    <div className="flex items-center gap-3">
      <Avatar ... />
      <div className="flex flex-col">
        <span>Display Name</span> + Follow button
        <span>@username • 2h • Globe • Location</span>
      </div>
    </div>
  </div>

  {/* Fullscreen Image Container */}
  <div className="flex-1 relative overflow-hidden">
    {/* Image */}
    {/* Navigation Arrows */}
    {/* Dot Indicators */}
    
    {/* Bottom Overlay - Contains ONLY caption now */}
    <div className="absolute bottom-0 ...">
      {/* Caption Section */}
    </div>
  </div>
  
  {/* Social Bar */}
</div>
```

---

## Detailed Implementation

### A. New Header Section (Insert before image container)
```tsx
{/* User Info Header - Fixed at top */}
<div 
  className="flex-shrink-0 px-4 py-3 bg-black/80 border-b border-white/10"
  onClick={(e) => e.stopPropagation()}
>
  <div 
    className="flex items-center gap-3 cursor-pointer"
    onClick={handleProfileClick}
  >
    <Avatar className="w-10 h-10 border-2 border-white/30">
      <AvatarImage src={post.profiles?.avatar_url || ''} />
      <AvatarFallback className="bg-white/20 text-white">
        {displayName[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-white text-sm">
          {displayName}
        </span>
        {/* Follow button */}
      </div>
      <div className="flex items-center gap-2 text-white/60 text-xs">
        <span>@{post.profiles?.username || 'user'}</span>
        <span>•</span>
        <span>{postTime}</span>
        <span>•</span>
        {/* Visibility icon */}
        {/* Location */}
      </div>
    </div>
  </div>
</div>
```

### B. Update Bottom Overlay (Lines 311-399)
- Remove the user info section (lines 316-367)
- Keep only the caption section
- Adjust padding since user info is gone

```tsx
{/* Bottom Overlay with Caption Only */}
<div 
  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pointer-events-auto"
  onClick={(e) => e.stopPropagation()}
>
  {/* Caption Section - Scrollable when expanded */}
  {caption && (
    <div className={cn(...)}>
      <p className={cn(...)}>
        {caption}
      </p>
      {/* More/Less button */}
    </div>
  )}
</div>
```

### C. Update Dot Indicators Position
- Adjust the `bottom-[180px]` value since the overlay is now shorter
- New position: `bottom-[100px]` (approximate, will need fine-tuning)

---

## Visual Result

```
+---------------------------+
| [Avatar] Display Name     |  <- Top header (bg-black/80)
|          @user • 2h • 🌍  |
+===========================+
|                           |
|                           |
|   [FULLSCREEN IMAGE]      |  <- Fills remaining viewport
|   (object-contain)        |
|                           |
|         ● ○               |  <- Dot indicators
|===========================|  <- Gradient overlay
|  Caption text here that   |  <- Caption at bottom
|  can be expanded...       |
|  [More]                   |
+---------------------------+
|  [Social Bar]             |  <- Fixed at bottom
+---------------------------+
```

---

## Files to Modify
1. `src/components/feed/PhotoPostSlide.tsx` - Restructure layout

## No Changes Required
- `src/components/feed/ImmersivePostCard.tsx` - Normal mode already correct
- Other files unchanged

