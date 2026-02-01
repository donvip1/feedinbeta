
# Plan: Fix Three-Dots Menu and Social Buttons State Collision

## Problem Summary

The three-dots menu button (⋮) and the social buttons expand toggle (⋯) are incorrectly linked because they share the same state variable `showMoreActions`. This causes:

1. Clicking the three-dots menu → shows both the Delete dropdown AND expands hidden social buttons
2. Clicking expand social buttons → may trigger the delete dropdown overlay
3. Confusing UX where unrelated UI elements respond to clicks

## Root Cause

Single state variable controlling two unrelated features:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Current State Collision                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  showMoreActions = true                                         │
│       ├── Shows Delete dropdown (three-dots menu)               │
│       └── Shows Views/Refeed/Share buttons (social expand)      │
│                                                                 │
│  These are UNRELATED features sharing ONE boolean state!        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Solution

Split into two separate state variables with clear purposes:

| State Variable | Purpose | Used By |
|----------------|---------|---------|
| `showPostMenu` (NEW) | Controls three-dots dropdown with Delete option | Three-dots button (⋮) |
| `showMoreActions` (KEEP) | Controls expanded social buttons visibility | More button (⋯) |

## Technical Changes

### 1. Add New State Variable

Add a new state specifically for the post menu dropdown:

```typescript
const [showPostMenu, setShowPostMenu] = useState(false); // Three-dots menu dropdown
```

### 2. Update Three-Dots Menu Buttons (3 locations)

Change all three-dots menu instances to use the new state:

**Location 1: Immersive mode header (around line 735)**
**Location 2: Photo+ card header (around line 853)**  
**Location 3: Plain text post header (around line 1553)**

Each needs:
- Button onClick: `setShowPostMenu(!showPostMenu)` instead of `setShowMoreActions(!showMoreActions)`
- Overlay onClick: `setShowPostMenu(false)`
- Conditional render: `{showPostMenu && (...)}` 
- Delete button: `setShowPostMenu(false); setShowDeleteDialog(true);`

### 3. Add Event Propagation Stoppage

All three-dots buttons should prevent event bubbling:

```typescript
<button 
  onClick={(e) => {
    e.stopPropagation();
    setShowPostMenu(!showPostMenu);
  }}
  // ...
>
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/feed/ImmersivePostCard.tsx` | Add `showPostMenu` state, update 3 three-dots menu instances |

## Expected Behavior After Fix

| Action | Result |
|--------|--------|
| Click three-dots (⋮) | Only shows Delete dropdown, social buttons unchanged |
| Click more (⋯) on social sidebar | Only expands Views/Refeed/Share buttons |
| Click outside menu | Only closes the menu that's open |

## Testing Checklist

1. Click three-dots menu → verify only Delete dropdown appears
2. Click outside → verify dropdown closes
3. Click Delete → verify delete dialog opens
4. Click expand social buttons → verify only extra buttons appear
5. Verify no cross-interaction between the two features
