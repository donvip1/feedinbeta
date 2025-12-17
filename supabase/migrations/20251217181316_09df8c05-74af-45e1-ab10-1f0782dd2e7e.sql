-- Fix Security Definer View warning by recreating public_profiles as a regular view
-- with proper RLS enforced on the underlying profiles table

DROP VIEW IF EXISTS public.public_profiles;

-- Create as a simple view (not security definer) - RLS on profiles handles security
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.is_premium,
  p.followers_count,
  p.following_count
FROM public.profiles p;

-- Revoke anon access
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Also ensure live_streams_public view uses security_invoker
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
  -- Only show stream_key to the owner
  CASE WHEN user_id = auth.uid() THEN stream_key ELSE NULL END as stream_key
FROM public.live_streams;

REVOKE ALL ON public.live_streams_public FROM anon;
GRANT SELECT ON public.live_streams_public TO authenticated;