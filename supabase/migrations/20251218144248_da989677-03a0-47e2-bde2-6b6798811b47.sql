
-- Add revenue tracking columns to platform_wallet
ALTER TABLE public.platform_wallet 
ADD COLUMN IF NOT EXISTS gift_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS p2p_fee_revenue numeric DEFAULT 0;

-- Create team_wallets table if not exists
CREATE TABLE IF NOT EXISTS public.team_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric DEFAULT 0,
  total_withdrawn numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.team_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own team wallet"
ON public.team_wallets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all team wallets"
ON public.team_wallets FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create creator_incentive_tiers table for benchmark payouts
CREATE TABLE IF NOT EXISTS public.creator_incentive_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  min_earnings numeric NOT NULL DEFAULT 0,
  max_earnings numeric,
  bonus_percentage numeric NOT NULL DEFAULT 0,
  period_type text NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('weekly', 'monthly')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.creator_incentive_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view incentive tiers"
ON public.creator_incentive_tiers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage incentive tiers"
ON public.creator_incentive_tiers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create creator_payouts table for tracking incentive payments
CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES public.creator_incentive_tiers(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_earnings numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payouts"
ON public.creator_payouts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all payouts"
ON public.creator_payouts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create function to get real-time credit statistics
CREATE OR REPLACE FUNCTION public.get_credit_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_credits numeric;
  v_user_count integer;
  v_p2p_escrow numeric;
  v_p2p_listings numeric;
  v_platform_balance numeric;
  v_total_team_wallets numeric;
  v_gift_revenue numeric;
  v_promotion_revenue numeric;
  v_total_minted numeric;
BEGIN
  -- Get total user credits
  SELECT COALESCE(SUM(balance), 0), COUNT(*) INTO v_user_credits, v_user_count
  FROM user_credits;
  
  -- Get P2P escrow locked
  SELECT COALESCE(SUM(credits_amount), 0) INTO v_p2p_escrow
  FROM p2p_escrow WHERE status = 'locked';
  
  -- Get P2P active listings
  SELECT COALESCE(SUM(credits_amount), 0) INTO v_p2p_listings
  FROM p2p_listings WHERE status = 'active';
  
  -- Get platform wallet balance
  SELECT COALESCE(balance, 0), COALESCE(gift_revenue, 0), COALESCE(promotion_revenue, 0)
  INTO v_platform_balance, v_gift_revenue, v_promotion_revenue
  FROM platform_wallet LIMIT 1;
  
  -- Get total team wallets balance
  SELECT COALESCE(SUM(balance), 0) INTO v_total_team_wallets
  FROM team_wallets;
  
  -- Get total minted from credit supply
  SELECT COALESCE(circulating_supply, 0) INTO v_total_minted
  FROM credit_supply LIMIT 1;
  
  RETURN jsonb_build_object(
    'user_credits_total', v_user_credits,
    'user_count', v_user_count,
    'p2p_escrow_locked', v_p2p_escrow,
    'p2p_active_listings', v_p2p_listings,
    'platform_balance', v_platform_balance,
    'team_wallets_total', v_total_team_wallets,
    'gift_revenue', v_gift_revenue,
    'promotion_revenue', v_promotion_revenue,
    'total_minted', v_total_minted,
    'circulating_supply', v_user_credits + v_p2p_escrow + v_platform_balance + v_total_team_wallets
  );
END;
$$;

-- Create function to sync credit supply with actual circulation
CREATE OR REPLACE FUNCTION public.sync_credit_supply()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actual_circulation numeric;
BEGIN
  -- Calculate actual circulating supply
  SELECT 
    COALESCE((SELECT SUM(balance) FROM user_credits), 0) +
    COALESCE((SELECT SUM(credits_amount) FROM p2p_escrow WHERE status = 'locked'), 0) +
    COALESCE((SELECT balance FROM platform_wallet LIMIT 1), 0) +
    COALESCE((SELECT SUM(balance) FROM team_wallets), 0)
  INTO v_actual_circulation;
  
  -- Update credit supply
  UPDATE credit_supply 
  SET circulating_supply = v_actual_circulation,
      updated_at = now();
END;
$$;

-- Create function to record platform revenue
CREATE OR REPLACE FUNCTION public.record_platform_revenue(
  p_revenue_type text,
  p_amount numeric,
  p_from_user_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update platform wallet based on revenue type
  IF p_revenue_type = 'gift_fee' THEN
    UPDATE platform_wallet SET 
      gift_revenue = COALESCE(gift_revenue, 0) + p_amount,
      balance = COALESCE(balance, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount,
      updated_at = now();
  ELSIF p_revenue_type = 'promotion_fee' THEN
    UPDATE platform_wallet SET 
      promotion_revenue = COALESCE(promotion_revenue, 0) + p_amount,
      balance = COALESCE(balance, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount,
      updated_at = now();
  ELSIF p_revenue_type = 'subscription_fee' THEN
    UPDATE platform_wallet SET 
      subscription_revenue = COALESCE(subscription_revenue, 0) + p_amount,
      balance = COALESCE(balance, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount,
      updated_at = now();
  ELSIF p_revenue_type = 'p2p_fee' THEN
    UPDATE platform_wallet SET 
      p2p_fee_revenue = COALESCE(p2p_fee_revenue, 0) + p_amount,
      balance = COALESCE(balance, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount,
      updated_at = now();
  END IF;
  
  -- Record transaction
  INSERT INTO platform_transactions (
    transaction_type, amount, from_user_id, description
  ) VALUES (
    p_revenue_type, p_amount, p_from_user_id, p_description
  );
  
  -- Sync credit supply
  PERFORM sync_credit_supply();
END;
$$;

-- Insert default incentive tiers
INSERT INTO public.creator_incentive_tiers (tier_name, min_earnings, max_earnings, bonus_percentage, period_type)
VALUES 
  ('Bronze Creator', 100, 499, 5, 'monthly'),
  ('Silver Creator', 500, 999, 10, 'monthly'),
  ('Gold Creator', 1000, 4999, 15, 'monthly'),
  ('Platinum Creator', 5000, 9999, 20, 'monthly'),
  ('Diamond Creator', 10000, NULL, 25, 'monthly'),
  ('Weekly Star', 50, 199, 5, 'weekly'),
  ('Weekly Champion', 200, NULL, 10, 'weekly')
ON CONFLICT DO NOTHING;

-- Sync the credit supply now
SELECT sync_credit_supply();
