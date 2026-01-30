

# Plan: Reduce Photo+ Post Gaps & Move Promote Button Below Social Buttons

## Overview

This plan addresses two layout issues in the Photo+ section:
1. Excessive blank space between posts
2. Promote button on the same line as social buttons (should be below)

## Changes Required

### 1. Reduce Gap Between Posts (50% reduction)

**Current spacing sources:**
- Post card has `pb-4` (16px padding-bottom)
- Card header has `mt-14` (56px margin-top)

**Solution:**
- Change `pb-4` to `pb-2` (8px, 50% reduction)
- Reduce `mt-14` to `mt-6` (24px, ~57% reduction)

**File: `src/components/feed/ImmersivePostCard.tsx`**

Line 660 - Change outer wrapper padding:
```tsx
// Before
!isImmersiveMode && isPhotoTextLayout && "min-h-fit pb-4"

// After
!isImmersiveMode && isPhotoTextLayout && "min-h-fit pb-2"
```

Line 794 - Reduce top margin on card header:
```tsx
// Before
<div className="flex-shrink-0 bg-card rounded-t-lg border-x border-t border-border mt-14 mx-2">

// After  
<div className="flex-shrink-0 bg-card rounded-t-lg border-x border-t border-border mt-6 mx-2">
```

### 2. Move Promote Button Below Social Buttons (Normal Posts)

**Current layout (same line):**
```
[Like] [Comment] [Gift] [Share]          [Views] [Promote]
```

**New layout (stacked):**
```
[Views]              [Like] [Comment] [Refeed] [Gift] [Share]
                                                    [Promote]
```

**File: `src/components/feed/ImmersivePostCard.tsx`**

Lines 1731-1794 - Restructure the Photo+ footer:

