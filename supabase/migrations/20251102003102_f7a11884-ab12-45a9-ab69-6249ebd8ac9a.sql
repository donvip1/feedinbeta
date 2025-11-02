-- Update RLS policy to allow users to insert their own credit transactions
DROP POLICY IF EXISTS "Only system can insert credit transactions" ON public.credit_transactions;

CREATE POLICY "Users can insert their own credit transactions"
ON public.credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);