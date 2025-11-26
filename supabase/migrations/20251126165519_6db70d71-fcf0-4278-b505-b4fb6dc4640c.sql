-- Fix function search path security issue
CREATE OR REPLACE FUNCTION increment_post_comments_count(post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts
  SET comments_count = COALESCE(comments_count, 0) + 1
  WHERE id = post_id;
END;
$$;