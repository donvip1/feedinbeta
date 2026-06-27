
-- Update can_manage_credits to only allow the creator (cryptosvip@gmail.com)
CREATE OR REPLACE FUNCTION public.can_manage_credits()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  creator_user_id UUID := 'ed1b6442-7dfb-4ac4-b121-dd9d14acc085'; -- cryptosvip@gmail.com
BEGIN
  current_user_id := auth.uid();
  
  -- Only the creator can manage credits
  RETURN current_user_id = creator_user_id;
END;
$$;

-- Ensure can_view_admin_wallet allows all admins and moderators to VIEW
CREATE OR REPLACE FUNCTION public.can_view_admin_wallet()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Allow admins and moderators to view
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_user_id
    AND role IN ('admin', 'moderator')
  );
END;
$$;

-- Update RLS policies on team_wallets to restrict modifications
DROP POLICY IF EXISTS "Team wallet owners can view" ON team_wallets;
DROP POLICY IF EXISTS "Only creator can modify team wallets" ON team_wallets;

CREATE POLICY "Admins and moderators can view team wallets"
ON team_wallets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

CREATE POLICY "Only creator can modify team wallets"
ON team_wallets FOR ALL
USING (auth.uid() = 'ed1b6442-7dfb-4ac4-b121-dd9d14acc085'::uuid)
WITH CHECK (auth.uid() = 'ed1b6442-7dfb-4ac4-b121-dd9d14acc085'::uuid);

-- Update RLS policies on platform_wallet
DROP POLICY IF EXISTS "Admins can view platform wallet" ON platform_wallet;
DROP POLICY IF EXISTS "Only creator can modify platform wallet" ON platform_wallet;

CREATE POLICY "Admins and moderators can view platform wallet"
ON platform_wallet FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- Update RLS policies on platform_transactions
DROP POLICY IF EXISTS "Admins can view transactions" ON platform_transactions;

CREATE POLICY "Admins and moderators can view platform transactions"
ON platform_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- Update RLS policies on credit_supply
DROP POLICY IF EXISTS "Admins can view credit supply" ON credit_supply;

CREATE POLICY "Admins and moderators can view credit supply"
ON credit_supply FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- Update RLS on creator_incentive_tiers
DROP POLICY IF EXISTS "Anyone can view tiers" ON creator_incentive_tiers;

CREATE POLICY "Admins and moderators can view incentive tiers"
ON creator_incentive_tiers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- Update RLS on creator_payouts
DROP POLICY IF EXISTS "Admins can view payouts" ON creator_payouts;

CREATE POLICY "Admins and moderators can view creator payouts"
ON creator_payouts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);
