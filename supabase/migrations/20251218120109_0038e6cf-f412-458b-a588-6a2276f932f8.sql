-- Add admin access policy to profile_sensitive_data
-- Admins can view all sensitive data for support purposes

CREATE POLICY "Admins can view all sensitive data"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure payment_history is fully protected from user modifications
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies that might allow modifications
DROP POLICY IF EXISTS "Users can update payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Users can delete payment history" ON public.payment_history;

-- Explicitly deny all user modifications to payment_history
CREATE POLICY "No user updates to payment history"
ON public.payment_history
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No user deletes from payment history"
ON public.payment_history
FOR DELETE
TO authenticated
USING (false);

-- Allow admins to view payment history for support
DROP POLICY IF EXISTS "Admins can view all payment history" ON public.payment_history;
CREATE POLICY "Admins can view all payment history"
ON public.payment_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);