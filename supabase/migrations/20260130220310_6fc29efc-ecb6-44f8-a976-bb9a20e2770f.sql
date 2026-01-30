-- Step 1: Add the missing last_gift_sent_at column to user_credits
ALTER TABLE user_credits 
ADD COLUMN IF NOT EXISTS last_gift_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Step 2: Fix the apply_credit_transaction trigger to properly validate balances
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

-- Step 3: Sync balances for non-admin users to match their transaction history
UPDATE user_credits uc
SET balance = GREATEST(0, COALESCE((
  SELECT SUM(amount) FROM credit_transactions ct WHERE ct.user_id = uc.user_id
), 0)),
updated_at = now()
WHERE (is_admin_minted IS NULL OR is_admin_minted = false);