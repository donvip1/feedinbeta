
-- Create get_recent_profits_transactions function
CREATE OR REPLACE FUNCTION public.get_recent_profits_transactions(p_limit INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'amount', amount,
        'transaction_type', transaction_type,
        'source_id', source_id,
        'description', description,
        'created_at', created_at
      ) ORDER BY created_at DESC
    )
    FROM (SELECT * FROM profits_transactions ORDER BY created_at DESC LIMIT p_limit) t
  ), '[]'::jsonb);
END;
$$;

-- Update get_profits_wallet_summary to include recent transactions
CREATE OR REPLACE FUNCTION public.get_profits_wallet_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_today INTEGER;
  v_week INTEGER;
  v_month INTEGER;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT * INTO v_wallet FROM profits_wallet WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- Calculate time-based earnings from profits_transactions
  SELECT COALESCE(SUM(amount), 0) INTO v_today
  FROM profits_transactions 
  WHERE transaction_type != 'withdrawal' AND DATE(created_at) = CURRENT_DATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_week
  FROM profits_transactions 
  WHERE transaction_type != 'withdrawal' AND created_at >= CURRENT_DATE - INTERVAL '7 days';

  SELECT COALESCE(SUM(amount), 0) INTO v_month
  FROM profits_transactions 
  WHERE transaction_type != 'withdrawal' AND created_at >= CURRENT_DATE - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'balance', COALESCE(v_wallet.balance, 0),
    'total_deposited', COALESCE(v_wallet.total_collected, 0),
    'total_withdrawn', COALESCE(v_wallet.total_withdrawn, 0),
    'gift_fees_collected', COALESCE(v_wallet.gift_fees, 0),
    'live_gift_fees_collected', 0,
    'promotion_fees_collected', COALESCE(v_wallet.promotion_fees, 0),
    'p2p_fees_collected', 0,
    'subscription_fees_collected', 0,
    'last_deposit_at', NULL,
    'last_withdrawal_at', NULL,
    'today_earnings', v_today,
    'week_earnings', v_week,
    'month_earnings', v_month
  );
END;
$$;

-- Update get_daily_earnings_stats to accept p_days parameter
DROP FUNCTION IF EXISTS public.get_daily_earnings_stats(INTEGER);
CREATE OR REPLACE FUNCTION public.get_daily_earnings_stats(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today INTEGER;
  v_week INTEGER;
  v_month INTEGER;
  v_breakdown JSONB;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COALESCE(SUM(total), 0) INTO v_today
  FROM daily_earnings WHERE date = CURRENT_DATE;

  SELECT COALESCE(SUM(total), 0) INTO v_week
  FROM daily_earnings WHERE date >= CURRENT_DATE - INTERVAL '7 days';

  SELECT COALESCE(SUM(total), 0) INTO v_month
  FROM daily_earnings WHERE date >= CURRENT_DATE - INTERVAL '30 days';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', date,
      'gift_earnings', gift_fees,
      'promotion_earnings', promotion_fees,
      'subscription_earnings', 0,
      'p2p_fee_earnings', 0,
      'ai_feature_earnings', 0,
      'live_gift_earnings', 0,
      'total_earnings', total,
      'platform_profit', ROUND(total * 0.70),
      'creator_payouts', ROUND(total * 0.30),
      'gifts_count', 0,
      'live_gifts_count', 0,
      'promotions_count', 0,
      'transactions_count', 0
    ) ORDER BY date DESC
  ), '[]'::jsonb) INTO v_breakdown
  FROM (SELECT * FROM daily_earnings ORDER BY date DESC LIMIT p_days) t;

  RETURN jsonb_build_object(
    'today', v_today,
    'week', v_week,
    'month', v_month,
    'breakdown', v_breakdown
  );
END;
$$;
