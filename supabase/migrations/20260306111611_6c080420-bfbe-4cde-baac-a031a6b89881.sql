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
BEGIN
  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  AND role IN ('super_admin', 'developer', 'admin')
  LIMIT 1;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Only Super Admin, Developer and Admin can transfer credits';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO platform_bal FROM public.platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';
  IF platform_bal IS NULL OR platform_bal < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  -- Deduct from platform wallet
  UPDATE public.platform_wallet 
  SET balance = balance - p_amount, updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Ensure user_credits row exists
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into credit_transactions — the apply_credit_transaction trigger will update the balance
  INSERT INTO public.credit_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, p_amount, 'admin_transfer', p_reason, auth.uid()::text);

  -- Log platform transaction
  INSERT INTO public.platform_transactions (type, amount, from_wallet, to_user_id, description, performed_by)
  VALUES ('transfer', p_amount, 'platform', p_user_id, p_reason, auth.uid());

  RETURN json_build_object('success', true, 'transferred', p_amount);
END;
$$;