

# Plan: Fix 5 Issues in Live Space Room and Admin Wallet

## Issues Identified

1. **Transfer "Review Transfer" button not working** -- The button at line 1656 has proper `disabled` logic (`!selectedUser || !transferAmount || parseInt(transferAmount) <= 0`), but `selectedUser` is typed as `any` and may not be persisting correctly. The `onClick={() => setShowConfirmation(true)}` should work. Need to verify the button is not covered by another element or if `canManageCredits` gate is blocking the tab content.

2. **Settings icon: change 3-dot (MoreHorizontal) to Settings icon and move away from HD Audio** -- At line 1475-1480, the settings button uses `MoreHorizontal` and is positioned right next to the "HD Audio" badge. Change to `Settings` icon and move it to the right side header group.

3. **Screen sharing not working** -- The `publishScreenShare` in SpaceContext uses LiveKit track publishing. The function exists and the flow looks correct. The issue is likely that the room connection state check at line 884 (`spaceContext?.room?.state !== 'connected'`) is failing because the room object may not be exposed. Need to verify SpaceContext exposes `room`.

4. **Gift animations only showing for sender** -- The gift channel at line 368-455 listens to `postgres_changes` on `live_space_gifts` table. This is database-driven, so it should work for all participants. However, the INSERT event from the `send_space_gift` RPC might not trigger realtime because the `live_space_gifts` table may not be added to `supabase_realtime` publication. Additionally, there's no broadcast mechanism -- gifts rely purely on postgres_changes which can have latency. Need to add a broadcast channel for instant gift display.

5. **Remove duplicate gift count under "Hosted by"** -- At lines 1620-1625, there's a gift count badge under the host name. Remove it since the SpaceWalletBoard at line 1592 already shows gift counts.

## Technical Plan

### Task 1: Fix Transfer Review Button
- Investigate whether `selectedUser` is `null` when the button is clicked. The `disabled` prop checks `!selectedUser` -- the issue may be that `selectedUser` loses its value. Check if `canManageCredits` is properly returning `true` for the logged-in role.
- The button code at line 1655-1662 looks correct syntactically. The most likely issue is the `canManageCredits` permission check not returning `true` for the user, meaning the Transfer tab content isn't rendering at all or is read-only. Will verify the `can_manage_credits` RPC includes `developer` role.

### Task 2: Change Settings Icon and Reposition
- In `TwitterSpaceRoom.tsx` line 1475-1480: Change `MoreHorizontal` to `Settings` icon
- Move the settings button from the left header group (next to HD Audio) to the right header group (before the End/Leave button)

### Task 3: Fix Screen Sharing
- Check if `live_space_speakers` RLS allows updates for screen share state
- Verify `SpaceContext.publishScreenShare` works with current LiveKit room state
- The screen share function at line 875-913 checks `spaceContext?.room` which should be available. May need to add a database migration to ensure RLS on any screen-share-related tables permits the operation, or check if the LiveKit token has screen share permissions.

### Task 4: Fix Gift Realtime for All Participants
- Add `live_space_gifts` to `supabase_realtime` publication so postgres_changes work for all
- Add a Supabase broadcast event in `LiveGiftModal.tsx` after successful gift send, so gifts appear instantly for all participants without waiting for database propagation
- In `TwitterSpaceRoom.tsx`, add a broadcast listener on the gift channel for immediate display

### Task 5: Remove Duplicate Gift Count
- Remove lines 1620-1626 in `TwitterSpaceRoom.tsx` (the `hostGiftTotal` badge under "Hosted by")

## Files to Modify

1. **`src/pages/AdminWallet.tsx`** -- Debug/fix the Review Transfer button disabled state
2. **`src/components/live/twitter-space/TwitterSpaceRoom.tsx`** -- Move settings icon, fix gift broadcast, remove duplicate gift count
3. **`src/components/live/LiveGiftModal.tsx`** -- Add broadcast event after gift send
4. **`src/components/live/shared/QuickGiftBar.tsx`** -- Add broadcast event after gift send
5. **`src/components/live/shared/HostGiftPanel.tsx`** -- Add broadcast event after gift send
6. **Database migration** -- Add `live_space_gifts` to realtime publication; verify `can_manage_credits` RPC includes `developer` role

