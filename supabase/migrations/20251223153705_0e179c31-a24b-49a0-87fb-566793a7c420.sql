
-- Ensure authenticated users can access required data properly
-- Fix any missing or problematic policies

-- Add policy to allow users to view their own story views (for analytics)
DROP POLICY IF EXISTS "Users can view their own story views" ON public.story_views;
CREATE POLICY "Users can view their own story views" 
ON public.story_views 
FOR SELECT 
USING (user_id = auth.uid());

-- Ensure posts INSERT policy works correctly
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
CREATE POLICY "Users can create posts" 
ON public.posts 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Add policy for scheduled/draft posts visibility to owner
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
CREATE POLICY "Users can view their own posts" 
ON public.posts 
FOR SELECT 
USING (user_id = auth.uid());

-- Ensure notification INSERT works for the system (triggers/functions)
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Ensure authenticated users can create notifications for others (e.g., likes, comments trigger notifications)
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix live_streams to ensure proper visibility
DROP POLICY IF EXISTS "live_streams_owner_full_access" ON public.live_streams;

-- Ensure post_comments INSERT works
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
CREATE POLICY "Users can create comments" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Ensure post_likes INSERT works
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts" 
ON public.post_likes 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
