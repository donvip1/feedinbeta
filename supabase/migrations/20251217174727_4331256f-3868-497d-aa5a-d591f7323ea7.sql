-- Drop the existing public_profiles view
DROP VIEW IF EXISTS public.public_profiles;

-- Create a more restrictive view with minimal public data
-- Only shows data for users with legitimate relationships (following/friends)
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
FROM public.profiles p
WHERE 
  -- Only show if: it's the requesting user OR they have a legitimate relationship
  p.id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.follows f 
    WHERE (f.follower_id = auth.uid() AND f.following_id = p.id)
       OR (f.following_id = auth.uid() AND f.follower_id = p.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND ((fr.sender_id = auth.uid() AND fr.receiver_id = p.id)
        OR (fr.receiver_id = auth.uid() AND fr.sender_id = p.id))
  );

-- Only authenticated users can access the view (no anon access)
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Update the secure function to return even less data
DROP FUNCTION IF EXISTS public.get_user_public_profile(UUID);
CREATE FUNCTION public.get_user_public_profile(target_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_premium BOOLEAN,
  followers_count INTEGER,
  following_count INTEGER
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
    p.is_premium,
    p.followers_count,
    p.following_count
  FROM public.profiles p
  WHERE p.id = target_user_id
    AND (
      -- Allow if requesting own profile
      target_user_id = auth.uid()
      -- Or has legitimate relationship
      OR EXISTS (
        SELECT 1 FROM public.follows f 
        WHERE (f.follower_id = auth.uid() AND f.following_id = p.id)
           OR (f.following_id = auth.uid() AND f.follower_id = p.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE fr.status = 'accepted'
          AND ((fr.sender_id = auth.uid() AND fr.receiver_id = p.id)
            OR (fr.receiver_id = auth.uid() AND fr.sender_id = p.id))
      )
    );
$$;