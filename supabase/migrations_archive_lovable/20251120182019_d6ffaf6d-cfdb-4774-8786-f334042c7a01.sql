-- Create function to update comment count
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts 
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts 
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_comment_count ON post_comments;

-- Create trigger for comment count
CREATE TRIGGER trigger_update_comment_count
AFTER INSERT OR DELETE ON post_comments
FOR EACH ROW
EXECUTE FUNCTION update_post_comment_count();

-- Create function to get total likes for a user
CREATE OR REPLACE FUNCTION get_user_total_likes(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(likes_count), 0)::INTEGER
  FROM posts
  WHERE user_id = user_uuid AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;