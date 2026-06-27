-- Drop and recreate the live_streams_public view to hide stream_key from non-owners
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
  updated_at,
  -- Only show stream_key to the stream owner
  CASE WHEN auth.uid() = user_id THEN stream_key ELSE NULL END as stream_key
FROM public.live_streams;

-- Grant access to authenticated users only
GRANT SELECT ON public.live_streams_public TO authenticated;

-- Revoke access from anonymous users
REVOKE ALL ON public.live_streams_public FROM anon;