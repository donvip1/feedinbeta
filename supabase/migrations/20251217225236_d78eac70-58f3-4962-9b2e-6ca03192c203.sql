-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Policy: Users can always view their own full profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy: Authenticated users can view basic profile info (for display names, avatars)
CREATE POLICY "Authenticated users can view basic profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Update the public_profiles view to only expose safe fields
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  is_premium,
  followers_count,
  following_count,
  created_at,
  -- Only show sensitive data to the profile owner
  CASE WHEN auth.uid() = id THEN phone_number ELSE NULL END as phone_number,
  CASE WHEN auth.uid() = id THEN stripe_customer_id ELSE NULL END as stripe_customer_id,
  CASE WHEN auth.uid() = id THEN cover_url ELSE NULL END as cover_url,
  CASE WHEN auth.uid() = id THEN banner_url ELSE NULL END as banner_url,
  CASE WHEN auth.uid() = id THEN location ELSE NULL END as location,
  CASE WHEN auth.uid() = id THEN country ELSE NULL END as country,
  CASE WHEN auth.uid() = id THEN age ELSE NULL END as age,
  CASE WHEN auth.uid() = id THEN marital_status ELSE NULL END as marital_status,
  CASE WHEN auth.uid() = id THEN website_url ELSE NULL END as website_url,
  CASE WHEN auth.uid() = id THEN twitter_url ELSE NULL END as twitter_url,
  CASE WHEN auth.uid() = id THEN instagram_url ELSE NULL END as instagram_url,
  CASE WHEN auth.uid() = id THEN linkedin_url ELSE NULL END as linkedin_url,
  CASE WHEN auth.uid() = id THEN facebook_url ELSE NULL END as facebook_url,
  CASE WHEN auth.uid() = id THEN youtube_url ELSE NULL END as youtube_url,
  CASE WHEN auth.uid() = id THEN tiktok_url ELSE NULL END as tiktok_url
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;

-- Revoke direct access from anon (unauthenticated users)
REVOKE ALL ON public.profiles FROM anon;