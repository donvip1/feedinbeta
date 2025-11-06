-- Fix RLS violation by making trigger function SECURITY DEFINER
-- and adding missing RLS policies for user_credits

-- Drop and recreate the trigger function with SECURITY DEFINER
DROP FUNCTION IF EXISTS apply_credit_transaction() CASCADE;

CREATE OR REPLACE FUNCTION apply_credit_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS
SET search_path = public
AS $$
BEGIN
  -- Insert or update user_credits balance
  INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
  VALUES (
    NEW.user_id,
    NEW.amount,
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
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_apply_credit_transaction ON credit_transactions;
CREATE TRIGGER trg_apply_credit_transaction
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION apply_credit_transaction();

-- Add INSERT policy for user_credits (for initial user setup)
CREATE POLICY "Users can initialize their own credits"
ON user_credits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for user_credits (in case direct updates are needed)
CREATE POLICY "System can update credits"
ON user_credits
FOR UPDATE
TO authenticated
USING (true)  -- Allow authenticated users to see rows
WITH CHECK (auth.uid() = user_id);  -- But only update their own