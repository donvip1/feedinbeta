

# Plan: Fix Missing `last_gift_sent_at` Column for Gift Sending

## Problem Identified

The gift sending is failing for ALL users (not just those with insufficient credits) because:

**Error**: `column "last_gift_sent_at" does not exist`

The previous migration created `send_gift` and `send_direct_gift` functions that reference a `last_gift_sent_at` column in the `user_credits` table for rate limiting, but this column was never created.

## Root Cause

```text
┌─────────────────────────────────────────────────────────────────────┐
│  send_gift / send_direct_gift Functions                             │
│  ─────────────────────────────────────                              │
│  Line 36-38:                                                        │
│    SELECT last_gift_sent_at INTO v_last_gift_at                     │
│    FROM user_credits WHERE user_id = v_sender_id;                   │
│                                                                     │
│  Line 89:                                                           │
│    UPDATE user_credits SET last_gift_sent_at = now() ...            │
│                                                                     │
│  ❌ FAILS: Column does not exist!                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Solution

Create a database migration that:

1. **Adds the missing column** - Add `last_gift_sent_at` column to `user_credits` table
2. **Ensures correct trigger logic** - The `apply_credit_transaction` trigger should properly validate balances before allowing deductions
3. **Fix data sync** - Ensure user balances are properly synced

## Database Changes

### Step 1: Add Missing Column

```sql
-- Add the missing last_gift_sent_at column
ALTER TABLE user_credits 
ADD COLUMN IF NOT EXISTS last_gift_sent_at TIMESTAMPTZ DEFAULT NULL;
```

### Step 2: Fix the apply_credit_transaction Trigger

The current trigger has a logic bug - it checks balance BEFORE the insert, but then proceeds to INSERT ON CONFLICT which can still try to insert a negative value. We need to fix this:

```sql
CREATE OR REPLACE FUNCTION public.apply_credit_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance INTEGER;
  user_exists BOOLEAN := false;
BEGIN
  -- Check if user exists in user_credits and get their balance
  SELECT balance, true INTO current_balance, user_exists
  FROM user_credits
  WHERE user_id = NEW.user_id;
  
  -- If user doesn't exist, they start with 0 balance
  IF NOT FOUND THEN
    current_balance := 0;
    user_exists := false;
  END IF;
  
  -- Validate: prevent balance from going negative (for deductions)
  IF NEW.amount < 0 AND current_balance + NEW.amount < 0 THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %, attempted deduction: %', 
      current_balance, ABS(NEW.amount);
  END IF;
  
  -- Handle insert/update based on user existence
  IF user_exists THEN
    -- User exists, just update their balance
    UPDATE user_credits SET
      balance = balance + NEW.amount,
      total_earned = total_earned + CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
      total_spent = total_spent + CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSE
    -- New user - only allow positive initial balance
    IF NEW.amount < 0 THEN
      RAISE EXCEPTION 'Cannot deduct credits from user with no credit record';
    END IF;
    
    INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
    VALUES (
      NEW.user_id,
      NEW.amount,
      NEW.amount,
      0
    );
  END IF;

  RETURN NEW;
END;
$function$;
```

### Step 3: Sync User Balances

Ensure all non-admin users have correct balances synced from their transaction history:

```sql
-- Sync balances for non-admin users
UPDATE user_credits uc
SET balance = GREATEST(0, COALESCE((
  SELECT SUM(amount) FROM credit_transactions ct WHERE ct.user_id = uc.user_id
), 0)),
updated_at = now()
WHERE (is_admin_minted IS NULL OR is_admin_minted = false);
```

## Files to Modify

| Change | Description |
|--------|-------------|
| Database Migration | Add `last_gift_sent_at` column to `user_credits` table |
| Database Migration | Fix `apply_credit_transaction` trigger to properly check balance before inserting |
| Database Migration | Sync user balances |

## Frontend Updates (Optional)

The `ChatGiftButton.tsx` currently fetches credits from `credit_transactions` table (summing them up) instead of reading from `user_credits.balance`. This should be updated to use the source of truth:

```tsx
// Current (incorrect):
const { data, error } = await supabase
  .from('credit_transactions')
  .select('amount')
  .eq('user_id', user.id);
const total = data.reduce((sum, t) => sum + t.amount, 0);

// Should be:
const { data, error } = await supabase
  .from('user_credits')
  .select('balance')
  .eq('user_id', user.id)
  .single();
const total = data?.balance || 0;
```

## Summary

1. **Add missing column** - `last_gift_sent_at` to enable rate limiting
2. **Fix trigger logic** - Properly validate balance BEFORE allowing any operations
3. **Sync balances** - Ensure `user_credits.balance` matches transaction history
4. **Update frontend** - Read balance from `user_credits.balance` (source of truth)

