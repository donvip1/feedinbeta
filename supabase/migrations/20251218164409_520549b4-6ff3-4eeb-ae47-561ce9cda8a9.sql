-- Fix live_streams policies to never expose stream_key publicly
DROP POLICY IF EXISTS "live_streams_public_view" ON public.live_streams;
DROP POLICY IF EXISTS "Anyone can view live or ended streams" ON public.live_streams;
DROP POLICY IF EXISTS "Public can view live streams" ON public.live_streams;

-- Drop existing owner policy if exists to avoid conflict
DROP POLICY IF EXISTS "Owners have full access to their streams" ON public.live_streams;

-- Create policy for stream owners - full access
CREATE POLICY "Owners have full access to their streams"
ON public.live_streams
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Drop existing public view policy if exists
DROP POLICY IF EXISTS "Authenticated users can view public stream info" ON public.live_streams;

-- Create policy for authenticated users to view public streams (without stream_key via view)
CREATE POLICY "Authenticated users can view public stream info"
ON public.live_streams
FOR SELECT
TO authenticated
USING (status IN ('live', 'ended', 'scheduled'));

-- Create a secure view that hides stream_key from non-owners
DROP VIEW IF EXISTS public.live_streams_public;
CREATE VIEW public.live_streams_public WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  title,
  description,
  thumbnail_url,
  status,
  viewer_count,
  started_at,
  ended_at,
  scheduled_start,
  category,
  tags,
  is_premium,
  peak_viewers,
  duration,
  created_at,
  updated_at,
  CASE WHEN auth.uid() = user_id THEN stream_key ELSE NULL END as stream_key
FROM public.live_streams;

-- Grant access to the secure view only to authenticated users
GRANT SELECT ON public.live_streams_public TO authenticated;
REVOKE SELECT ON public.live_streams_public FROM anon;

-- Revoke anonymous access to live_streams table
REVOKE ALL ON public.live_streams FROM anon;