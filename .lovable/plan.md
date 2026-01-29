
## Fix Duplicate Text/Promote Button on Text-Only Posts

### Problem Analysis
The screenshot shows a text-only post "Greeting guys." appearing twice:
1. First in a proper Facebook-style card layout with header, content, social buttons, and a Promote button
2. A second time below with just the text and another Promote button (but no social buttons)

**Root Cause**: The footer section at lines 1628-1686 has the condition:
```typescript
!isImmersiveMode && !isTextStyled && !isPlainText && !isPhotoTextLayout
```

However, `isPlainText` only checks for `post.media_type === 'text_plain'`, while `isEffectivelyPlainText` is the broader condition that catches posts with NO media at all (null media_type). 

When a post has `media_type = null` and no media URL:
- `isPlainText` = false (because it's not exactly 'text_plain')
- `isEffectivelyPlainText` = true (because there's no media)

This causes the footer section to still render, showing the caption and Promote button again.

---

### Solution

Add `!isEffectivelyPlainText` to the footer section condition so it doesn't render for posts that already have their own self-contained card layout.

**File: `src/components/feed/ImmersivePostCard.tsx`**

**Change at line 1629:**
```typescript
// BEFORE
{!isImmersiveMode && !isTextStyled && !isPlainText && !isPhotoTextLayout && (

// AFTER  
{!isImmersiveMode && !isTextStyled && !isPlainText && !isPhotoTextLayout && !isEffectivelyPlainText && (
```

This ensures that:
- Text-only posts render ONLY as a self-contained Facebook-style card
- The footer section (caption + promote button) is skipped for text posts since they already have their own built-in footer
- No more duplicate text or promote buttons

---

### Technical Details

| Condition | Current | After Fix |
|-----------|---------|-----------|
| `isEffectivelyPlainText` | Not checked in footer | Excluded from footer |
| Footer renders for | Video posts only | Video posts only |
| Text card self-contained | Yes (has its own promote) | Yes (no duplicate) |

This is a single-line fix that resolves the duplicate rendering issue.
