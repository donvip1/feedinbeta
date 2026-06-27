-- Add RLS policies to tables that need them

-- profits_wallet policies
DROP POLICY IF EXISTS "Admin only access profits_wallet" ON public.profits_wallet;
CREATE POLICY "Admin only access profits_wallet"
ON public.profits_wallet
FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_manage_credits());

-- profits_transactions policies
DROP POLICY IF EXISTS "Admin only access profits_transactions" ON public.profits_transactions;
CREATE POLICY "Admin only access profits_transactions"
ON public.profits_transactions
FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_manage_credits());

-- daily_earnings policies
DROP POLICY IF EXISTS "Admin only access daily_earnings" ON public.daily_earnings;
CREATE POLICY "Admin only access daily_earnings"
ON public.daily_earnings
FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_manage_credits());

-- Ensure profiles table is not public
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Recreate authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Revoke anon access
REVOKE SELECT ON public.profiles FROM anon;