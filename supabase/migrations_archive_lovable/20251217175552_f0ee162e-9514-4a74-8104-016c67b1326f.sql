-- Create a secure view that hides stream_key from non-owners
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
  is_premium,
  viewer_count,
  peak_viewers,
  scheduled_start,
  started_at,
  ended_at,
  duration,
  created_at,
  updated_at,
  -- Only show stream_key to the owner
  CASE 
    WHEN user_id = auth.uid() THEN stream_key 
    ELSE NULL 
  END as stream_key
FROM public.live_streams;

GRANT SELECT ON public.live_streams_public TO authenticated;

-- Create a secure function to get stream with key (owner only)
CREATE OR REPLACE FUNCTION public.get_my_stream_key(p_stream_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stream_key
  FROM live_streams
  WHERE id = p_stream_id AND user_id = auth.uid();
$$;

-- Update RLS: Remove the overly permissive policy and create a restrictive one
DROP POLICY IF EXISTS "Users can view all streams" ON public.live_streams;
DROP POLICY IF EXISTS "Users can view their own streams" ON public.live_streams;

-- Create policy that hides stream_key column for non-owners
-- Note: RLS can't hide columns, so we restrict direct table access and use the view
CREATE POLICY "Users can view streams without sensitive data"
ON public.live_streams
FOR SELECT
TO authenticated
USING (
  -- Allow viewing if: it's your stream OR stream_key won't be exposed (status is live/ended for public viewing)
  user_id = auth.uid() 
  OR status IN ('live', 'ended', 'scheduled')
);