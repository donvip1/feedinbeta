

# Plan: Fix Photo+ Social Button Arrangement & Alignment

## Problem Summary

The current social buttons in the Photo+ section have issues:
1. **Wrong order**: Currently Views is separate, order is inconsistent
2. **Right-aligned**: Buttons are aligned to the right (`justify-end`, `justify-between`)
3. **Promote button also right-aligned**: Should be left-aligned
4. **Fullscreen icons too small**: Using `w-4 h-4` instead of `w-5 h-5` like normal mode

## Required Order

**Correct order**: Likes → Comments → Refeed → Gifts → Views → Share

## Changes Required

### 1. Normal Mode - ImmersivePostCard.tsx

**Current layout (Line 1738):**
```
justify-between with Views on left, others on right
```

**New layout:**
```
justify-start (left-aligned), all buttons in one row with correct order
```

**Changes:**
- Line 1738: Change `justify-between` to `justify-start`
- Remove the separate Views container
- Reorder buttons: Like, Comments, Refeed, Gift, Views, Share (all in one flex row)
- Line 1780: Change `justify-end` to `justify-start` for Promote button

### 2. Fullscreen Mode - PhotoPostSlide.tsx

**Current issues:**
- Wrong order: Like, Comments, Gift, Views, Refeed, Share
- Right-aligned (`justify-end`)
- Icons are `w-4 h-4` (should be `w-5 h-5` to match normal mode)

**Changes:**
- Line 421: Change `justify-end` to `justify-start`
- Reorder buttons to: Like, Comments, Refeed, Gift, Views, Share
- Increase icon sizes from `w-4 h-4` to `w-5 h-5`
- Increase text from `text-[10px]` to `text-xs`
- Increase gap from `gap-1` to `gap-1.5`
- Line 495: Change `justify-end` to `justify-start` for Promote button

## Visual Before/After

**Before (Normal Mode):**
```
[Views]                    [Like] [Comments] [Refeed] [Gift] [Share]
                                                          [Promote]
```

**After (Normal Mode):**
```
[Like] [Comments] [Refeed] [Gift] [Views] [Share]
[Promote]
```

**Before (Fullscreen):**
```
                    [Like] [Comments] [Gift] [Views] [Refeed] [Share]
                                                          [Promote]
```

**After (Fullscreen):**
```
[Like] [Comments] [Refeed] [Gift] [Views] [Share]
[Promote]
```

## Implementation Details

### File: `src/components/feed/ImmersivePostCard.tsx`

**Lines 1737-1791** - Replace with:
```tsx
{/* Social buttons row - LEFT ALIGNED */}
<div className="flex items-center justify-start gap-4 px-3 py-2.5">
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

  {/* Views */}
  <div className="flex items-center gap-1.5">
    <Eye className="w-5 h-5 text-muted-foreground/60" />
    <span className="text-muted-foreground/60 text-xs font-medium">{formatCount(post.views_count || 0)}</span>
  </div>
  
  {/* Share */}
  <button onClick={() => { setShareOpen(true); onInteractionStart?.(); }} className="flex items-center gap-1.5 group">
    <Share2 className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-90" />
  </button>
</div>

{/* Promote Button - LEFT ALIGNED */}
{user && isPromoted !== true && (
  <div className="flex justify-start px-3 pb-2.5">
    ...
  </div>
)}
```

### File: `src/components/feed/PhotoPostSlide.tsx`

**Lines 420-508** - Replace with:
```tsx
{/* Social buttons row - LEFT ALIGNED, LARGER ICONS */}
<div className="flex items-center justify-start gap-4">
  {/* Like */}
  <button ... className="flex items-center gap-1.5 group">
    <Heart className={cn("w-5 h-5 transition-transform", liked ? "text-pink-500 fill-pink-500" : "text-white")} />
    <span className="text-white text-xs font-medium">{formatCount(likesCount)}</span>
  </button>

  {/* Comments */}
  <button ... className="flex items-center gap-1.5 group">
    <MessageCircle className="w-5 h-5 text-white" />
    <span className="text-white text-xs font-medium">{formatCount(commentsCount)}</span>
  </button>

  {/* Refeed - MOVED UP */}
  <button ... className="flex items-center gap-1.5 group">
    <Repeat className="w-5 h-5 text-white" />
    <span className="text-white text-xs font-medium">{formatCount(refeedsCount)}</span>
  </button>

  {/* Gift */}
  <button ... className="flex items-center gap-1.5 group">
    <Gift className="w-5 h-5 text-white" />
    <span className="text-white text-xs font-medium">{formatCount(giftsCount)}</span>
  </button>

  {/* Views */}
  <div className="flex items-center gap-1.5">
    <Eye className="w-5 h-5 text-white/60" />
    <span className="text-white/60 text-xs font-medium">{formatCount(post.views_count || 0)}</span>
  </div>

  {/* Share */}
  <button ... className="flex items-center gap-1.5 group">
    <Share2 className="w-5 h-5 text-white" />
  </button>
</div>

{/* Promote Button - LEFT ALIGNED */}
{user && post.id && (
  <div className="flex justify-start mt-2">
    ...
  </div>
)}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/ImmersivePostCard.tsx` | Left-align all buttons, correct order, left-align Promote |
| `src/components/feed/PhotoPostSlide.tsx` | Left-align, correct order, increase icon sizes to match normal mode, left-align Promote |

## Summary

1. **Reorder buttons**: Like → Comments → Refeed → Gift → Views → Share
2. **Left-align social buttons**: Change `justify-end`/`justify-between` to `justify-start`
3. **Left-align Promote button**: Change `justify-end` to `justify-start`
4. **Match icon sizes**: Fullscreen icons changed from `w-4 h-4` to `w-5 h-5`
5. **Match text sizes**: Fullscreen text changed from `text-[10px]` to `text-xs`
6. **Match gaps**: Fullscreen gaps changed from `gap-1` to `gap-1.5`

