-- Add collection_name column to saved_posts if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'saved_posts' AND column_name = 'collection_name'
  ) THEN
    ALTER TABLE public.saved_posts 
    ADD COLUMN collection_name text DEFAULT 'default'::text;
  END IF;
END $$;

-- Ensure post_views has proper RLS policies
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all post views" ON public.post_views;
DROP POLICY IF EXISTS "Authenticated users can create post views" ON public.post_views;

-- Allow anyone to see view counts (needed for displaying counts)
CREATE POLICY "Users can view all post views"
ON public.post_views FOR SELECT
TO public
USING (true);

-- Only allow authenticated users to insert their own views
CREATE POLICY "Authenticated users can create post views"
ON public.post_views FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update posts table to have accurate view counts
-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON public.post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_user_post ON public.post_views(user_id, post_id);

-- Create a function to get accurate view count for a post
CREATE OR REPLACE FUNCTION get_post_view_count(post_id_param uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(DISTINCT user_id)
  FROM post_views
  WHERE post_id = post_id_param;
$$;