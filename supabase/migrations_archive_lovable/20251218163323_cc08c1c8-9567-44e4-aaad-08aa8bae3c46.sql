-- Fix the security definer view - use SECURITY INVOKER instead
DROP VIEW IF EXISTS public.live_streams_safe;

CREATE OR REPLACE VIEW public.live_streams_safe
WITH (security_invoker = true)
AS
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
REVOKE ALL ON public.live_streams_safe FROM anon;