```tsx
{/* --- FOOTER SECTION: Horizontal Social Buttons for Photo+ Layout --- */}
{!isImmersiveMode && isPhotoTextLayout && !isEffectivelyPlainText && (
  <div className="flex-shrink-0 bg-card border-x border-b border-border rounded-b-lg mx-2">
    {/* Divider line */}
    <div className="border-t border-border mx-3" />
    
    {/* Social buttons row */}
    <div className="flex items-center justify-between px-3 py-2.5">
      {/* Views on left */}
      <div className="flex items-center gap-1">
        <Eye className="w-4 h-4 text-muted-foreground/60" />
        <span className="text-muted-foreground/60 text-xs">{formatCount(post.views_count || 0)}</span>
      </div>

      {/* Social buttons on right */}
      <div className="flex items-center gap-4">
        {/* Like */}
        <button onClick={handleLike} className="flex items-center gap-1.5 group">
          <Heart className={cn("w-5 h-5 transition-transform group-active:scale-90", liked ? "text-destructive fill-destructive" : "text-muted-foreground")} />
          <span className="text-muted-foreground text-xs font-medium">{formatCount(likesCount)}</span>
        </button>
        
        {/* Comments */}
        <button onClick={() => handleCommentsOpenChange(true)} className="flex items-center gap-1.5 group">
          <MessageCircle className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
          <span className="text-muted-foreground text-xs font-medium">{formatCount(commentsCount)}</span>
        </button>
        
        {/* Refeed */}
        <button onClick={() => { setRefeedOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
          <Repeat className={cn("w-5 h-5 transition-transform group-active:scale-90", hasRefeeded ? "text-green-500" : "text-muted-foreground")} />
          <span className={cn("text-xs font-medium", hasRefeeded ? "text-green-500" : "text-muted-foreground")}>{formatCount(refeedsCount)}</span>
        </button>

        {/* Gift */}
        <button onClick={() => { setGiftOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
          <Gift className={cn("w-5 h-5 transition-transform group-active:scale-90", hasGifted ? "text-pink-500" : "text-muted-foreground")} />
          <span className={cn("text-xs font-medium", hasGifted ? "text-pink-500" : "text-muted-foreground")}>{formatCount(giftsCount)}</span>
        </button>
        
        {/* Share */}
        <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
          <Share2 className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
        </button>
      </div>
    </div>

    {/* Promote Button - on its own row below */}
    {user && isPromoted !== true && (
      <div className="flex justify-end px-3 pb-2.5">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/promote/${post.id}`);
          }}
          className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full text-white hover:from-pink-600 hover:to-rose-600 transition-all active:scale-95"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold">Promote</span>
        </button>
      </div>
    )}
  </div>
)}
```

### 3. Move Promote Button Below Social Buttons (Fullscreen)

**File: `src/components/feed/PhotoPostSlide.tsx`**

Lines 418-511 - Restructure the fullscreen footer:

```tsx
{/* Fixed Social Buttons Bar */}
<div className="flex-shrink-0 bg-black/90 px-4 py-3">
  {/* Social buttons row */}
  <div className="flex items-center justify-end gap-4">
    {/* Like */}
    <button 
      onClick={(e) => { 
        e.stopPropagation(); 
        e.preventDefault(); 
        handleLike(e); 
      }} 
      className="flex items-center gap-1 group"
    >
      <Heart className={cn("w-4 h-4 transition-transform", liked ? "text-pink-500 fill-pink-500" : "text-white")} />
      <span className="text-white text-[10px] font-medium">{formatCount(likesCount)}</span>
    </button>

    {/* Comments */}
    <button 
      onClick={(e) => { 
        e.stopPropagation(); 
        e.preventDefault(); 
        setCommentsOpen(true); 
      }} 
      className="flex items-center gap-1 group"
    >
      <MessageCircle className="w-4 h-4 text-white" />
      <span className="text-white text-[10px] font-medium">{formatCount(commentsCount)}</span>
    </button>

    {/* Gift */}
    <button 
      onClick={(e) => { 
        e.stopPropagation(); 
        e.preventDefault(); 
        setGiftOpen(true); 
      }} 
      className="flex items-center gap-1 group"
    >
      <Gift className="w-4 h-4 text-white" />
      <span className="text-white text-[10px] font-medium">{formatCount(giftsCount)}</span>
    </button>

    {/* Views */}
    <div className="flex items-center gap-1">
      <Eye className="w-4 h-4 text-white/60" />
      <span className="text-white/60 text-[10px] font-medium">{formatCount(post.views_count || 0)}</span>
    </div>

    {/* Refeed */}
    <button 
      onClick={(e) => { 
        e.stopPropagation(); 
        e.preventDefault(); 
        setRefeedOpen(true); 
      }} 
      className="flex items-center gap-1 group"
    >
      <Repeat className="w-4 h-4 text-white" />
      <span className="text-white text-[10px] font-medium">{formatCount(refeedsCount)}</span>
    </button>

    {/* Share */}
    <button 
      onClick={(e) => { 
        e.stopPropagation(); 
        e.preventDefault(); 
        setShareOpen(true); 
      }} 
      className="flex items-center gap-1 group"
    >
      <Share2 className="w-4 h-4 text-white" />
    </button>
  </div>

  {/* Promote Button - on its own row below */}
  {user && post.id && (
    <div className="flex justify-end mt-2">
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          e.preventDefault(); 
          navigate(`/promote/${post.id}`); 
        }}
        className="px-2.5 py-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all active:scale-95 flex items-center gap-1"
      >
        <TrendingUp className="w-3.5 h-3.5 text-white" />
        <span className="text-white text-[10px] font-semibold">Promote</span>
      </button>
    </div>
  )}
</div>
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/ImmersivePostCard.tsx` | Reduce gaps (pb-4→pb-2, mt-14→mt-6), move Promote below social buttons |
| `src/components/feed/PhotoPostSlide.tsx` | Move Promote below social buttons in fullscreen |

## Visual Before/After

**Before (Normal Post):**
```
┌─────────────────────────────────────────┐
│ [Avatar] Name • Follow                  │
│ Caption text...                         │
│ [Image]                                 │
│ ─────────────────────────────────────── │
│ [Like] [Comment] [Gift] [Share]  [Views] [Promote] │
└─────────────────────────────────────────┘
                 ↓ 16px gap ↓
┌─────────────────────────────────────────┐
│ Next post...                            │
```

**After:**
```
┌─────────────────────────────────────────┐
│ [Avatar] Name • Follow                  │
│ Caption text...                         │
│ [Image]                                 │
│ ─────────────────────────────────────── │
│ [Views]   [Like] [Comment] [Refeed] [Gift] [Share] │
│                                    [Promote] │
└─────────────────────────────────────────┘
         ↓ 8px gap ↓
┌─────────────────────────────────────────┐
│ Next post...                            │
```

