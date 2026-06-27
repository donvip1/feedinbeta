-- Fix: Restrict live_streams table direct access to owners only
-- Others must use live_streams_public view which hides stream_key

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view streams without sensitive data" ON public.live_streams;

-- Create new policy: Only owners can SELECT from the base table (to see their stream_key)
CREATE POLICY "Owners can view their own streams"
ON public.live_streams
FOR SELECT
USING (auth.uid() = user_id);

-- Ensure the public view exists and is properly configured for non-owners
-- (Already created in previous migration, but ensure it's correct)
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
  -- stream_key is explicitly excluded from public view
  NULL::text as stream_key
FROM public.live_streams
WHERE status IN ('live', 'ended', 'scheduled');

-- Grant access to authenticated users
GRANT SELECT ON public.live_streams_public TO authenticated;

-- Revoke from anonymous
REVOKE ALL ON public.live_streams_public FROM anon;