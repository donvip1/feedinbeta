

# Plan: Fix Credit Balance Constraint for Gift Sending

## Problem Summary

Users are getting "new row for relation 'user_credits' violates check constraint 'user_credits_balance_check'" when trying to send gifts. This happens because:

1. The `send_gift` function checks balance from `credit_transactions` table
2. But when inserting into `credit_transactions`, a trigger (`apply_credit_transaction`) updates `user_credits`
3. The trigger has a bug: when inserting for a **new user** who doesn't exist in `user_credits`, it sets `balance = NEW.amount`
4. If `NEW.amount` is negative (gift deduction), it tries to insert `balance = -10`, violating `CHECK (balance >= 0)`

## Root Cause Analysis

```text
┌─────────────────────────────────────────────────────────────────────┐
│  send_gift RPC Function                                             │
│  ───────────────────────                                            │
│  1. Checks: SUM(credit_transactions) → e.g., returns 500            │
│  2. Validates: 500 >= 10 (gift cost) → PASS                         │
│  3. Inserts: credit_transactions (amount = -10)                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  apply_credit_transaction TRIGGER                                   │
│  ────────────────────────────────                                   │
│  Problem Code:                                                      │
│                                                                     │
│  INSERT INTO user_credits (balance = NEW.amount)  ← -10!            │
│  ON CONFLICT DO UPDATE SET balance = balance + NEW.amount           │
│                                                                     │
│  For NEW users: balance = -10 → VIOLATES CHECK (balance >= 0)       │
│  For EXISTING users: balance = 500 + (-10) = 490 → OK               │
└─────────────────────────────────────────────────────────────────────┘
```

## Solution

Update the `apply_credit_transaction` trigger function to:

1. **Prevent new users from having negative initial balance** - If user doesn't exist in `user_credits` and the transaction is negative, reject it
2. **Better validation** - Use `user_credits.balance` as the source of truth, not just for trigger validation

### Updated Trigger Function

```sql
CREATE OR REPLACE FUNCTION public.apply_credit_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance INTEGER;
  user_exists BOOLEAN;
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
  
  -- Validate: prevent balance from going negative
  IF current_balance + NEW.amount < 0 THEN
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
      RAISE EXCEPTION 'Cannot deduct credits from user with no credit record. User needs initial credits first.';
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

### Also Update send_gift Function

The `send_gift` function should check `user_credits.balance` instead of summing `credit_transactions`:

```sql
-- Change from:
SELECT COALESCE(SUM(amount), 0) INTO v_sender_balance 
FROM credit_transactions WHERE user_id = v_sender_id;

-- To:
SELECT COALESCE(balance, 0) INTO v_sender_balance 
FROM user_credits WHERE user_id = v_sender_id;
```

## Files to Modify

| Change | Description |
|--------|-------------|
| Database Migration | Update `apply_credit_transaction` trigger function to properly handle new users |
| Database Migration | Update `send_gift` function to check `user_credits.balance` instead of summing transactions |
| Database Migration | Update `send_direct_gift` function with same fix |

## Data Sync Fix

Additionally, we should sync existing data where `user_credits.balance` doesn't match `credit_transactions` sum:

```sql
-- Sync balances for users where they differ
UPDATE user_credits uc
SET balance = COALESCE((
  SELECT SUM(amount) FROM credit_transactions ct WHERE ct.user_id = uc.user_id
), 0)
WHERE balance != COALESCE((
  SELECT SUM(amount) FROM credit_transactions ct WHERE ct.user_id = uc.user_id
), 0)
AND NOT is_admin_minted; -- Don't touch admin accounts
```

## Summary

1. **Fix trigger function** - Properly handle new users trying to make negative transactions
2. **Fix send_gift/send_direct_gift** - Check `user_credits.balance` instead of summing transactions
3. **Sync existing data** - Ensure `user_credits.balance` matches `credit_transactions` totals
4. **Preserve admin bypass** - Admin accounts with `is_admin_minted = true` keep unlimited credits

