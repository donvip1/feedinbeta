-- Recreate admin_transfer_to_user to use direct role text check (bypasses enum issues)
CREATE OR REPLACE FUNCTION public.admin_transfer_to_user(p_user_id uuid, p_amount bigint, p_reason text DEFAULT 'Admin transfer')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  platform_balance BIGINT;
  result JSON;
  caller_role TEXT;
BEGIN
  -- Get caller's role
  SELECT role INTO caller_role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  
  -- STRICT: Only super_admin, developer, or admin can transfer
  IF caller_role IS NULL OR caller_role NOT IN ('super_admin', 'developer', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Only authorized admins can transfer credits';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Check platform wallet balance
  SELECT balance INTO platform_balance FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  IF platform_balance IS NULL OR platform_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  -- Deduct from platform wallet
  UPDATE platform_wallet
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Add credits to user's balance
  INSERT INTO user_credits (user_id, balance, total_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE 
  SET balance = user_credits.balance + p_amount,
      total_earned = user_credits.total_earned + p_amount;

  -- Record transaction for recipient
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'admin_transfer', p_amount, p_reason);

  -- Record platform transaction
  INSERT INTO platform_transactions (transaction_type, amount, to_user_id, performed_by, description)
  VALUES ('transfer', p_amount, p_user_id, auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'transferred', p_amount,
    'to_user', p_user_id
  ) INTO result;

  RETURN result;
END;
$$;

-- Fix platform_transactions RLS to use direct role check instead of has_role with enum cast
DROP POLICY IF EXISTS "Admins can view platform transactions" ON public.platform_transactions;
DROP POLICY IF EXISTS "Admins can insert platform transactions" ON public.platform_transactions;

CREATE POLICY "Admins can view platform transactions" ON public.platform_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'developer', 'admin')
    )
  );

CREATE POLICY "Admins can insert platform transactions" ON public.platform_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'developer', 'admin')
    )
  );