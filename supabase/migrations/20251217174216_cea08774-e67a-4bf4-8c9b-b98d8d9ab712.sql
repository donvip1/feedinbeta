-- Drop existing functions first to allow recreation with new signatures
DROP FUNCTION IF EXISTS public.get_user_public_profile(UUID);
DROP FUNCTION IF EXISTS public.get_my_profile();
DROP FUNCTION IF EXISTS public.get_visible_profiles(UUID);

-- Fix 1: Profiles table - Restrict to owner-only direct access
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view own profile" ON public.profiles;

-- Create restrictive policy - users can ONLY view their own profile directly
CREATE POLICY "Users can only view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Fix 2: Ensure ai_chat_messages has correct restrictive policies
DROP POLICY IF EXISTS "Anyone can view chat messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Public chat messages" ON public.ai_chat_messages;
DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.ai_chat_messages;

CREATE POLICY "Users can view their own chat messages"
ON public.ai_chat_messages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: Create a secure view for public profile info (non-PII only)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  cover_url,
  banner_url,
  followers_count,
  following_count,
  total_views,
  is_premium,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- Fix 4: Secure function to get public profile data (no PII)
CREATE FUNCTION public.get_user_public_profile(target_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  cover_url TEXT,
  banner_url TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  total_views BIGINT,
  is_premium BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.banner_url,
    p.followers_count,
    p.following_count,
    p.total_views,
    p.is_premium,
    p.created_at
  FROM public.profiles p
  WHERE p.id = target_user_id;
$$;

-- Fix 5: Secure function for user to get their own full profile
CREATE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  cover_url TEXT,
  banner_url TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  total_views BIGINT,
  is_premium BOOLEAN,
  created_at TIMESTAMPTZ,
  phone_number TEXT,
  location TEXT,
  country TEXT,
  age INTEGER,
  marital_status TEXT,
  about TEXT,
  interests TEXT[],
  purpose TEXT[],
  facebook_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  youtube_url TEXT,
  tiktok_url TEXT,
  website_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.banner_url,
    p.followers_count,
    p.following_count,
    p.total_views,
    p.is_premium,
    p.created_at,
    p.phone_number,
    p.location,
    p.country,
    p.age,
    p.marital_status,
    p.about,
    p.interests,
    p.purpose,
    p.facebook_url,
    p.twitter_url,
    p.instagram_url,
    p.linkedin_url,
    p.youtube_url,
    p.tiktok_url,
    p.website_url
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- Fix 6: Function to get profiles user has legitimate relationships with
CREATE FUNCTION public.get_visible_profiles(requesting_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  cover_url TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  is_premium BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.cover_url,
    p.followers_count,
    p.following_count,
    p.is_premium
  FROM public.profiles p
  WHERE 
    p.id = requesting_user_id
    OR EXISTS (
      SELECT 1 FROM public.follows f 
      WHERE (f.follower_id = requesting_user_id AND f.following_id = p.id)
         OR (f.following_id = requesting_user_id AND f.follower_id = p.id)
    )
    OR EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.status = 'accepted'
        AND ((fr.sender_id = requesting_user_id AND fr.receiver_id = p.id)
          OR (fr.receiver_id = requesting_user_id AND fr.sender_id = p.id))
    );
$$;