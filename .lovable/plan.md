
# Implementation Plan: Full Ghost Engine Feature Integration

## Overview
This plan integrates all features from the reference code into the existing livestream system, enhancing the UI/UX for chat, gifts, reactions, and engagement features while maintaining the existing LiveKit-based architecture.

## Features to Implement/Enhance

### 1. Floating Reactions System (CSS-based)
**Current State**: The `FloatingReactionsSimple` component exists inline in `UnifiedLiveRoom.tsx` but lacks consistency.
**Changes**:
- Consolidate the CSS-based floating animation into a standalone component
- Ensure the animation matches the reference exactly: cubic-bezier easing, proper scaling, and opacity transitions
- Support dynamic emoji icons from both reactions and gifts

### 2. Gift Modal Enhancement
**Current State**: `QuickGiftBar.tsx` has the gift grid but needs better visual feedback and the modal is separate from the room.
**Changes**:
- Add animated emoji scaling on hover (pulse effect)
- Ensure gift selection triggers the floating reaction with the gift's emoji
- Verify credit balance display and "Insufficient Credits" alert
- Add "Top-up Credits" button with navigation to wallet

### 3. Chat System Improvements
**Current State**: `FlyingChat.tsx` has plain overlay style with bold text and shadows.
**Changes**:
- Add broadcast message styling (highlighted messages from host with megaphone icon)
- Add gift message styling in chat (with gift emoji and credit value)
- Ensure scrollable chat with proper overflow handling

### 4. Right-Side Action Buttons
**Current State**: Action buttons exist but need better organization matching reference.
**Changes**:
- Add animated bounce effect to the Gift button (like reference)
- Add gradient background to gift button (`from-yellow-400 to-orange-500`)
- Add share action button with proper icon

### 5. PK Battle Bar Enhancement
**Current State**: `PKBattleBar.tsx` exists with basic functionality.
**Changes**:
- Add timer display in center
- Add animated HP/score bars with smooth transitions
- Match the dual-team gradient styling (blue vs red)

### 6. Participant Management
**Current State**: `ParticipantsList.tsx` has moderation features.
**Changes**:
- Add hard mute indicator (lock icon for host-muted users)
- Add "Mute All" and "Invite" quick actions in header
- Show role badges (Host, Co-Host, Speaker, Listener)

### 7. Footer Control Bar
**Current State**: `LiveControlBar.tsx` and `BroadcastInput.tsx` are separate.
**Changes**:
- Integrate broadcast mode toggle button directly with input
- Add mic/camera toggle buttons inline with footer
- Add PK Battle trigger button for hosts (video broadcast only)

## Technical Implementation

### Files to Modify:

1. **`src/components/live/UnifiedLiveRoom.tsx`**
   - Integrate inline `FloatingReactionsSimple` with gift emoji support
   - Add right-side action buttons with proper styling
   - Update footer layout to match reference

2. **`src/components/live/shared/QuickGiftBar.tsx`**
   - Already updated with proper styling
   - Verify integration with credit system

3. **`src/components/live/FlyingChat.tsx`**
   - Add broadcast message styling (red highlight with megaphone)
   - Add gift message styling (gradient background)
   - Ensure proper `is_broadcast` and `is_gift` message types

4. **`src/components/live/shared/BroadcastInput.tsx`**
   - Add inline mic toggle button
   - Add PK Battle button for hosts

5. **`src/components/live/shared/LiveControlBar.tsx`**
   - Simplify to focus on core controls
   - Add screen share toggle for hosts

6. **`src/components/live/unified/PKBattleBar.tsx`**
   - Add timer display with countdown
   - Enhance gradient animations

### New Components:
- None needed - all functionality can be added to existing components

### Database Integration:
- Credit transactions already handled via `credit_transactions` table
- Gift records stored in `live_stream_gifts` and `live_space_gifts` tables
- Notifications triggered on gift receipt

## Implementation Steps

### Step 1: Enhance Floating Reactions
- Update `FloatingReactionsSimple` in `UnifiedLiveRoom.tsx`
- Ensure CSS keyframes are properly scoped
- Add support for any emoji icon

### Step 2: Update Chat Styling
- Modify `FlyingChat.tsx` to render broadcast messages with red highlight
- Add gift messages with gradient styling and credit display
- Add proper message type detection

### Step 3: Enhance Right-Side Actions
- Update action buttons in `UnifiedLiveRoom.tsx`
- Add animated bounce effect to gift button
- Add gradient styling

### Step 4: Update Footer Controls
- Integrate inline controls in footer area
- Add PK Battle button for hosts
- Ensure broadcast mode toggle is visible

### Step 5: Verify Gift Flow
- Test gift sending triggers floating animation
- Verify credit deduction and balance update
- Ensure gift appears in chat as styled message

## Credit System Integration
The existing system handles:
- Credit balance fetching from `credit_transactions`
- Deduction on gift send (sender loses credits)
- Addition on gift receive (85% to recipient, 15% platform fee)
- Admin/developer bypass for unlimited credits

## Testing Considerations
- Verify floating reactions appear on double-tap
- Verify gift emoji floats when sent
- Verify broadcast messages have special styling
- Verify credit balance updates in real-time
- Verify PK Battle mode transitions work
