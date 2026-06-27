-- Fix: Completely remove stream_key from the public view
DROP VIEW IF EXISTS public.live_streams_public;

CREATE VIEW public.live_streams_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  title,
  description,
  thumbnail_url,
  status,
  category,
  tags,
  viewer_count,
  peak_viewers,
  scheduled_start,
  started_at,
  ended_at,
  duration,
  is_premium,
  created_at,
  updated_at
  -- stream_key is completely excluded - not even as NULL
FROM public.live_streams
WHERE status IN ('live', 'ended', 'scheduled');

-- Grant access to authenticated users only
GRANT SELECT ON public.live_streams_public TO authenticated;
REVOKE ALL ON public.live_streams_public FROM anon;