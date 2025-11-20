-- Drop all existing policies on posts table
DROP POLICY IF EXISTS "Users can view active posts" ON public.posts;
DROP POLICY IF EXISTS "Users can view public posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;

-- Create new policies for posts
CREATE POLICY "posts_select_policy"
ON public.posts
FOR SELECT
TO authenticated
USING (status = 'active');

CREATE POLICY "posts_insert_policy"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_policy"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete_policy"
ON public.posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Drop all existing policies on stories table
DROP POLICY IF EXISTS "Users can view active stories" ON public.stories;
DROP POLICY IF EXISTS "Users can create their own stories" ON public.stories;
DROP POLICY IF EXISTS "Authenticated users can create stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete own stories" ON public.stories;

-- Create new policies for stories
CREATE POLICY "stories_select_policy"
ON public.stories
FOR SELECT
TO authenticated
USING (expires_at > now());

CREATE POLICY "stories_insert_policy"
ON public.stories
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_delete_policy"
ON public.stories
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);