
-- Drop existing function with old signature
DROP FUNCTION IF EXISTS public.add_credits_from_purchase(uuid, integer, text, text);

-- 1. Create can_mint_credits() - SUPER ADMIN ONLY
CREATE OR REPLACE FUNCTION public.can_mint_credits()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 2. Create can_withdraw_from_wallet() - SUPER ADMIN ONLY
CREATE OR REPLACE FUNCTION public.can_withdraw_from_wallet()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- 3. Update admin_mint_credits - super_admin only
CREATE OR REPLACE FUNCTION public.admin_mint_credits(p_amount integer, p_reason text DEFAULT 'Admin mint')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_supply RECORD;
  result JSON;
BEGIN
  IF NOT can_mint_credits() THEN
    RAISE EXCEPTION 'Access denied: Only the CEO/Super Admin can fund the FeedIn Wallet';
  END IF;

  SELECT * INTO current_supply FROM credit_supply WHERE id = '00000000-0000-0000-0000-000000000002';

  IF (current_supply.circulating_supply + p_amount) > current_supply.total_supply THEN
    RAISE EXCEPTION 'Cannot mint: would exceed total supply of %', current_supply.total_supply;
  END IF;

  UPDATE credit_supply
  SET circulating_supply = circulating_supply + p_amount,
      last_mint_at = now(), last_mint_by = auth.uid(),
      last_mint_amount = p_amount, updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';

  UPDATE platform_wallet
  SET balance = balance + p_amount, updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  INSERT INTO platform_transactions (transaction_type, amount, performed_by, description)
  VALUES ('mint', p_amount, auth.uid(), p_reason);

  SELECT json_build_object('success', true, 'minted', p_amount,
    'new_circulating_supply', current_supply.circulating_supply + p_amount) INTO result;
  RETURN result;
END;
$$;

-- 4. Update withdraw to team wallet - super_admin only
CREATE OR REPLACE FUNCTION public.admin_withdraw_to_team_wallet(p_amount integer, p_reason text DEFAULT 'Withdrawal to team wallet')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  platform_balance BIGINT;
  team_wallet_exists BOOLEAN;
  result JSON;
BEGIN
  IF NOT can_withdraw_from_wallet() THEN
    RAISE EXCEPTION 'Access denied: Only CEO/Super Admin can withdraw';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance INTO platform_balance FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';
  IF platform_balance IS NULL OR platform_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  UPDATE platform_wallet SET balance = balance - p_amount, updated_at = now() WHERE id = '00000000-0000-0000-0000-000000000001';
  SELECT EXISTS(SELECT 1 FROM team_wallets WHERE user_id = auth.uid()) INTO team_wallet_exists;
  IF NOT team_wallet_exists THEN
    INSERT INTO team_wallets (user_id, wallet_name, can_withdraw, can_transfer, can_mint)
    VALUES (auth.uid(), 'CEO Team Wallet', true, true, true);
  END IF;
  UPDATE team_wallets SET balance = balance + p_amount, total_earned = total_earned + p_amount, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO platform_transactions (transaction_type, amount, performed_by, description) VALUES ('withdraw', p_amount, auth.uid(), p_reason);
  SELECT json_build_object('success', true, 'withdrawn', p_amount) INTO result;
  RETURN result;
END;
$$;

-- 5. Update profits withdrawal - super_admin only
CREATE OR REPLACE FUNCTION public.admin_withdraw_from_profits(p_amount integer, p_reason text DEFAULT 'Withdrawal from profits')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance BIGINT;
  result JSON;
BEGIN
  IF NOT can_withdraw_from_wallet() THEN
    RAISE EXCEPTION 'Access denied: Only CEO/Super Admin can withdraw from profits';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance INTO current_balance FROM profits_wallet WHERE id = '00000000-0000-0000-0000-000000000003';
  IF current_balance IS NULL OR current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient profits wallet balance';
  END IF;

  UPDATE profits_wallet SET balance = balance - p_amount, total_withdrawn = total_withdrawn + p_amount, updated_at = now() WHERE id = '00000000-0000-0000-0000-000000000003';
  INSERT INTO profits_transactions (transaction_type, amount, source_type, description, balance_after)
  VALUES ('withdrawal', -p_amount, 'admin', p_reason, current_balance - p_amount);
  SELECT json_build_object('success', true, 'withdrawn', p_amount) INTO result;
  RETURN result;
END;
$$;

-- 6. Recreate add_credits_from_purchase with platform_wallet deduction
CREATE OR REPLACE FUNCTION public.add_credits_from_purchase(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_reference TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.credit_transactions (user_id, amount, type, description, stripe_payment_intent_id)
  VALUES (p_user_id, p_amount, 'purchase', p_description, p_reference);

  UPDATE public.user_credits
  SET balance = balance + p_amount, total_earned = total_earned + p_amount, updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance, total_earned) VALUES (p_user_id, p_amount, p_amount);
  END IF;

  -- Deduct from FeedIn Wallet
  UPDATE public.platform_wallet SET balance = balance - p_amount, updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  INSERT INTO public.platform_transactions (transaction_type, amount, to_user_id, description)
  VALUES ('subscription_credit', p_amount, p_user_id, p_description);
END;
$$;

-- 7. Create get_subscription_statistics
CREATE OR REPLACE FUNCTION public.get_subscription_statistics()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_build_object(
    'total_subscribers', (SELECT count(*) FROM user_subscriptions WHERE status = 'active'),
    'total_ever_subscribed', (SELECT count(*) FROM user_subscriptions),
    'expired_subscribers', (SELECT count(*) FROM user_subscriptions WHERE status != 'active' OR current_period_end < now()),
    'subscription_revenue', (
      SELECT COALESCE(sum(ct.amount), 0) FROM credit_transactions ct
      WHERE ct.type = 'purchase' AND ct.description ILIKE '%subscription%'
    ),
    'subscribers_by_tier', (
      SELECT COALESCE(json_agg(tier_data), '[]'::json) FROM (
        SELECT st.name as tier_name, st.id as tier_id, st.subscription_credits,
          count(us.id) as subscriber_count,
          count(CASE WHEN us.status = 'active' AND us.current_period_end > now() THEN 1 END) as active_count
        FROM subscription_tiers st
        LEFT JOIN user_subscriptions us ON us.tier_id = st.id
        GROUP BY st.id, st.name, st.subscription_credits
        ORDER BY st.subscription_credits
      ) tier_data
    ),
    'recent_subscribers', (
      SELECT COALESCE(json_agg(sub_data), '[]'::json) FROM (
        SELECT us.user_id, p.username, p.display_name, st.name as plan_name,
          us.status, us.current_period_start, us.current_period_end, us.created_at
        FROM user_subscriptions us
        JOIN profiles p ON p.id = us.user_id
        LEFT JOIN subscription_tiers st ON st.id = us.tier_id
        ORDER BY us.created_at DESC LIMIT 50
      ) sub_data
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- 8. Sync circulating supply
DO $$
BEGIN
  UPDATE credit_supply
  SET circulating_supply = (
    SELECT COALESCE(sum(balance), 0) FROM user_credits
  ) + (SELECT COALESCE(balance, 0) FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001'),
  updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';
END;
$$;
