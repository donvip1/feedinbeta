-- Fix RLS policy for live_stream_viewers to allow viewing any stream (not just 'live' ones)
DROP POLICY IF EXISTS "Users can view viewers of public streams" ON public.live_stream_viewers;
CREATE POLICY "Users can view stream viewers"
ON public.live_stream_viewers FOR SELECT
USING (true);

-- Fix RLS policy for live_stream_viewers INSERT to allow joining any stream
DROP POLICY IF EXISTS "Users can join streams as viewers" ON public.live_stream_viewers;
CREATE POLICY "Users can join streams as viewers"
ON public.live_stream_viewers FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Fix live_streams SELECT policy to allow viewing scheduled streams
DROP POLICY IF EXISTS "Users can view active live streams" ON public.live_streams;
CREATE POLICY "Users can view all streams"
ON public.live_streams FOR SELECT
USING (true);

-- Fix live_stream_comments SELECT to view all comments
DROP POLICY IF EXISTS "Users can view comments on live streams" ON public.live_stream_comments;
CREATE POLICY "Users can view stream comments"
ON public.live_stream_comments FOR SELECT
USING (true);

-- Remove duplicate credit_transactions policy
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;

-- Fix credit_transactions INSERT policy - remove the blocking policy
DROP POLICY IF EXISTS "Only backend functions can insert transactions" ON public.credit_transactions;

-- Ensure credit_transactions INSERT policy exists and works
DROP POLICY IF EXISTS "Users can insert their own credit transactions" ON public.credit_transactions;
CREATE POLICY "Users can insert their own credit transactions"
ON public.credit_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Fix user_credits UPDATE policy - ensure users can update their own credits
DROP POLICY IF EXISTS "System can update credits" ON public.user_credits;
CREATE POLICY "Users can update their own credits"
ON public.user_credits FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);