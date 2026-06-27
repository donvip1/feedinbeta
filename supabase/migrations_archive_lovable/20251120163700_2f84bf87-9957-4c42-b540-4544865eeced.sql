-- Ensure posts table has proper RLS policies for all users and admins

-- Drop all existing policies on posts table
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_update_policy" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_policy" ON public.posts;
DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;

-- Create comprehensive policies for posts

-- SELECT: Allow all authenticated users to view active posts
CREATE POLICY "authenticated_users_view_active_posts"
ON public.posts
FOR SELECT
TO authenticated
USING (status = 'active');

-- INSERT: Allow all authenticated users to create posts
CREATE POLICY "authenticated_users_create_posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Allow users to update their own posts
CREATE POLICY "users_update_own_posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Allow users to delete their own posts
CREATE POLICY "users_delete_own_posts"
ON public.posts
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- DELETE: Allow admins to delete any post
CREATE POLICY "admins_delete_any_post"
ON public.posts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Ensure stories table has proper RLS policies

-- Drop all existing policies on stories table
DROP POLICY IF EXISTS "stories_select_policy" ON public.stories;
DROP POLICY IF EXISTS "stories_insert_policy" ON public.stories;
DROP POLICY IF EXISTS "stories_delete_policy" ON public.stories;
DROP POLICY IF EXISTS "Admins can delete any story" ON public.stories;

-- SELECT: Allow all authenticated users to view active stories
CREATE POLICY "authenticated_users_view_active_stories"
ON public.stories
FOR SELECT
TO authenticated
USING (expires_at > now());

-- INSERT: Allow all authenticated users to create stories
CREATE POLICY "authenticated_users_create_stories"
ON public.stories
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- DELETE: Allow users to delete their own stories
CREATE POLICY "users_delete_own_stories"
ON public.stories
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- DELETE: Allow admins to delete any story
CREATE POLICY "admins_delete_any_story"
ON public.stories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);