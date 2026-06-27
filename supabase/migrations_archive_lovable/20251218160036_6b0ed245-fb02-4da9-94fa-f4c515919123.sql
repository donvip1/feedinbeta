
-- Drop existing functions that have wrong return types
DROP FUNCTION IF EXISTS public.get_credit_statistics();
DROP FUNCTION IF EXISTS public.get_gift_statistics();

-- Sync existing gift fees to profits wallet
DO $$
DECLARE
  v_total_gift_value INTEGER;
  v_platform_fee INTEGER;
BEGIN
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_gift_value
  FROM credit_transactions WHERE type = 'gift_sent';
  
  v_platform_fee := ROUND(v_total_gift_value * 0.05);
  
  UPDATE profits_wallet
  SET 
    balance = v_platform_fee,
    total_collected = v_platform_fee,
    gift_fees = v_platform_fee,
    updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';
END $$;

-- Update credit_supply
UPDATE credit_supply 
SET circulating_supply = (SELECT COALESCE(SUM(balance), 0) FROM user_credits),
    updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Update platform_wallet gift revenue
UPDATE platform_wallet
SET gift_revenue = (SELECT ROUND(COALESCE(SUM(ABS(amount)), 0) * 0.05) FROM credit_transactions WHERE type = 'gift_sent'),
    updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Recreate get_credit_statistics
CREATE OR REPLACE FUNCTION public.get_credit_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_credits_total INTEGER;
  v_user_count INTEGER;
  v_p2p_escrow_locked INTEGER;
  v_p2p_active_listings INTEGER;
  v_platform_balance INTEGER;
  v_team_wallets_total INTEGER;
  v_gift_revenue INTEGER;
  v_promotion_revenue INTEGER;
  v_circulating_supply INTEGER;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COALESCE(SUM(balance), 0), COUNT(*) 
  INTO v_user_credits_total, v_user_count
  FROM user_credits;

  SELECT COALESCE(SUM(credits_amount), 0) INTO v_p2p_escrow_locked
  FROM p2p_escrow WHERE status = 'locked';

  SELECT COUNT(*) INTO v_p2p_active_listings
  FROM p2p_listings WHERE status = 'active';

  SELECT COALESCE(balance, 0) INTO v_platform_balance
  FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  SELECT COALESCE(SUM(balance), 0) INTO v_team_wallets_total
  FROM team_wallets;

  SELECT COALESCE(circulating_supply, 0) INTO v_circulating_supply
  FROM credit_supply WHERE id = '00000000-0000-0000-0000-000000000002';

  SELECT ROUND(COALESCE(SUM(ABS(amount)), 0) * 0.05) INTO v_gift_revenue
  FROM credit_transactions WHERE type = 'gift_sent';

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_promotion_revenue
  FROM credit_transactions WHERE type = 'promotion';

  RETURN jsonb_build_object(
    'user_credits_total', v_user_credits_total,
    'user_count', v_user_count,
    'p2p_escrow_locked', COALESCE(v_p2p_escrow_locked, 0),
    'p2p_active_listings', COALESCE(v_p2p_active_listings, 0),
    'platform_balance', COALESCE(v_platform_balance, 0),
    'team_wallets_total', COALESCE(v_team_wallets_total, 0),
    'gift_revenue', COALESCE(v_gift_revenue, 0),
    'promotion_revenue', COALESCE(v_promotion_revenue, 0),
    'subscription_revenue', 0,
    'p2p_fee_revenue', 0,
    'ai_feature_revenue', 0,
    'platform_profit', ROUND((COALESCE(v_gift_revenue, 0) + COALESCE(v_promotion_revenue, 0)) * 0.70),
    'creator_payouts_total', ROUND((COALESCE(v_gift_revenue, 0) + COALESCE(v_promotion_revenue, 0)) * 0.30),
    'total_minted', 0,
    'circulating_supply', v_circulating_supply
  );
END;
$$;

-- Recreate get_gift_statistics
CREATE OR REPLACE FUNCTION public.get_gift_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_gifts INTEGER;
  v_total_credits INTEGER;
  v_today_gifts INTEGER;
  v_today_credits INTEGER;
  v_week_gifts INTEGER;
  v_week_credits INTEGER;
  v_month_gifts INTEGER;
  v_month_credits INTEGER;
  v_unique_senders INTEGER;
  v_unique_receivers INTEGER;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COUNT(*), COALESCE(SUM(ABS(amount)), 0)
  INTO v_total_gifts, v_total_credits
  FROM credit_transactions WHERE type = 'gift_sent';

  SELECT COUNT(*), COALESCE(SUM(ABS(amount)), 0)
  INTO v_today_gifts, v_today_credits
  FROM credit_transactions 
  WHERE type = 'gift_sent' AND DATE(created_at) = CURRENT_DATE;

  SELECT COUNT(*), COALESCE(SUM(ABS(amount)), 0)
  INTO v_week_gifts, v_week_credits
  FROM credit_transactions 
  WHERE type = 'gift_sent' AND created_at >= CURRENT_DATE - INTERVAL '7 days';

  SELECT COUNT(*), COALESCE(SUM(ABS(amount)), 0)
  INTO v_month_gifts, v_month_credits
  FROM credit_transactions 
  WHERE type = 'gift_sent' AND created_at >= CURRENT_DATE - INTERVAL '30 days';

  SELECT COUNT(DISTINCT user_id) INTO v_unique_senders
  FROM credit_transactions WHERE type = 'gift_sent';

  SELECT COUNT(DISTINCT related_id) INTO v_unique_receivers
  FROM credit_transactions WHERE type = 'gift_sent';

  RETURN jsonb_build_object(
    'total_gifts_sent', v_total_gifts,
    'total_gift_credits', v_total_credits,
    'total_platform_fees', ROUND(v_total_credits * 0.05),
    'gifts_today', v_today_gifts,
    'gifts_this_week', v_week_gifts,
    'gifts_this_month', v_month_gifts,
    'credits_today', v_today_credits,
    'credits_this_week', v_week_credits,
    'credits_this_month', v_month_credits,
    'unique_senders', v_unique_senders,
    'unique_receivers', v_unique_receivers,
    'top_gift_types', '[]'::jsonb,
    'gifts_by_source', '[]'::jsonb
  );
END;
$$;

-- Fix can_manage_credits
CREATE OR REPLACE FUNCTION public.can_manage_credits()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT role INTO v_role FROM user_roles WHERE user_id = v_user_id;
  
  RETURN v_role IN ('super_admin', 'admin');
END;
$$;

-- Ensure sync_credit_supply exists
CREATE OR REPLACE FUNCTION public.sync_credit_supply()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE credit_supply
  SET circulating_supply = (SELECT COALESCE(SUM(balance), 0) FROM user_credits),
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';
END;
$$;
