
-- Create missing profits wallet and daily earnings tables
CREATE TABLE IF NOT EXISTS public.profits_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance INTEGER DEFAULT 0,
  total_collected INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,
  gift_fees INTEGER DEFAULT 0,
  promotion_fees INTEGER DEFAULT 0,
  other_fees INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profits_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('gift_fee', 'promotion_fee', 'withdrawal', 'other')),
  source_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  gift_fees INTEGER DEFAULT 0,
  promotion_fees INTEGER DEFAULT 0,
  other_fees INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profits_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profits_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies - admin only access
CREATE POLICY "Admins can view profits wallet"
ON public.profits_wallet FOR SELECT
TO authenticated
USING (public.can_view_admin_wallet());

CREATE POLICY "Admins can manage profits wallet"
ON public.profits_wallet FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_view_admin_wallet());

CREATE POLICY "Admins can view profits transactions"
ON public.profits_transactions FOR SELECT
TO authenticated
USING (public.can_view_admin_wallet());

CREATE POLICY "Admins can insert profits transactions"
ON public.profits_transactions FOR INSERT
TO authenticated
WITH CHECK (public.can_view_admin_wallet());

CREATE POLICY "Admins can view daily earnings"
ON public.daily_earnings FOR SELECT
TO authenticated
USING (public.can_view_admin_wallet());

CREATE POLICY "Admins can manage daily earnings"
ON public.daily_earnings FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_view_admin_wallet());

-- Initialize profits wallet with single row if not exists
INSERT INTO public.profits_wallet (id, balance, total_collected, total_withdrawn, gift_fees, promotion_fees, other_fees)
VALUES ('00000000-0000-0000-0000-000000000001', 0, 0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- Fix can_view_admin_wallet to be more robust
CREATE OR REPLACE FUNCTION public.can_view_admin_wallet()
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
  
  RETURN v_role IN ('super_admin', 'admin', 'moderator');
END;
$$;

-- Function to get profits wallet summary
CREATE OR REPLACE FUNCTION public.get_profits_wallet_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_recent_transactions JSONB;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT * INTO v_wallet FROM profits_wallet WHERE id = '00000000-0000-0000-0000-000000000001';
  
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'amount', amount,
      'type', transaction_type,
      'description', description,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb) INTO v_recent_transactions
  FROM (SELECT * FROM profits_transactions ORDER BY created_at DESC LIMIT 10) t;

  RETURN jsonb_build_object(
    'balance', COALESCE(v_wallet.balance, 0),
    'total_collected', COALESCE(v_wallet.total_collected, 0),
    'total_withdrawn', COALESCE(v_wallet.total_withdrawn, 0),
    'gift_fees', COALESCE(v_wallet.gift_fees, 0),
    'promotion_fees', COALESCE(v_wallet.promotion_fees, 0),
    'other_fees', COALESCE(v_wallet.other_fees, 0),
    'recent_transactions', v_recent_transactions
  );
END;
$$;

-- Function to get daily earnings stats
CREATE OR REPLACE FUNCTION public.get_daily_earnings_stats()
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
      'gift_fees', gift_fees,
      'promotion_fees', promotion_fees,
      'other_fees', other_fees,
      'total', total
    ) ORDER BY date DESC
  ), '[]'::jsonb) INTO v_breakdown
  FROM (SELECT * FROM daily_earnings ORDER BY date DESC LIMIT 30) t;

  RETURN jsonb_build_object(
    'today', v_today,
    'week', v_week,
    'month', v_month,
    'breakdown', v_breakdown
  );
END;
$$;

