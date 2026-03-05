

# Plan: Update Video Livestream with New UI & Multi-Way PK Battles

## Summary
Integrate the user's provided UI code into the existing production livestream system. The new code introduces multi-way PK battles (2-way and 4-way), a dynamic grid/focus video layout, in-stream creator invitations, gift target selection, and enhanced score bars. All mock data/logic will be replaced with the real LiveKit, Supabase, and credit system integrations.

## What Changes

### 1. Update CreateLiveStreamModal -- Add Solo/2-Way PK/4-Way PK Mode Selector
- Replace the current 2-column grid (Video | PK Battle) with a 3-option selector: **Solo**, **2-Way PK**, **4-Way PK**
- Map to room_type values: `video_broadcast`, `pk_battle` (2-way), `pk_battle_4` (4-way)
- Use the user's pink-to-violet gradient "Start Broadcasting / Start PK Battle" button style
- Store `pk_max_slots` (2 or 4) in the `live_streams` table for PK modes

**File:** `src/components/live/CreateLiveStreamModal.tsx`

### 2. Database Migration -- Add pk_max_slots Column
- Add `pk_max_slots integer default 2` to `live_streams` table to support 4-way PK battles

### 3. Major Update to TwitterStreamRoom -- New PK Battle Video Engine
This is the core change. The `TwitterStreamRoom.tsx` will be updated to incorporate:

**a) Multi-participant video grid layout (PK mode)**
- When in PK mode, render a dynamic grid of participant video feeds (2 or 4 slots)
- Empty slots show "Waiting..." placeholder with invite button (host-only)
- Tap any feed to focus it (fullscreen) with other participants as mini overlays in bottom-right corner
- Tap again to return to grid view

**b) Participant tracking state**
- New `battleParticipants` state tracking each participant's LiveKit identity, score, color, and name
- Host is auto-added as first participant on PK room join
- New participants join via invite flow

**c) Interaction target selector**
- New bottom bar with "ALL" and per-participant name pills
- Controls which participant receives gifts
- Syncs with the existing `send_live_gift` RPC by passing the selected `receiver_id`

**d) In-stream invite modal**
- New modal listing online creators (fetched from `live_streams` or `profiles` with recent activity)
- "Invite" button sends a PK challenge via `usePKBattle.sendChallenge()`
- System message appears in chat when a creator joins

**e) Score bar update**
- Replace 2-way `PKBattleBar` with a multi-participant proportional bar
- Each participant gets a colored segment proportional to their score
- Timer display with `N-Way Battle` label
- Scores update in real-time from gift events (gift value adds to participant's score)

**f) Gift overlay animation**
- Full-screen animated gift notification showing sender, gift emoji, and receiver name
- 3-second auto-dismiss with scale/fade animation

**g) Gift modal with target awareness**
- New simplified in-stream gift modal showing "Sending to: [Target Name]"
- Uses the existing `send_live_gift` RPC with the selected target
- Gift costs aligned with existing QUICK_GIFTS values (10, 50, 100, 1000, 5000 credits)
- Credit balance check uses `user_credits` table
- 85/15 split handled by existing RPC

**Preserved from current code (not changed):**
- LiveKit connection, track management, camera flip with fallback
- Supabase broadcast channel chat with optimistic updates
- Broadcast channel reactions
- QuickGiftBar component integration
- Minimize/PiP via LiveStreamContext
- All existing modals (report, rules, feedback, audio settings, share)
- Host tag with avatar/crown/verified badge
- Flying chat with mask gradient
- Right-side action stack (React, Share, Flip, Guests, PK)

**File:** `src/components/live/twitter-space/TwitterStreamRoom.tsx`

### 4. Update PKBattleBar for Multi-Way Support
- Accept array of participants instead of just host/challenger
- Render proportional colored segments for each participant
- Show `N-Way Battle` label with timer

**File:** `src/components/live/unified/PKBattleBar.tsx`

### 5. Update PKBattleChallenge for Multi-Way
- Add `maxSlots` prop to indicate 2-way or 4-way
- Show slot count in UI

**File:** `src/components/live/unified/PKBattleChallenge.tsx`

### 6. Gift Integration Details
The user's code has mock gift sending. Here's how it maps to the real system:

| User's Code | Real System |
|---|---|
| `GIFTS` array with costs | Mapped to existing `QUICK_GIFTS` in QuickGiftBar + new in-stream modal |
| `handleSendGift(gift)` | Calls `supabase.rpc('send_live_gift', { p_stream_id, p_gift_type, p_credit_value })` |
| Gift overlay animation | Triggered by `live_stream_gifts` postgres_changes INSERT event |
| Score update on gift | Real-time via gift event listener updating participant scores |
| Credit balance | Fetched from `user_credits` table |
| Target selection | `interactionTargetId` maps to `receiver_id` in the RPC |

The 85/15 split, credit deduction, platform profit tracking, and gift_analytics recording all happen inside the existing `send_live_gift` RPC -- no changes needed there.

## Files to Modify
1. `src/components/live/CreateLiveStreamModal.tsx` -- Add 3-mode selector
2. `src/components/live/twitter-space/TwitterStreamRoom.tsx` -- Major UI update with PK grid, invite, target selector, gift overlay
3. `src/components/live/unified/PKBattleBar.tsx` -- Multi-participant support
4. `src/components/live/unified/PKBattleChallenge.tsx` -- Minor maxSlots update
5. **New migration** -- Add `pk_max_slots` to `live_streams`

## Not Changed
- Edge functions (livekit-token, pk-battle-manager)
- Credit RPCs (send_live_gift, send_space_gift)
- QuickGiftBar component
- LiveStreamContext / FloatingStreamPlayer
- LiveGiftModal
- usePKBattle hook
- Auth, subscription gating

