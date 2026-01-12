-- Update public_profiles view to include location and occupation info
DROP VIEW IF EXISTS public_profiles;

CREATE VIEW public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  cover_url,
  bio,
  status,
  status_visibility,
  about,
  about_visibility,
  purpose,
  marital_status,
  followers_count,
  following_count,
  is_premium,
  instagram_url,
  twitter_url,
  linkedin_url,
  facebook_url,
  tiktok_url,
  youtube_url,
  website_url,
  country,
  city,
  detected_country_code,
  occupation
FROM profiles;

-- Grant access to the view
GRANT SELECT ON public_profiles TO anon, authenticated;