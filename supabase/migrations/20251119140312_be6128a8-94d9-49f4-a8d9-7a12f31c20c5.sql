-- Remove the insecure policy that allows users to insert their own credit transactions
DROP POLICY IF EXISTS "Users can insert their own credit transactions" ON public.credit_transactions;

-- Add a secure policy that only allows inserts through SECURITY DEFINER functions or edge functions
-- This effectively blocks all direct user inserts while allowing backend functions to work
CREATE POLICY "Only backend functions can insert transactions"
ON public.credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Note: All credit operations must now go through validated edge functions like:
-- - credit-deduction (for spending credits)
-- - stripe-webhook (for purchasing credits)
-- - p2p-escrow (for P2P transfers)
-- - admin_grant_credits() function (for admin operations)
-- These functions bypass RLS using SECURITY DEFINER or service role keys with proper validation