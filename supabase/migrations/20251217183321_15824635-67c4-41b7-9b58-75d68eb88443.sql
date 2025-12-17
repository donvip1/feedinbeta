-- Remove direct UPDATE policy on user_credits that allows balance manipulation
-- All balance changes must go through credit_transactions table with the apply_credit_transaction trigger

DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;

-- Ensure only system/triggers can modify user_credits (via credit_transactions)
-- The apply_credit_transaction trigger handles all balance updates

COMMENT ON TABLE public.user_credits IS 
'User credit balances. Direct modifications are blocked - all changes must go through credit_transactions table which triggers apply_credit_transaction to update balances securely.';