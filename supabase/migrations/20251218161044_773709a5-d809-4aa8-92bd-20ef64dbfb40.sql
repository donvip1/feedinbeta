-- Recreate public_profiles view with correct column names
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  is_premium,
  followers_count,
  following_count
FROM public.profiles;

-- Grant select on public_profiles to authenticated only (not anon)
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;