-- Function to record profit (call this when gifts/promotions happen)
CREATE OR REPLACE FUNCTION public.record_profit(
  p_amount INTEGER,
  p_type TEXT,
  p_source_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profits wallet
  UPDATE profits_wallet 
  SET 
    balance = balance + p_amount,
    total_collected = total_collected + p_amount,
    gift_fees = CASE WHEN p_type = 'gift_fee' THEN gift_fees + p_amount ELSE gift_fees END,
    promotion_fees = CASE WHEN p_type = 'promotion_fee' THEN promotion_fees + p_amount ELSE promotion_fees END,
    other_fees = CASE WHEN p_type = 'other' THEN other_fees + p_amount ELSE other_fees END,
    updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Record transaction
  INSERT INTO profits_transactions (amount, transaction_type, source_id, description)
  VALUES (p_amount, p_type, p_source_id, p_description);

  -- Update daily earnings
  INSERT INTO daily_earnings (date, gift_fees, promotion_fees, other_fees, total)
  VALUES (
    CURRENT_DATE,
    CASE WHEN p_type = 'gift_fee' THEN p_amount ELSE 0 END,
    CASE WHEN p_type = 'promotion_fee' THEN p_amount ELSE 0 END,
    CASE WHEN p_type = 'other' THEN p_amount ELSE 0 END,
    p_amount
  )
  ON CONFLICT (date) DO UPDATE SET
    gift_fees = daily_earnings.gift_fees + CASE WHEN p_type = 'gift_fee' THEN p_amount ELSE 0 END,
    promotion_fees = daily_earnings.promotion_fees + CASE WHEN p_type = 'promotion_fee' THEN p_amount ELSE 0 END,
    other_fees = daily_earnings.other_fees + CASE WHEN p_type = 'other' THEN p_amount ELSE 0 END,
    total = daily_earnings.total + p_amount;
END;
$$;

-- Sync existing gift transactions to gift_analytics
INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, source_type, created_at, platform_fee)
SELECT 
  ct.user_id as sender_id,
  ct.related_id as receiver_id,
  'credit_gift' as gift_type,
  ABS(ct.amount) as credit_value,
  'post' as source_type,
  ct.created_at,
  ROUND(ABS(ct.amount) * 0.05) as platform_fee
FROM credit_transactions ct
WHERE ct.type = 'gift_sent'
AND NOT EXISTS (
  SELECT 1 FROM gift_analytics ga 
  WHERE ga.sender_id = ct.user_id 
  AND ga.created_at = ct.created_at
  AND ga.credit_value = ABS(ct.amount)
);

-- Function to get comprehensive gift analytics
CREATE OR REPLACE FUNCTION public.get_gift_analytics_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_gifts INTEGER;
  v_total_value INTEGER;
  v_total_platform_fees INTEGER;
  v_today_gifts INTEGER;
  v_today_value INTEGER;
  v_week_gifts INTEGER;
  v_week_value INTEGER;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Get totals from gift_analytics
  SELECT 
    COUNT(*),
    COALESCE(SUM(credit_value), 0),
    COALESCE(SUM(platform_fee), 0)
  INTO v_total_gifts, v_total_value, v_total_platform_fees
  FROM gift_analytics;

  -- Also check credit_transactions for any missed gifts
  SELECT 
    COALESCE(SUM(ABS(amount)), 0)
  INTO v_total_value
  FROM credit_transactions
  WHERE type = 'gift_sent';

  SELECT COUNT(*) INTO v_total_gifts
  FROM credit_transactions WHERE type = 'gift_sent';

  -- Today's gifts
  SELECT COUNT(*), COALESCE(SUM(ABS(amount)), 0)
  INTO v_today_gifts, v_today_value
  FROM credit_transactions
  WHERE type = 'gift_sent' AND DATE(created_at) = CURRENT_DATE;

  -- This week's gifts
  SELECT COUNT(*), COALESCE(SUM(ABS(amount)), 0)
  INTO v_week_gifts, v_week_value
  FROM credit_transactions
  WHERE type = 'gift_sent' AND created_at >= CURRENT_DATE - INTERVAL '7 days';

  RETURN jsonb_build_object(
    'total_gifts', v_total_gifts,
    'total_value', v_total_value,
    'total_platform_fees', ROUND(v_total_value * 0.05),
    'today_gifts', v_today_gifts,
    'today_value', v_today_value,
    'week_gifts', v_week_gifts,
    'week_value', v_week_value
  );
END;
$$;

-- Update credit_supply with accurate circulating data
UPDATE credit_supply 
SET circulating_supply = (SELECT COALESCE(SUM(balance), 0) FROM user_credits),
    updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000002';
