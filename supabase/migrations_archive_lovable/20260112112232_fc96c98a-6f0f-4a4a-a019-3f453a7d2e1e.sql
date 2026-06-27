-- Add columns for tracking deleted posts for admin recovery
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Create index for faster queries on deleted posts
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON public.posts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status_deleted ON public.posts(status) WHERE status = 'deleted';

-- Update RLS policy to allow admins to view ALL posts including deleted ones
DROP POLICY IF EXISTS "Admins can view all posts including deleted" ON public.posts;
CREATE POLICY "Admins can view all posts including deleted"
ON public.posts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to restore deleted posts
DROP POLICY IF EXISTS "Admins can restore deleted posts" ON public.posts;
CREATE POLICY "Admins can restore deleted posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to get deleted posts by username (for admin use)
CREATE OR REPLACE FUNCTION public.get_deleted_posts_by_username(target_username TEXT)
RETURNS TABLE (
  id UUID,
  feed_id TEXT,
  user_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.feed_id,
    p.user_id,
    p.content,
    p.media_url,
    p.media_type,
    p.deleted_at,
    p.deleted_by,
    p.created_at
  FROM public.posts p
  INNER JOIN public.profiles pr ON p.user_id = pr.id
  WHERE pr.username = target_username
    AND p.status = 'deleted'
  ORDER BY p.deleted_at DESC;
END;
$$;

-- Function to restore a deleted post (for admin use)
CREATE OR REPLACE FUNCTION public.restore_deleted_post(post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
  
  UPDATE public.posts
  SET 
    status = 'active',
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = post_id AND status = 'deleted';
  
  RETURN FOUND;
END;
$$;