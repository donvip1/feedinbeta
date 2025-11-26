-- Create function to increment post comments count
CREATE OR REPLACE FUNCTION increment_post_comments_count(post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET comments_count = COALESCE(comments_count, 0) + 1
  WHERE id = post_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_post_comments_count(UUID) TO authenticated;