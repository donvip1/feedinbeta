-- Fix apply_credit_transaction to set a session flag before updating user_credits
CREATE OR REPLACE FUNCTION public.apply_credit_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  user_exists BOOLEAN := false;
BEGIN
  SELECT balance, true INTO current_balance, user_exists
  FROM user_credits
  WHERE user_id = NEW.user_id;
  
  IF NOT FOUND THEN
    current_balance := 0;
    user_exists := false;
  END IF;
  
  IF NEW.amount < 0 AND current_balance + NEW.amount < 0 THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %, attempted deduction: %', 
      current_balance, ABS(NEW.amount);
  END IF;
  
  -- Set session flag so prevent_balance_tampering allows this update
  PERFORM set_config('app.applying_transaction', 'true', true);
  
  IF user_exists THEN
    UPDATE user_credits SET
      balance = balance + NEW.amount,
      total_earned = total_earned + CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
      total_spent = total_spent + CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSE
    IF NEW.amount < 0 THEN
      RAISE EXCEPTION 'Cannot deduct credits from user with no credit record';
    END IF;
    
    INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
    VALUES (NEW.user_id, NEW.amount, NEW.amount, 0);
  END IF;

  -- Clear the flag
  PERFORM set_config('app.applying_transaction', '', true);

  RETURN NEW;
END;
$$;

-- Fix prevent_balance_tampering to respect the session flag
CREATE OR REPLACE FUNCTION public.prevent_balance_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow updates from apply_credit_transaction (flag is set)
  IF current_setting('app.applying_transaction', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Block direct balance manipulation by authenticated users
  IF current_setting('role') = 'authenticated' THEN
    IF OLD.balance IS DISTINCT FROM NEW.balance OR
       OLD.total_earned IS DISTINCT FROM NEW.total_earned OR
       OLD.total_spent IS DISTINCT FROM NEW.total_spent THEN
      RAISE EXCEPTION 'Direct modification of credit balances is not allowed. Use credit_transactions.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;