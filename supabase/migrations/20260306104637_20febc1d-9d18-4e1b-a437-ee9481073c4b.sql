-- Restrict admin_transfer_to_user to super_admin and developer ONLY
CREATE OR REPLACE FUNCTION public.admin_transfer_to_user(
  p_user_id uuid,
  p_amount integer,
  p_reason text DEFAULT 'Admin transfer'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  platform_bal integer;
  result json;
BEGIN
  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  AND role IN ('super_admin', 'developer')
  LIMIT 1;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Only Super Admin and Developer can transfer credits';
  END IF;

  SELECT balance INTO platform_bal FROM public.platform_wallet LIMIT 1;
  IF platform_bal IS NULL OR platform_bal < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.platform_wallet SET balance = balance - p_amount, updated_at = now();

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + p_amount;

  INSERT INTO public.platform_transactions (type, amount, from_wallet, to_user_id, description, performed_by)
  VALUES ('transfer', p_amount, 'platform', p_user_id, p_reason, auth.uid());

  INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, p_amount, 'admin_transfer', p_reason, auth.uid()::text);

  result := json_build_object('success', true, 'transferred', p_amount);
  RETURN result;
END;
$$;

DROP POLICY IF EXISTS "Admins can insert platform transactions" ON public.platform_transactions;
CREATE POLICY "Admins can insert platform transactions" ON public.platform_transactions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'developer')
  )
);

DROP POLICY IF EXISTS "Admins can view platform transactions" ON public.platform_transactions;
CREATE POLICY "Admins can view platform transactions" ON public.platform_transactions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'developer', 'admin', 'moderator')
  )
);