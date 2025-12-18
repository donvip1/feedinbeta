
-- Fix get_user_credits to use correct column name (balance)
CREATE OR REPLACE FUNCTION public.get_user_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_unlimited BOOLEAN;
  actual_credits INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  ) INTO is_unlimited;
  
  IF is_unlimited THEN
    RETURN 999999999;
  END IF;
  
  SELECT balance INTO actual_credits
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(actual_credits, 0);
END;
$$;

-- Fix deduct_credits_safe to use correct column name
CREATE OR REPLACE FUNCTION public.deduct_credits_safe(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  is_unlimited BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  ) INTO is_unlimited;
  
  IF is_unlimited THEN
    RETURN TRUE;
  END IF;
  
  SELECT balance INTO current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.user_credits
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'deduction', COALESCE(p_description, 'Feature usage'));
  
  RETURN TRUE;
END;
$$;
