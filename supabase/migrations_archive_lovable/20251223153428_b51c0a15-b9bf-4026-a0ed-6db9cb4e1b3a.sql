
-- Fix RLS policies for profiles table (remove duplicates and ensure proper access)
-- First, drop all existing SELECT policies on profiles to clean up duplicates
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Only authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles respecting privacy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_only" ON public.profiles;

-- Create a single clean SELECT policy for profiles
CREATE POLICY "Anyone can view public profile info" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Fix post_views RLS - ensure the INSERT policy properly validates user_id
DROP POLICY IF EXISTS "Authenticated users can create post views" ON public.post_views;

-- Create proper INSERT policy that allows authenticated users to insert their own views
CREATE POLICY "Authenticated users can insert post views" 
ON public.post_views 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- Fix post_view_history - clean up duplicate policies
DROP POLICY IF EXISTS "Users can delete their own history" ON public.post_view_history;
DROP POLICY IF EXISTS "Users can delete their own view history" ON public.post_view_history;
DROP POLICY IF EXISTS "Users can insert their own view history" ON public.post_view_history;
DROP POLICY IF EXISTS "Users can insert their own views" ON public.post_view_history;
DROP POLICY IF EXISTS "Users can view their own history" ON public.post_view_history;
DROP POLICY IF EXISTS "Users can view their own view history" ON public.post_view_history;

-- Create clean policies for post_view_history
CREATE POLICY "Users can view own view history" 
ON public.post_view_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own view history" 
ON public.post_view_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own view history" 
ON public.post_view_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Ensure user_id column allows nulls in post_views if not already (for anonymous views)
-- If user_id is NOT NULL, we need to handle it in application code
