
# Add Expandable Caption to Photo+ Fullscreen Mode

## Problem
In the Photo+ fullscreen mode, posts with lengthy captions only show a fraction of the text (limited to 3 lines via `line-clamp-3`). There's no way to read the full caption - users need a "show more/show less" toggle.

## Solution
Implement the same expandable caption pattern used in the video fullscreen mode (`ImmersivePostCard.tsx`):
1. Add `showFullCaption` state to control expansion
2. Calculate `truncatedCaption` and `shouldTruncateCaption` 
3. Show "more" button when caption is truncated
4. Show "less" button when caption is expanded
5. Expand to show full text when tapped

## Technical Implementation

### File: `src/components/feed/PhotoPostSlide.tsx`

**Change 1: Add state for caption expansion (around line 91)**
```typescript
// Add new state
const [showFullCaption, setShowFullCaption] = useState(false);
```

**Change 2: Add caption truncation logic (after line 70)**
```typescript
// Caption truncation - use 125 words limit for Photo+ posts (matching ImmersivePostCard)
const countWords = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
const wordCount = countWords(caption);
const shouldTruncateCaption = wordCount > 125;
const truncatedCaption = shouldTruncateCaption 
  ? caption.trim().split(/\s+/).slice(0, 125).join(' ') + '...' 
  : caption;
```

**Change 3: Replace caption display (lines 377-384)**

Current code:
```typescript
{showUI && caption && (
  <div className="absolute bottom-20 left-4 right-16 z-20 transition-opacity duration-200">
    <p className="text-white text-sm line-clamp-3 drop-shadow-lg" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
      {caption}
    </p>
  </div>
)}
```

New code:
```typescript
{showUI && caption && (
  <div 
    className="absolute bottom-20 left-4 right-16 z-20 transition-opacity duration-200"
    onClick={(e) => e.stopPropagation()}
  >
    <p 
      className={cn(
        "text-white text-sm drop-shadow-lg leading-relaxed",
        !showFullCaption && shouldTruncateCaption && "line-clamp-3"
      )} 
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
    >
      {showFullCaption ? caption : truncatedCaption}
    </p>
    {shouldTruncateCaption && (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setShowFullCaption(!showFullCaption);
        }}
        className="text-white/70 text-xs mt-1 font-medium hover:text-white transition"
      >
        {showFullCaption ? 'less' : 'more'}
      </button>
    )}
  </div>
)}
```

**Change 4: Reset caption state when post changes (update existing useEffect around line 93-96)**
```typescript
useEffect(() => {
  setCurrentImageIndex(initialImageIndex);
  setShowFullCaption(false); // Reset caption expansion on post change
}, [post.id, initialImageIndex]);
```

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Line ~91 | Add `showFullCaption` state |
| After line 70 | Add `countWords`, `shouldTruncateCaption`, `truncatedCaption` |
| Lines 377-384 | Replace static caption with expandable version |
| Lines 93-96 | Reset `showFullCaption` when post changes |

## Expected Result
- Captions longer than 125 words will show truncated with "more" button
- Tapping "more" reveals the full caption text
- Tapping "less" collapses it back to truncated form
- Caption expansion state resets when navigating to a different post
- Matches the behavior of video fullscreen mode exactly
