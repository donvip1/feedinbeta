-- Clean up duplicate RLS policies on posts table
DROP POLICY IF EXISTS "admins_delete_any_post" ON public.posts;
DROP POLICY IF EXISTS "users_delete_own_posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
DROP POLICY IF EXISTS "authenticated_users_create_posts" ON public.posts;
DROP POLICY IF EXISTS "authenticated_users_view_active_posts" ON public.posts;
DROP POLICY IF EXISTS "Users can view active public posts" ON public.posts;
DROP POLICY IF EXISTS "users_update_own_posts" ON public.posts;

-- Clean up duplicate RLS policies on friend_requests table
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friend_requests;

-- Clean up duplicate RLS policies on stories table  
DROP POLICY IF EXISTS "authenticated_users_create_stories" ON public.stories;
DROP POLICY IF EXISTS "authenticated_users_view_active_stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view stories" ON public.stories;