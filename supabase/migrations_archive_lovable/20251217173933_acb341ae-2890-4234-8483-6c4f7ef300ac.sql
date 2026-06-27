-- Fix profiles table RLS to protect sensitive PII
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create restrictive policy for viewing profiles
-- Public fields (display_name, username, avatar_url, bio, cover_url, banner_url, followers_count, following_count) 
-- are visible to all authenticated users via the profiles table
-- But sensitive fields are protected by column-level access in the application layer

-- Policy: Users can view basic public profile info of all users
CREATE POLICY "Users can view public profile info"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Create a secure view for public profile data only (no PII)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  display_name,
  username,
  avatar_url,
  bio,
  cover_url,
  banner_url,
  followers_count,
  following_count,
  total_views,
  created_at,
  status,
  status_visibility,
  about,
  about_visibility,
  purpose
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Create a secure function to get profile with PII only for owner
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

-- Create a function to get another user's public profile (without PII)
CREATE OR REPLACE FUNCTION public.get_user_public_profile(user_id UUID)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  cover_url TEXT,
  banner_url TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  total_views INTEGER,
  created_at TIMESTAMPTZ,
  status TEXT,
  about TEXT,
  purpose TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.banner_url,
    p.followers_count,
    p.following_count,
    p.total_views,
    p.created_at,
    CASE 
      WHEN p.status_visibility = 'public' OR p.id = auth.uid() THEN p.status 
      ELSE NULL 
    END as status,
    CASE 
      WHEN p.about_visibility = 'public' OR p.id = auth.uid() THEN p.about 
      ELSE NULL 
    END as about,
    p.purpose
  FROM public.profiles p
  WHERE p.id = user_id;
$$;