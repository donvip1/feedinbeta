-- Add field-level visibility controls to privacy_settings
ALTER TABLE public.privacy_settings
ADD COLUMN IF NOT EXISTS show_phone_number BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_date_of_birth BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_location BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_marital_status BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_occupation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_social_links BOOLEAN DEFAULT true;

-- Drop existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view public profile info" ON public.profiles;

-- Create new authenticated-only SELECT policy
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Create helper function to check if a field should be visible
CREATE OR REPLACE FUNCTION public.can_view_profile_field(
  target_user_id UUID,
  field_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  is_owner BOOLEAN;
  is_friend BOOLEAN;
  field_visible BOOLEAN;
BEGIN
  viewer_id := auth.uid();
  
  -- Owner can always see their own data
  IF viewer_id = target_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if they are friends
  SELECT EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status = 'accepted'
    AND (
      (sender_id = viewer_id AND receiver_id = target_user_id)
      OR (sender_id = target_user_id AND receiver_id = viewer_id)
    )
  ) INTO is_friend;
  
  -- Get the specific field visibility setting
  EXECUTE format(
    'SELECT COALESCE(%I, FALSE) FROM privacy_settings WHERE user_id = $1',
    field_name
  ) INTO field_visible USING target_user_id;
  
  -- If field is set to visible, or if they're friends (for some fields), return true
  RETURN COALESCE(field_visible, FALSE) OR is_friend;
END;
$$;

-- Create a secure view for public profile access (safe fields only)
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = on)
AS
SELECT 
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.cover_url,
  p.bio,
  p.is_premium,
  p.followers_count,
  p.following_count,
  p.total_views,
  p.status,
  p.status_visibility,
  p.about,
  p.about_visibility,
  p.purpose,
  -- Only show location if privacy setting allows
  CASE 
    WHEN p.id = auth.uid() THEN p.location
    WHEN COALESCE(ps.show_location, TRUE) THEN p.location
    ELSE NULL
  END as location,
  CASE 
    WHEN p.id = auth.uid() THEN p.city
    WHEN COALESCE(ps.show_location, TRUE) THEN p.city
    ELSE NULL
  END as city,
  CASE 
    WHEN p.id = auth.uid() THEN p.country
    WHEN COALESCE(ps.show_location, TRUE) THEN p.country
    ELSE NULL
  END as country,
  -- Only show phone if privacy setting allows
  CASE 
    WHEN p.id = auth.uid() THEN p.phone_number
    WHEN COALESCE(ps.show_phone_number, FALSE) THEN p.phone_number
    ELSE NULL
  END as phone_number,
  -- Only show date of birth if privacy setting allows
  CASE 
    WHEN p.id = auth.uid() THEN p.date_of_birth
    WHEN COALESCE(ps.show_date_of_birth, FALSE) THEN p.date_of_birth
    ELSE NULL
  END as date_of_birth,
  -- Only show marital status if privacy setting allows
  CASE 
    WHEN p.id = auth.uid() THEN p.marital_status
    WHEN COALESCE(ps.show_marital_status, FALSE) THEN p.marital_status
    ELSE NULL
  END as marital_status,
  -- Only show social links if privacy setting allows
  CASE 
    WHEN p.id = auth.uid() THEN p.instagram_url
    WHEN COALESCE(ps.show_social_links, TRUE) THEN p.instagram_url
    ELSE NULL
  END as instagram_url,
  CASE 
    WHEN p.id = auth.uid() THEN p.twitter_url
    WHEN COALESCE(ps.show_social_links, TRUE) THEN p.twitter_url
    ELSE NULL
  END as twitter_url,
  CASE 
    WHEN p.id = auth.uid() THEN p.linkedin_url
    WHEN COALESCE(ps.show_social_links, TRUE) THEN p.linkedin_url
    ELSE NULL
  END as linkedin_url,
  CASE 
    WHEN p.id = auth.uid() THEN p.facebook_url
    WHEN COALESCE(ps.show_social_links, TRUE) THEN p.facebook_url
    ELSE NULL
  END as facebook_url,
  CASE 
    WHEN p.id = auth.uid() THEN p.tiktok_url
    WHEN COALESCE(ps.show_social_links, TRUE) THEN p.tiktok_url
    ELSE NULL
  END as tiktok_url,
  CASE 
    WHEN p.id = auth.uid() THEN p.youtube_url
    WHEN COALESCE(ps.show_social_links, TRUE) THEN p.youtube_url
    ELSE NULL
  END as youtube_url,
  CASE 
    WHEN p.id = auth.uid() THEN p.website_url
    WHEN COALESCE(ps.show_social_links, TRUE) THEN p.website_url
    ELSE NULL
  END as website_url,
  p.created_at,
  p.interests,
  p.referral_code
FROM public.profiles p
LEFT JOIN public.privacy_settings ps ON ps.user_id = p.id;