
-- 1. Drop the dangerous UPDATE policy that allows users to directly modify their credit balance
DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;

-- 2. Add a trigger to block any direct balance/total_earned/total_spent manipulation
-- Only the apply_credit_transaction trigger (SECURITY DEFINER) should modify these columns
CREATE OR REPLACE FUNCTION public.prevent_balance_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow changes from the apply_credit_transaction trigger context
  -- by checking if the caller is the trigger function (session replication role)
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

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS block_direct_balance_update ON public.user_credits;

CREATE TRIGGER block_direct_balance_update
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_balance_tampering();
