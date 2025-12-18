-- Fix 1: Restrict profiles table to authenticated users only
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;

-- Create strict authenticated-only policy for profiles
CREATE POLICY "profiles_select_authenticated_only"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Revoke anonymous access to profiles
REVOKE SELECT ON public.profiles FROM anon;

-- Fix 2: Add comprehensive RLS policies for user_credits table
-- First ensure RLS is enabled
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_select" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_insert" ON public.user_credits;
DROP POLICY IF EXISTS "user_credits_update" ON public.user_credits;

-- Users can only view their own credits
CREATE POLICY "user_credits_select_own"
ON public.user_credits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Block direct INSERT - only system functions can insert
CREATE POLICY "user_credits_insert_blocked"
ON public.user_credits FOR INSERT
TO authenticated
WITH CHECK (false);

-- Block direct UPDATE - only system functions can update
CREATE POLICY "user_credits_update_blocked"
ON public.user_credits FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Revoke anonymous access
REVOKE ALL ON public.user_credits FROM anon;

-- Fix 3: Strengthen payment_history RLS policies
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Users can view own payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Admins can view all payment history" ON public.payment_history;
DROP POLICY IF EXISTS "payment_history_select" ON public.payment_history;

-- Users can ONLY view their own payment history (no admin bypass)
CREATE POLICY "payment_history_select_own_only"
ON public.payment_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Block direct INSERT - only webhooks via service role can insert
CREATE POLICY "payment_history_insert_blocked"
ON public.payment_history FOR INSERT
TO authenticated
WITH CHECK (false);

-- Block direct UPDATE
CREATE POLICY "payment_history_update_blocked"
ON public.payment_history FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Revoke anonymous access
REVOKE ALL ON public.payment_history FROM anon;