
-- Assign admin roles to super admins (full access including credit operations)
-- These users can mint, transfer, withdraw credits
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE p.username IN ('tester1')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::app_role
FROM auth.users au
WHERE au.email IN ('cryptosvip@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Assign moderator roles (can view wallet, delete users, but cannot manage credits)
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'moderator'::app_role
FROM auth.users au
WHERE au.email IN ('robinsonwealth1@gmail.com', 'baileyviinig@gmail.com', 'gemjiffy@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Update admin functions to ONLY allow 'admin' role (not moderator) for credit operations

-- Mint credits - admin only
CREATE OR REPLACE FUNCTION public.admin_mint_credits(p_amount integer, p_reason text DEFAULT 'Admin mint')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_supply RECORD;
  result JSON;
BEGIN
  -- STRICT: Only admin role can mint (not moderator)
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only super admins can mint credits';
  END IF;

  SELECT * INTO current_supply FROM credit_supply WHERE id = '00000000-0000-0000-0000-000000000002';

  IF (current_supply.circulating_supply + p_amount) > current_supply.total_supply THEN
    RAISE EXCEPTION 'Cannot mint: would exceed total supply of %', current_supply.total_supply;
  END IF;

  UPDATE credit_supply
  SET circulating_supply = circulating_supply + p_amount,
      last_mint_at = now(),
      last_mint_by = auth.uid(),
      last_mint_amount = p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';

  UPDATE platform_wallet
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  INSERT INTO platform_transactions (transaction_type, amount, performed_by, description)
  VALUES ('mint', p_amount, auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'minted', p_amount,
    'new_circulating_supply', current_supply.circulating_supply + p_amount
  ) INTO result;

  RETURN result;
END;
$function$;

-- Transfer to user - admin only
CREATE OR REPLACE FUNCTION public.admin_transfer_to_user(p_user_id uuid, p_amount integer, p_reason text DEFAULT 'Admin transfer')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  platform_balance BIGINT;
  result JSON;
BEGIN
  -- STRICT: Only admin role can transfer (not moderator)
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only super admins can transfer credits';
  END IF;

  SELECT balance INTO platform_balance FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  IF platform_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  UPDATE platform_wallet
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'admin_transfer', p_amount, p_reason);

  INSERT INTO platform_transactions (transaction_type, amount, to_user_id, performed_by, description)
  VALUES ('transfer', p_amount, p_user_id, auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'transferred', p_amount,
    'to_user', p_user_id
  ) INTO result;

  RETURN result;
END;
$function$;

-- Withdraw to team wallet - admin only
CREATE OR REPLACE FUNCTION public.admin_withdraw_to_team_wallet(p_amount integer, p_reason text DEFAULT 'Withdrawal to team wallet')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  platform_balance BIGINT;
  team_wallet_exists BOOLEAN;
  result JSON;
BEGIN
  -- STRICT: Only admin role can withdraw (not moderator)
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only super admins can withdraw credits';
  END IF;

  SELECT balance INTO platform_balance FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  IF platform_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  SELECT EXISTS(SELECT 1 FROM team_wallets WHERE user_id = auth.uid()) INTO team_wallet_exists;
  
  IF NOT team_wallet_exists THEN
    INSERT INTO team_wallets (user_id, wallet_name, can_withdraw, can_transfer, can_mint)
    VALUES (auth.uid(), 'Admin Team Wallet', true, true, true);
  END IF;

  UPDATE platform_wallet
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  UPDATE team_wallets
  SET balance = balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO platform_transactions (transaction_type, amount, to_user_id, performed_by, description)
  VALUES ('withdrawal', p_amount, auth.uid(), auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'withdrawn', p_amount
  ) INTO result;

  RETURN result;
END;
$function$;

-- Function to check if user can manage credits (admin only, not moderator)
CREATE OR REPLACE FUNCTION public.can_manage_credits()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$function$;

-- Function to check if user can view admin wallet (admin OR moderator)
CREATE OR REPLACE FUNCTION public.can_view_admin_wallet()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::app_role) 
      OR public.has_role(auth.uid(), 'moderator'::app_role)
$function$;
