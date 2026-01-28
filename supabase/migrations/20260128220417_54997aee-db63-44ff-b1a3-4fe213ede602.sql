
-- Fix the apply_credit_transaction trigger to prevent double-counting
-- The trigger should ONLY update user_credits when inserting transactions
-- It should NOT insert if we're doing a direct insert into user_credits

CREATE OR REPLACE FUNCTION public.apply_credit_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Update existing user_credits if exists, otherwise insert new record
  -- Uses a single INSERT ON CONFLICT to handle both cases atomically
  INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
  VALUES (
    NEW.user_id,
    NEW.amount, -- First balance is the transaction amount
    CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance = user_credits.balance + NEW.amount,
    total_earned = user_credits.total_earned + CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    total_spent = user_credits.total_spent + CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END,
    updated_at = now();

  RETURN NEW;
END;
$function$;
