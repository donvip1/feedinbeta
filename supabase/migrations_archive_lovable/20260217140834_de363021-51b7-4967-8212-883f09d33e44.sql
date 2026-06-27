
CREATE OR REPLACE FUNCTION public.get_credit_statistics()
RETURNS jsonb
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

  -- Get user balances EXCLUDING super admin (minting reserve)
  SELECT COALESCE(SUM(uc.balance), 0), COUNT(*)
  INTO v_user_credits_total, v_user_count
  FROM user_credits uc
  WHERE NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = uc.user_id AND ur.role = 'super_admin'
  );

  SELECT COALESCE(SUM(credits_amount), 0) INTO v_p2p_escrow_locked
  FROM p2p_escrow WHERE status = 'locked';

  SELECT COUNT(*) INTO v_p2p_active_listings
  FROM p2p_listings WHERE status = 'active';

  SELECT COALESCE(balance, 0) INTO v_platform_balance
  FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  SELECT COALESCE(SUM(balance), 0) INTO v_team_wallets_total
  FROM team_wallets;

  -- Circulating supply = sum of all non-admin user balances (dynamic calculation)
  v_circulating_supply := v_user_credits_total;

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
