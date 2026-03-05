

## Plan: Fix Live Space Gift Credit Flow + Add Host Gift Counter

### Problem 1: Credits Not Updating (Root Cause)

The `prevent_balance_tampering` trigger (added in the recent security fix) checks `current_setting('role') = 'authenticated'` to block direct balance updates. However, the `apply_credit_transaction` trigger (SECURITY DEFINER) also runs within the same session context where `role = 'authenticated'`. This means the tampering trigger **blocks the legitimate balance updates** triggered by inserting into `credit_transactions`.

Result: transaction records are created, but `user_credits.balance` never changes for either sender or recipient.

**Fix**: Modify `prevent_balance_tampering` to allow updates originating from the `apply_credit_transaction` function by using a session-level configuration variable as a flag. The `apply_credit_transaction` function sets a flag (`SET LOCAL app.applying_transaction = 'true'`) before updating, and `prevent_balance_tampering` checks for this flag before blocking.

**Database migration**:
1. Update `apply_credit_transaction` to set `SET LOCAL app.applying_transaction = 'true'` before the UPDATE statement
2. Update `prevent_balance_tampering` to check `current_setting('app.applying_transaction', true) = 'true'` and allow the update if the flag is set

### Problem 2: HostGiftPanel Uses Wrong Transaction Types

The panel uses `gift_sent`/`gift_received` but for live space gifts it should use `live_gift_sent`/`live_gift_received` to match the constraint and provide proper categorization in transaction history.

**File**: `src/components/live/shared/HostGiftPanel.tsx`
- Change sender transaction type from `'gift_sent'` to `'live_gift_sent'`
- Change recipient transaction type from `'gift_received'` to `'live_gift_received'`

### Problem 3: Gift Value Counter for Host

Add a "Gifts: X" display below the host description in `TwitterSpaceRoom.tsx` showing the total credit value of gifts received by the host in the current space.

**File**: `src/components/live/twitter-space/TwitterSpaceRoom.tsx`
- Add state `hostGiftTotal` initialized to 0
- Query `live_space_gifts` on mount for gifts where `receiver_id = host user_id` and sum `credit_value`
- Subscribe to realtime inserts on `live_space_gifts` to increment the counter live
- Render `🎁 Gifts: {hostGiftTotal.toLocaleString()}` below the "Hosted by..." line (around line 1464), styled as a small amber badge

---

### Technical Details

**Migration SQL** (single migration):
```sql
-- Fix apply_credit_transaction to set a session flag
CREATE OR REPLACE FUNCTION public.apply_credit_transaction() ...
  SET LOCAL app.applying_transaction = 'true';
  -- then do the UPDATE
  SET LOCAL app.applying_transaction = '';
  
-- Fix prevent_balance_tampering to respect the flag  
CREATE OR REPLACE FUNCTION public.prevent_balance_tampering() ...
  IF current_setting('app.applying_transaction', true) = 'true' THEN
    RETURN NEW; -- allow trigger-based updates
  END IF;
  -- then block authenticated direct updates
```

**Files to modify**:
1. Database migration (new) -- fix both trigger functions
2. `src/components/live/shared/HostGiftPanel.tsx` -- use `live_gift_sent`/`live_gift_received` types
3. `src/components/live/twitter-space/TwitterSpaceRoom.tsx` -- add host gift counter UI + realtime subscription

