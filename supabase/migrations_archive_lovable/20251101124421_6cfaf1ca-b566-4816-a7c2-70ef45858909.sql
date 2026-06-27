-- Fix PUBLIC_DATA_EXPOSURE: Restrict profiles access to authenticated users only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create new policy requiring authentication for viewing profiles
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Fix PUBLIC_DATA_EXPOSURE: Require authentication for viewing stories
DROP POLICY IF EXISTS "Users can view all active stories" ON public.stories;

CREATE POLICY "Authenticated users can view active stories"
ON public.stories
FOR SELECT
TO authenticated
USING (expires_at > now());

-- Fix PUBLIC_DATA_EXPOSURE: Require authentication for viewing comments
DROP POLICY IF EXISTS "Users can view active comments" ON public.post_comments;

CREATE POLICY "Authenticated users can view active comments"
ON public.post_comments
FOR SELECT
TO authenticated
USING (status = 'active'::text);