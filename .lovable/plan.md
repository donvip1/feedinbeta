
# Plan: Fix Live Content Interfering with Video and Photo+ Feeds

## Problem Summary

When there's a livestream, it interferes with both the Videos and Photo+ feeds, causing posts to not display properly and only showing streaming backgrounds instead of the actual content.

## Root Cause Analysis

After thorough investigation, I found two critical issues:

### Issue 1: Index Out of Bounds Bug in Periodic Live Card Injection

There's a mismatch between the **condition check** and the **render code**:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Index Access Mismatch                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CONDITION (line 933):                                          │
│    inlineLiveContent[index === 4 ? 1 : (inlineLiveContent[2]    │
│                       ? 2 : 1)]                                 │
│    → Falls back to index 1 if index 2 doesn't exist            │
│                                                                 │
│  RENDER (line 974):                                             │
│    inlineLiveContent[index === 4 ? 1 : 2]                       │
│    → ALWAYS tries index 2 when index === 9 (no fallback!)      │
│                                                                 │
│  Result: undefined access → Component crash → Feed breaks      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

When there are only 2 live items (indexes 0 and 1), and we're at post index 9:
- The condition passes (using fallback to index 1)
- The render fails (trying to access index 2 which is undefined)

### Issue 2: Query Still Fetches for Photo+ Tab

The inline live content query on line 220 is enabled when `activeTab !== 'live'`, meaning it still fetches for the Photo+ tab even though we don't render there. While not directly causing the visual issue, this is wasteful.

## Solution

### Fix 1: Correct the Periodic Injection Logic

Update the render code to use the same fallback logic as the condition:

**Current Code (lines 974-976):**
```typescript
inlineLiveContent[index === 4 ? 1 : 2]
```

**Fixed Code:**
```typescript
// Calculate the correct index with fallback
const liveItemIndex = index === 4 ? 1 : (inlineLiveContent[2] ? 2 : 1);
// Use liveItemIndex consistently for both condition and render
```

### Fix 2: Optimize Query Enabling

Update the inline live content query to only fetch when on the Videos tab:

**Current (line 220):**
```typescript
enabled: activeTab !== 'live'
```

**Fixed:**
```typescript
enabled: activeTab === 'videos'
```

### Fix 3: Add Null Safety Guards

Add defensive checks before rendering inline live cards to prevent crashes when data is unexpectedly undefined.

## Technical Changes

### File: `src/pages/Feed.tsx`

| Line Range | Change |
|------------|--------|
| 220 | Change query enabled condition from `activeTab !== 'live'` to `activeTab === 'videos'` |
| 929-933 | Extract the live item index calculation into a variable |
| 970-988 | Use the extracted variable and add null safety check |

### Detailed Code Changes

**1. Query Optimization (line 220)**

Change the enabled condition to only fetch inline content for Videos tab:
```typescript
enabled: activeTab === 'videos'
```

**2. Extract Index Calculation (around line 928)**

Before the `showInlineLive` condition, calculate the target index:
```typescript
const targetLiveIndex = index === 4 ? 1 : (inlineLiveContent?.[2] ? 2 : 1);
const liveItemForInjection = inlineLiveContent?.[targetLiveIndex];
```

**3. Simplify Condition (lines 929-933)**

Use the pre-calculated values:
```typescript
const showInlineLive = activeTab === 'videos' && 
  inlineLiveContent && 
  inlineLiveContent.length > 1 && 
  (index === 4 || index === 9) &&
  liveItemForInjection;
```

**4. Update Render (lines 970-988)**

Use the pre-calculated live item instead of recalculating:
```typescript
{showInlineLive && liveItemForInjection && (
  <div className="snap-start snap-always h-[calc(100dvh-68px)] flex items-center justify-center pt-16">
    <InlineLiveCard
      item={{
        ...liveItemForInjection,
        status: liveItemForInjection.status as string,
        type: liveItemForInjection.type
      }}
      onClick={() => {
        if (liveItemForInjection.type === 'video') {
          navigate(`/live/stream/${liveItemForInjection.id}`);
        } else {
          navigate(`/live/space/${liveItemForInjection.id}`);
        }
      }}
    />
  </div>
)}
```

## Expected Behavior After Fix

| Tab | Behavior |
|-----|----------|
| Videos | Live cards appear at top and after posts 5 & 10 (when live content exists) |
| Photo+ | No live cards appear, only Photo+ posts display normally |
| Live | Shows full live content list (unchanged) |

## Testing Checklist

1. Start a livestream/space in another account
2. Switch to Videos tab → verify live card appears at top and between posts
3. Switch to Photo+ tab → verify NO live cards appear, only photos/text posts
4. Verify no console errors when only 2 live items exist
5. Verify posts display correctly in both tabs when livestream is active
6. End the livestream → verify both tabs continue working normally
