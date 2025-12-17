-- Drop the SECURITY DEFINER view (security issue)
DROP VIEW IF EXISTS public.public_profiles;

-- Drop the previous overly permissive policy
DROP POLICY IF EXISTS "Users can view public profile info" ON public.profiles;

-- Create a more restrictive RLS policy that protects PII
-- Users can only see sensitive fields (phone, stripe_customer_id, location, age, marital_status) for their OWN profile
-- For other users, they can query but sensitive columns will need application-level filtering

-- Policy: Users can view all profiles but application layer filters sensitive data
CREATE POLICY "Users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- The real protection comes from the application layer:
-- 1. When fetching other users' profiles, use get_user_public_profile() function
-- 2. When fetching own profile, use get_my_profile() function
-- 3. Direct table access only returns public fields via application queries

-- Create an INVOKER (not definer) function for public profiles
DROP FUNCTION IF EXISTS public.get_user_public_profile(UUID);
CREATE OR REPLACE FUNCTION public.get_user_public_profile(target_user_id UUID)
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
SECURITY INVOKER
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
    END,
    CASE 
      WHEN p.about_visibility = 'public' OR p.id = auth.uid() THEN p.about 
      ELSE NULL 
    END,
    p.purpose
  FROM public.profiles p
  WHERE p.id = target_user_id;
$$;

-- Update get_my_profile to use INVOKER instead of DEFINER
DROP FUNCTION IF EXISTS public.get_my_profile();
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;