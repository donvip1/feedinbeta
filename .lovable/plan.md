

# Plan: Align TwitterStreamRoom UI to Match Reference Code

## Problem
The current `TwitterStreamRoom.tsx` has a more complex UI with elements not present in the user's reference code. The user wants the stream room to visually match their provided code exactly, while keeping all real backend integrations (LiveKit, Supabase, credit system, 85/15 gift split).

## Key UI Differences to Fix

### 1. Remove Right-Side Action Stack (lines 1396-1451)
The user's code has NO vertical action buttons (React, Share, Flip, Guests, PK) on the right side. These will be removed from the main view. Share/React/Flip/Guests remain accessible via the settings menu and header.

### 2. Simplify Header (lines 1253-1303)
**Current**: Minimize button, host pill, "HD Live" badge, Invite button, settings (⋯), close (X)
**User's code**: Host avatar + stream title + viewer count on left, just close (X) on right

### 3. Update PK Score Bar (lines 1316-1354)
**Current**: "N-Way Battle" label with timer
**User's code**: "TEAM HOST" on left, timer in center, "CHALLENGERS" on right, with proportional colored bar below

### 4. Update PK Video Grid Styling (renderPKFeed, lines 1119-1175)
**Current**: Gradient bg, avatar image, Flame icon + score badge, name tag
**User's code**: Colored bg with large initial letter + name text for non-host, "SCORE: X" text badge at bottom-right

### 5. Update Chat Layout (lines 1358-1394)
**Current**: "Flying chat" with mask gradient on left side, `max-w-[75%]`, 220px height
**User's code**: Bottom-left chat area with colored user names, auto-scroll, simpler styling

### 6. Update Bottom Controls (lines 1552-1640)
**Current**: Mic toggle, chat input, gift button, camera toggle
**User's code**: Target selector pills, then chat input + send button + gift button (no explicit mic/camera toggles in bottom bar)

### 7. Update In-Stream Gift Modal (lines 1940-1996)
**Current**: 3-column grid, 5 gifts
**User's code**: 2x2 grid, 4 gifts (remove Crown gift from STREAM_GIFTS)

### 8. Update Empty PK Slot Text
**Current**: "Waiting..." + "Invite" button
**User's code**: Users icon + "Invite PK" button text

## Files to Modify
1. **`src/components/live/twitter-space/TwitterStreamRoom.tsx`** — Major UI refactor of the render section only. All hooks, state, LiveKit logic, Supabase integrations, chat, and gift RPCs stay exactly the same.

## What Stays the Same
- All LiveKit connection, track management, camera flip logic
- Supabase broadcast channel chat with optimistic updates
- Gift sending via `send_live_gift` RPC with 85/15 split
- PK Battle logic via `usePKBattle` hook
- All existing modals (report, rules, feedback, audio settings, share, full gift store)
- Floating reactions, gift animations
- FloatingStreamPlayer / minimize / PiP
- Guests view
- Chat sidebar
- Credit balance checks
- All state management and hooks

## Approach
Rewrite the return JSX (from line ~1177 onward) to match the user's reference code layout while keeping all existing event handlers and state. The settings menu becomes the access point for features removed from the main view (React, Share, Flip, Guests, Camera, Mic).

