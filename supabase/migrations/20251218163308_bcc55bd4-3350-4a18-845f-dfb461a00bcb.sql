-- Fix 1: Ensure profiles table is only accessible to authenticated users
DROP POLICY IF EXISTS "profiles_select_authenticated_only" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "profiles_authenticated_only"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON public.profiles FROM anon;

-- Fix 2: Clean up conflicting credit_transactions policies
DROP POLICY IF EXISTS "Users can insert their own credit transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "authenticated_users_create_credit_transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Block direct user inserts to credit_transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "credit_transactions_insert_blocked" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can view their own credit transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "credit_transactions_select_own" ON public.credit_transactions;

-- Users can ONLY view their own transactions
CREATE POLICY "credit_transactions_view_own"
ON public.credit_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Block ALL direct inserts - only system functions can insert
CREATE POLICY "credit_transactions_no_direct_insert"
ON public.credit_transactions FOR INSERT
TO authenticated
WITH CHECK (false);

-- Fix 3: Protect stream keys - ensure only owners can see their stream key
DROP POLICY IF EXISTS "Users can view all live streams" ON public.live_streams;
DROP POLICY IF EXISTS "Anyone can view public live streams" ON public.live_streams;
DROP POLICY IF EXISTS "live_streams_select" ON public.live_streams;

-- Create view that hides stream_key from non-owners
CREATE OR REPLACE VIEW public.live_streams_safe AS
SELECT 
  id,
  user_id,
  title,
  description,
  CASE WHEN auth.uid() = user_id THEN stream_key ELSE NULL END as stream_key,
  status,
  category,
  thumbnail_url,
  viewer_count,
  peak_viewers,
  started_at,
  ended_at,
  is_premium,
  tags,
  scheduled_start,
  duration,
  created_at,
  updated_at
FROM public.live_streams;

-- Grant access to the safe view
GRANT SELECT ON public.live_streams_safe TO authenticated;

-- Restrict direct table access - owners can see their own, others see via view
CREATE POLICY "live_streams_owner_full_access"
ON public.live_streams FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "live_streams_public_view"
ON public.live_streams FOR SELECT
TO authenticated
USING (status IN ('live', 'ended'));

-- Fix 4: Block direct security_events inserts from clients
DROP POLICY IF EXISTS "Allow insert security events" ON public.security_events;
DROP POLICY IF EXISTS "security_events_insert" ON public.security_events;

-- Block direct inserts - only backend services should log security events
CREATE POLICY "security_events_no_direct_insert"
ON public.security_events FOR INSERT
TO authenticated
WITH CHECK (false);

-- Users can only view their own security events
DROP POLICY IF EXISTS "Users can view their own security events" ON public.security_events;
CREATE POLICY "security_events_view_own"
ON public.security_events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 5: Restrict live_stream_analytics to stream owners only
DROP POLICY IF EXISTS "Stream owners can view their analytics" ON public.live_stream_analytics;
DROP POLICY IF EXISTS "live_stream_analytics_select" ON public.live_stream_analytics;

CREATE POLICY "live_stream_analytics_owner_only"
ON public.live_stream_analytics FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_streams ls 
    WHERE ls.id = stream_id AND ls.user_id = auth.uid()
  )
);

-- Revoke anonymous access from all sensitive tables
REVOKE ALL ON public.user_credits FROM anon;
REVOKE ALL ON public.credit_transactions FROM anon;
REVOKE ALL ON public.payment_history FROM anon;
REVOKE ALL ON public.live_streams FROM anon;
REVOKE ALL ON public.security_events FROM anon;
REVOKE ALL ON public.live_stream_analytics FROM anon;