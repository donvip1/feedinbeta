-- Fix the apply_credit_transaction trigger to handle initial inserts properly
-- and prevent negative balances from being created

DROP FUNCTION IF EXISTS apply_credit_transaction() CASCADE;

CREATE OR REPLACE FUNCTION apply_credit_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  -- Get current balance or 0 if user doesn't exist
  SELECT COALESCE(balance, 0) INTO current_balance
  FROM user_credits
  WHERE user_id = NEW.user_id;
  
  -- If this would make balance negative, prevent the transaction
  IF current_balance + NEW.amount < 0 THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %, attempted deduction: %', 
      current_balance, ABS(NEW.amount);
  END IF;
  
  -- Insert or update user_credits balance
  INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
  VALUES (
    NEW.user_id,
    GREATEST(0, NEW.amount), -- Ensure first balance is never negative
    CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance = GREATEST(0, user_credits.balance + NEW.amount), -- Ensure balance never goes negative
    total_earned = user_credits.total_earned + CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    total_spent = user_credits.total_spent + CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trg_apply_credit_transaction
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION apply_credit_transaction();