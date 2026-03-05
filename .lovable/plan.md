

## Problem Analysis

There are **three distinct issues** with the live space gift system:

### Issue 1: `send_live_gift` RPC only works for streams, not spaces
The `send_live_gift` database function looks up the receiver from `live_streams` table (`SELECT user_id FROM live_streams WHERE id = p_stream_id`). When QuickGiftBar passes a **space ID**, it finds no matching stream and returns "Stream not found". This is why gifts don't go through.

### Issue 2: LiveGiftModal and HostGiftPanel bypass the secure RPC
These two components do **manual client-side inserts** into `credit_transactions` instead of using the `send_live_gift` RPC. This means:
- No atomic balance updates on `user_credits` table (credits are never actually deducted/added)
- The `credit_transactions` inserts may create records but the actual `balance` column on `user_credits` is never updated
- No rate limiting or validation

### Issue 3: No SpaceWalletBoard in TwitterSpaceRoom
The `TwitterSpaceRoom` (the active space room component) doesn't render `SpaceWalletBoard` — only the older `LiveSpaceRoom` does. So no gift/credit wallet is visible.

---

## Plan

### 1. Create a `send_space_gift` database function (migration)
A new `SECURITY DEFINER` function specifically for spaces that:
- Looks up the space host from `live_spaces` table (or accepts a `p_receiver_id` parameter for gifting speakers/listeners)
- Atomically deducts sender balance, adds to receiver (85/15 split)
- Inserts into `live_space_gifts`, `credit_transactions`, `gift_analytics`, `profits_transactions`
- Has rate limiting and validation matching `send_live_gift`

### 2. Update QuickGiftBar to call the correct RPC
- When `isSpace=true`, call `send_space_gift` instead of `send_live_gift`
- Pass the `roomId` as `p_space_id`

### 3. Update LiveGiftModal to use secure RPCs
- Replace the manual client-side `credit_transactions` inserts with calls to `send_space_gift` (for spaces) or `send_live_gift` (for streams)
- This ensures atomic balance updates

### 4. Update HostGiftPanel to use secure RPCs
- Same fix — replace manual inserts with RPC calls
- Since hosts gift specific viewers (not just the stream owner), the `send_space_gift` function will accept an optional `p_receiver_id` parameter

### 5. Add SpaceWalletBoard to TwitterSpaceRoom
- Import and render `SpaceWalletBoard` with `variant="bar"` in the TwitterSpaceRoom component, visible to all participants

### Files to modify:
1. **New migration** — `send_space_gift` function
2. **`src/components/live/shared/QuickGiftBar.tsx`** — Use correct RPC based on `isSpace`
3. **`src/components/live/LiveGiftModal.tsx`** — Replace manual inserts with RPC calls
4. **`src/components/live/shared/HostGiftPanel.tsx`** — Replace manual inserts with RPC calls
5. **`src/components/live/twitter-space/TwitterSpaceRoom.tsx`** — Add SpaceWalletBoard

